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

export default function StudentsPanel() {
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

                // ── Class Roster derived data ──
                const rosterFiltered = classRosterRaw.filter(s => {
                  const q = rosterSearch.toLowerCase();
                  const matchSearch = !q || s.name?.toLowerCase().includes(q) || s.schoolName?.toLowerCase().includes(q) || s.grade?.toLowerCase().includes(q) || s.parentName?.toLowerCase().includes(q) || s.platformId?.toLowerCase().includes(q);
                  const matchSchool = rosterSchoolFilter === 'all' || s.schoolName === rosterSchoolFilter;
                  const matchGrade  = rosterGradeFilter  === 'all' || s.grade === rosterGradeFilter;
                  return matchSearch && matchSchool && matchGrade;
                });
                const rosterSchools = ['all', ...Array.from(new Set(classRosterRaw.map((s: any) => s.schoolName).filter(Boolean))).sort() as string[]];
                const rosterGrades  = ['all', ...Array.from(new Set(classRosterRaw.map((s: any) => s.grade).filter(Boolean))).sort() as string[]];

                // Group rosterFiltered
                const rosterGroups: Record<string, any[]> = {};
                rosterFiltered.forEach(s => {
                  const key = rosterGroupBy === 'school' ? (s.schoolName || 'No School') : (s.grade ? `Grade ${s.grade}` : 'No Grade');
                  if (!rosterGroups[key]) rosterGroups[key] = [];
                  rosterGroups[key].push(s);
                });
                const sortedGroupKeys = Object.keys(rosterGroups).sort();

                if (studentsView === 'class-roster') {
                  return (
                    <div className="space-y-4">
                      {/* Class Roster Header */}
                      <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-wrap items-center gap-3">
                        {/* View toggle */}
                        <div className="flex rounded-lg border border-[#E2E8F0] overflow-hidden">
                          <button onClick={() => setStudentsView('registry')} className="px-3 py-1.5 text-xs font-medium text-[#5F6C80] hover:bg-[#F5F7FA] transition-colors">Adult Registry</button>
                          <button className="px-3 py-1.5 text-xs font-semibold text-white transition-colors" style={{ backgroundColor: BRAND.primary }}>Class Roster</button>
                        </div>

                        {/* Search */}
                        <input
                          className="flex-1 min-w-[180px] text-sm rounded-lg border border-[#E2E8F0] px-3 py-1.5 focus:outline-none focus:border-[#4ECDC4] bg-[#F5F7FA] placeholder-[#9AA4B2]"
                          placeholder="Search student, school, parent..."
                          value={rosterSearch}
                          onChange={e => setRosterSearch(e.target.value)}
                        />

                        {/* School filter */}
                        <select value={rosterSchoolFilter} onChange={e => setRosterSchoolFilter(e.target.value)}
                          className="text-xs rounded-lg border border-[#E2E8F0] px-3 py-1.5 focus:outline-none focus:border-[#4ECDC4] bg-white text-[#5F6C80]">
                          {rosterSchools.map(s => <option key={s} value={s}>{s === 'all' ? 'All Schools' : s}</option>)}
                        </select>

                        {/* Grade filter */}
                        <select value={rosterGradeFilter} onChange={e => setRosterGradeFilter(e.target.value)}
                          className="text-xs rounded-lg border border-[#E2E8F0] px-3 py-1.5 focus:outline-none focus:border-[#4ECDC4] bg-white text-[#5F6C80]">
                          {rosterGrades.map(g => <option key={g} value={g}>{g === 'all' ? 'All Grades' : g}</option>)}
                        </select>

                        {/* Group by toggle */}
                        <div className="flex items-center gap-1.5 ml-auto">
                          <span className="text-xs text-[#9AA4B2]">Group by:</span>
                          {(['school', 'grade'] as const).map(g => (
                            <button key={g} onClick={() => setRosterGroupBy(g)}
                              className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-colors capitalize ${rosterGroupBy === g ? 'text-white' : 'text-[#5F6C80] bg-[#F5F7FA] hover:bg-[#E2E8F0]'}`}
                              style={rosterGroupBy === g ? { backgroundColor: BRAND.accent } : {}}>
                              {g}
                            </button>
                          ))}
                        </div>

                        {/* Refresh */}
                        <button onClick={() => refetchClassRoster()} className="text-xs font-medium text-[#5F6C80] border border-[#E2E8F0] px-3 py-1.5 rounded-lg hover:bg-[#F5F7FA] transition-colors">Refresh</button>

                        {/* Export dropdown */}
                        <div className="relative">
                          <button onClick={() => setRosterExportOpen(v => !v)}
                            className="flex items-center gap-1.5 text-xs font-medium text-white px-3 py-1.5 rounded-lg transition-colors"
                            style={{ backgroundColor: BRAND.primary }}>
                            <Download className="h-3.5 w-3.5" /> Export
                          </button>
                          {rosterExportOpen && (
                            <div className="absolute right-0 top-8 bg-white border border-[#E2E8F0] rounded-xl shadow-lg z-30 py-1 min-w-[160px]">
                              {(['csv','xlsx','pdf'] as const).map(fmt => {
                                const params = new URLSearchParams({ format: fmt });
                                if (rosterSchoolFilter !== 'all') params.set('school', rosterSchoolFilter);
                                if (rosterGradeFilter !== 'all')  params.set('grade', rosterGradeFilter);
                                return (
                                  <a key={fmt} href={`/api/admin/students/class-roster/export?${params}`} target="_blank" rel="noreferrer"
                                    onClick={() => setRosterExportOpen(false)}
                                    className="flex items-center gap-2 px-3 py-2 text-xs text-[#2E3440] hover:bg-[#F5F7FA] transition-colors">
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${fmt === 'pdf' ? 'bg-red-100 text-red-700' : fmt === 'xlsx' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{fmt.toUpperCase()}</span>
                                    {fmt === 'pdf' ? 'PDF Report' : fmt === 'xlsx' ? 'Excel Spreadsheet' : 'CSV File'}
                                  </a>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Summary badge */}
                        <span className="text-xs text-[#9AA4B2]">{rosterFiltered.length} students · {sortedGroupKeys.length} {rosterGroupBy === 'school' ? 'schools' : 'grades'}</span>
                      </div>

                      {/* Grouped Tables */}
                      {loadingClassRoster ? (
                        <div className="py-20 text-center text-sm text-[#9AA4B2]">Loading class roster...</div>
                      ) : rosterFiltered.length === 0 ? (
                        <div className="py-20 text-center text-sm text-[#9AA4B2] border-2 border-dashed border-[#E2E8F0] rounded-xl bg-white">No students match your filters</div>
                      ) : (
                        <div className="space-y-4">
                          {sortedGroupKeys.map(groupKey => {
                            const group = rosterGroups[groupKey];
                            return (
                              <div key={groupKey} className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                                {/* Group header */}
                                <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC]">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: BRAND.primary }} />
                                    <span className="text-sm font-semibold text-[#2E3440]">{groupKey}</span>
                                    <span className="text-xs text-[#9AA4B2] bg-[#F1F5F9] px-2 py-0.5 rounded-full">{group.length} student{group.length !== 1 ? 's' : ''}</span>
                                    {rosterGroupBy === 'school' && (
                                      <span className="text-xs text-[#9AA4B2]">· Grades: {[...new Set(group.map((s: any) => s.grade).filter(Boolean))].sort().join(', ') || '—'}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <a
                                      href={`/api/admin/students/class-roster/export?format=csv${rosterGroupBy === 'school' && groupKey !== 'No School' ? `&school=${encodeURIComponent(groupKey)}` : rosterGroupBy === 'grade' && groupKey !== 'No Grade' ? `&grade=${encodeURIComponent(groupKey.replace('Grade ', ''))}` : ''}`}
                                      target="_blank" rel="noreferrer"
                                      className="text-[10px] font-medium px-2 py-1 rounded border border-[#E2E8F0] text-[#5F6C80] hover:bg-[#F5F7FA] transition-colors">
                                      Export group
                                    </a>
                                  </div>
                                </div>

                                {/* Table */}
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b border-[#F1F5F9]">
                                        <th className="text-left text-[10px] font-semibold text-[#9AA4B2] uppercase tracking-wide px-4 py-2.5">Student</th>
                                        {rosterGroupBy === 'school' && <th className="text-left text-[10px] font-semibold text-[#9AA4B2] uppercase tracking-wide px-4 py-2.5">Grade</th>}
                                        {rosterGroupBy === 'grade'  && <th className="text-left text-[10px] font-semibold text-[#9AA4B2] uppercase tracking-wide px-4 py-2.5">School</th>}
                                        <th className="text-left text-[10px] font-semibold text-[#9AA4B2] uppercase tracking-wide px-4 py-2.5">Parent</th>
                                        <th className="text-left text-[10px] font-semibold text-[#9AA4B2] uppercase tracking-wide px-4 py-2.5">Contact</th>
                                        <th className="text-left text-[10px] font-semibold text-[#9AA4B2] uppercase tracking-wide px-4 py-2.5">Services</th>
                                        <th className="text-left text-[10px] font-semibold text-[#9AA4B2] uppercase tracking-wide px-4 py-2.5">Subscription</th>
                                        <th className="text-left text-[10px] font-semibold text-[#9AA4B2] uppercase tracking-wide px-4 py-2.5">Consent</th>
                                        <th className="text-left text-[10px] font-semibold text-[#9AA4B2] uppercase tracking-wide px-4 py-2.5">Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#F8FAFC]">
                                      {group.map((student: any) => (
                                        <tr key={student.id} className="hover:bg-[#F8FAFC] transition-colors">
                                          <td className="px-4 py-3">
                                            <p className="font-medium text-[#2E3440] text-sm">{student.name}</p>
                                            <p className="text-[10px] font-mono text-[#9AA4B2]">{student.platformId || '—'}</p>
                                            <p className="text-[10px] text-[#9AA4B2]">{student.gender || '—'} · Age {student.age || '?'}</p>
                                          </td>
                                          {rosterGroupBy === 'school' && (
                                            <td className="px-4 py-3 text-xs text-[#5F6C80]">
                                              <span className="font-medium">{student.grade || '—'}</span>
                                              {student.board && <p className="text-[10px] text-[#9AA4B2]">{student.board}</p>}
                                            </td>
                                          )}
                                          {rosterGroupBy === 'grade' && (
                                            <td className="px-4 py-3 text-xs text-[#5F6C80]">
                                              <p className="font-medium truncate max-w-[140px]">{student.schoolName || '—'}</p>
                                              {student.board && <p className="text-[10px] text-[#9AA4B2]">{student.board}</p>}
                                            </td>
                                          )}
                                          <td className="px-4 py-3">
                                            {student.parentName ? (
                                              <>
                                                <p className="text-xs font-medium text-[#2E3440]">{student.parentName}</p>
                                                <p className="text-[10px] font-mono text-[#9AA4B2]">{student.parentPlatformId || '—'}</p>
                                              </>
                                            ) : <span className="text-xs text-[#9AA4B2]">No parent</span>}
                                          </td>
                                          <td className="px-4 py-3">
                                            {student.parentEmail && <p className="text-[10px] text-[#5F6C80] truncate max-w-[140px]">{student.parentEmail}</p>}
                                            {student.parentMobile && <p className="text-[10px] text-[#5F6C80]">{student.parentMobile}</p>}
                                            {!student.parentEmail && !student.parentMobile && <span className="text-[10px] text-[#9AA4B2]">—</span>}
                                          </td>
                                          <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5 text-[10px] text-[#5F6C80]">
                                              {student.totalBookings > 0 && <span className="bg-[#344E86]/10 text-[#344E86] px-1.5 py-0.5 rounded font-medium">{student.totalBookings} sessions</span>}
                                              {student.wellnessCheckins > 0 && <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-medium">{student.wellnessCheckins} wellness</span>}
                                              {student.lbiSessions > 0 && <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-medium">{student.lbiSessions} LBI</span>}
                                              {student.totalBookings === 0 && student.wellnessCheckins === 0 && student.lbiSessions === 0 && <span className="text-[#9AA4B2]">None</span>}
                                            </div>
                                          </td>
                                          <td className="px-4 py-3">
                                            {student.activePlan ? (
                                              <div>
                                                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">{student.activePlan}</span>
                                                {student.subscriptionExpiry && <p className="text-[9px] text-[#9AA4B2] mt-0.5">Exp: {new Date(student.subscriptionExpiry).toLocaleDateString('en-IN')}</p>}
                                              </div>
                                            ) : (
                                              <span className="text-[10px] text-[#9AA4B2]">{student.subscriptionStatus || 'No plan'}</span>
                                            )}
                                          </td>
                                          <td className="px-4 py-3">
                                            {student.consentGiven
                                              ? <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">Given</span>
                                              : <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">Pending</span>
                                            }
                                          </td>
                                          <td className="px-4 py-3">
                                            <div className="flex items-center gap-1">
                                              {/* View Parent */}
                                              {student.parentId && (
                                                <button
                                                  title="View Parent Profile"
                                                  onClick={() => { setActiveTab('parents'); }}
                                                  className="p-1.5 rounded-lg hover:bg-[#E2E8F0] text-[#5F6C80] transition-colors"
                                                >
                                                  <Users className="h-3.5 w-3.5" />
                                                </button>
                                              )}
                                              {/* Book Mentor Session */}
                                              <button
                                                title="Book Mentor Session"
                                                onClick={() => toast({ title: 'Book Session', description: `Opening session booking for ${student.name}` })}
                                                className="p-1.5 rounded-lg hover:bg-[#E2E8F0] text-[#5F6C80] transition-colors"
                                              >
                                                <Calendar className="h-3.5 w-3.5" />
                                              </button>
                                              {/* Send Notification */}
                                              {student.parentEmail && (
                                                <button
                                                  title="Send Notification to Parent"
                                                  onClick={() => toast({ title: 'Notification Sent', description: `Notification queued for ${student.parentEmail}` })}
                                                  className="p-1.5 rounded-lg hover:bg-[#E2E8F0] text-[#5F6C80] transition-colors"
                                                >
                                                  <Bell className="h-3.5 w-3.5" />
                                                </button>
                                              )}
                                              {/* Assign Subscription */}
                                              <button
                                                title="Assign Subscription"
                                                onClick={() => toast({ title: 'Assign Subscription', description: `Select a plan for ${student.name}` })}
                                                className="p-1.5 rounded-lg hover:bg-[#E2E8F0] text-[#5F6C80] transition-colors"
                                              >
                                                <CreditCard className="h-3.5 w-3.5" />
                                              </button>
                                              {/* Export individual record */}
                                              <a
                                                title="Export Student Record"
                                                href={`/api/admin/students/${student.id}/export?format=pdf`}
                                                target="_blank" rel="noreferrer"
                                                className="p-1.5 rounded-lg hover:bg-[#E2E8F0] text-[#5F6C80] transition-colors block"
                                              >
                                                <Download className="h-3.5 w-3.5" />
                                              </a>
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                // ── Adult Learner Registry (existing view) ──
                const filteredStudents = studentsList.filter(s => {
                  const matchSearch = !studentSearch ||
                    s.name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
                    s.city?.toLowerCase().includes(studentSearch.toLowerCase()) ||
                    s.careerInterest?.toLowerCase().includes(studentSearch.toLowerCase()) ||
                    s.platformId?.toLowerCase().includes(studentSearch.toLowerCase());
                  const matchCareer = studentGradeFilter === 'all' || s.careerInterest === studentGradeFilter;
                  return matchSearch && matchCareer;
                });
                const careers = ['all', ...Array.from(new Set(studentsList.map((s: any) => s.careerInterest).filter(Boolean))).sort()];
                return (
                  <div className="flex h-[calc(100vh-120px)] bg-[#F5F7FA]">
                    {/* Registry Panel */}
                    <div className="w-[300px] flex-shrink-0 border-r border-[#E2E8F0] bg-white flex flex-col">
                      <div className="px-4 py-4 border-b border-[#E2E8F0]">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <span className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide">Adult Learner Registry</span>
                            <p className="text-[10px] text-[#9AA4B2] mt-0.5">Independent students · Age 18+</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => { setStudentsView('class-roster'); refetchClassRoster(); }}
                              className="text-[10px] font-medium px-2 py-1 rounded-lg border border-[#E2E8F0] text-[#5F6C80] hover:bg-[#F5F7FA] transition-colors"
                              title="Switch to Class Roster view"
                            >
                              Class Roster
                            </button>
                            <span className="text-xs text-[#9AA4B2] tabular-nums">{filteredStudents.length}/{studentsList.length}</span>
                            <div className="relative">
                              <button
                                onClick={() => setStudentRegistryExportOpen(v => !v)}
                                className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg border border-[#E2E8F0] text-[#5F6C80] hover:bg-[#F5F7FA] transition-colors"
                                title="Export registry"
                              >
                                <Download className="h-3 w-3" /> Export
                              </button>
                              {studentRegistryExportOpen && (
                                <div className="absolute right-0 top-7 bg-white border border-[#E2E8F0] rounded-xl shadow-lg z-30 py-1 min-w-[140px]">
                                  {(['pdf','xlsx','csv'] as const).map(fmt => (
                                    <a key={fmt}
                                      href={`/api/admin/students/export?format=${fmt}`}
                                      target="_blank" rel="noreferrer"
                                      onClick={() => setStudentRegistryExportOpen(false)}
                                      className="flex items-center gap-2 px-3 py-2 text-xs text-[#2E3440] hover:bg-[#F5F7FA] transition-colors">
                                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${fmt === 'pdf' ? 'bg-red-100 text-red-700' : fmt === 'xlsx' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{fmt.toUpperCase()}</span>
                                      {fmt === 'pdf' ? 'PDF Report' : fmt === 'xlsx' ? 'Excel File' : 'CSV File'}
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <input
                          className="w-full text-sm rounded-lg border border-[#E2E8F0] px-3 py-2 focus:outline-none focus:border-[#4ECDC4] focus:ring-2 focus:ring-[#4ECDC4]/10 bg-[#F5F7FA] placeholder-[#9AA4B2] transition-all"
                          placeholder="Search name, city, career track..."
                          value={studentSearch}
                          onChange={e => setStudentSearch(e.target.value)}
                        />
                      </div>
                      <div className="px-4 py-2.5 border-b border-[#E2E8F0] flex gap-1.5 flex-wrap">
                        {careers.slice(0, 6).map(c => (
                          <button key={c} onClick={() => setStudentGradeFilter(c)}
                            className={`text-xs font-medium px-3 py-1 rounded-full transition-all ${studentGradeFilter === c ? 'bg-[#4ECDC4] text-white shadow-sm' : 'bg-[#F5F7FA] text-[#5F6C80] hover:bg-[#E2E8F0]'}`}>
                            {c === 'all' ? 'All Tracks' : c}
                          </button>
                        ))}
                      </div>
                      <div className="flex-1 overflow-y-auto">
                        {loadingStudents ? (
                          <div className="py-16 text-center text-sm text-[#9AA4B2]">Loading...</div>
                        ) : filteredStudents.length === 0 ? (
                          <div className="py-16 text-center text-sm text-[#9AA4B2]">No records found</div>
                        ) : filteredStudents.map(student => (
                          <button key={student.id} onClick={() => { setSelectedStudent(student); setStudentDetailTab('profile'); }}
                            className={`w-full text-left px-4 py-3 border-b border-[#F5F7FA] transition-all ${selectedStudent?.id === student.id ? 'bg-[#4ECDC4]/[0.05] border-l-[3px] !border-l-[#4ECDC4] pl-[13px]' : 'hover:bg-[#F5F7FA] border-l-[3px] border-l-transparent'}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="text-sm font-semibold text-[#2E3440] truncate">{student.name}</p>
                                  {student.platformId && <span className="font-mono text-[10px] text-[#4ECDC4] bg-[#4ECDC4]/10 px-1.5 py-0.5 rounded flex-shrink-0">{student.platformId}</span>}
                                </div>
                                <p className="text-xs text-[#9AA4B2] truncate mt-0.5">
                                  {student.age ? `Age ${student.age}` : 'Age —'}{student.gender ? ` · ${student.gender}` : ''}
                                </p>
                                <p className="text-xs text-[#9AA4B2] mt-0.5 truncate">
                                  {student.careerInterest || student.city || 'No track assigned'}
                                </p>
                              </div>
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 text-[#344E86] bg-[#344E86]/10">
                                Adult
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Detail Area */}
                    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                      {!selectedStudent ? (
                        <div className="flex-1 flex items-center justify-center h-full">
                          <div className="text-center">
                            <div className="w-16 h-16 rounded-2xl bg-[#344E86]/10 flex items-center justify-center mx-auto mb-4">
                              <GraduationCap className="h-7 w-7 text-[#344E86]" />
                            </div>
                            <p className="text-sm font-semibold text-[#5F6C80]">Select a learner to view their profile</p>
                            <p className="text-xs text-[#9AA4B2] mt-1">{studentsList.length} adult learner{studentsList.length !== 1 ? 's' : ''} registered</p>
                            {studentsList.length === 0 && (
                              <p className="text-xs text-[#9AA4B2] mt-2 max-w-[220px] mx-auto leading-relaxed">Adult learners aged 18+ who enrol independently appear here. Children under 18 are managed through the Parent Registry.</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="bg-white border-b border-[#E2E8F0] px-6 py-4 flex-shrink-0">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                  <h2 className="text-lg font-bold text-[#2E3440]">{sd?.name}</h2>
                                  {sd?.platformId && (
                                    <span className="font-mono text-xs font-semibold text-[#4ECDC4] bg-[#4ECDC4]/10 px-2 py-0.5 rounded">{sd.platformId}</span>
                                  )}
                                  <span className="text-xs font-medium px-2.5 py-0.5 rounded-full text-[#344E86] bg-[#344E86]/10">Adult Learner</span>
                                  {sd?.consentGiven !== undefined && (
                                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${sd?.consentGiven ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'}`}>
                                      {sd?.consentGiven ? 'Consent Obtained' : 'Consent Pending'}
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-[#5F6C80]">
                                  {sd?.age ? `Age ${sd.age}` : 'Age unknown'}
                                  {sd?.gender ? ` · ${sd.gender}` : ''}
                                  {sd?.city ? ` · ${sd.city}` : ''}
                                  {sd?.careerInterest ? ` · ${sd.careerInterest}` : ''}
                                </p>
                              </div>
                              {/* Action bar */}
                              <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">

                                {/* Deactivate / Activate */}
                                <button
                                  disabled={!sd?.studentUserId || studentActionLoading === 'toggle'}
                                  onClick={async () => {
                                    if (!sd?.studentUserId) return;
                                    setStudentActionLoading('toggle');
                                    setStudentActionFeedback(null);
                                    try {
                                      const res = await fetch(`/api/admin/users/${sd.studentUserId}/status`, {
                                        method: 'PATCH', credentials: 'include',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ is_active: !sd.studentUserActive }),
                                      });
                                      if (res.ok) {
                                        setSelectedStudent({ ...selectedStudent, studentUserActive: !sd.studentUserActive });
                                        setStudentActionFeedback({ ok: true, msg: `Account ${!sd.studentUserActive ? 'activated' : 'deactivated'} successfully` });
                                      } else {
                                        setStudentActionFeedback({ ok: false, msg: 'Failed to update account status' });
                                      }
                                    } catch { setStudentActionFeedback({ ok: false, msg: 'Network error' }); }
                                    finally { setStudentActionLoading(null); setTimeout(() => setStudentActionFeedback(null), 3500); }
                                  }}
                                  className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${sd?.studentUserActive ? 'border-red-200 text-red-600 bg-red-50 hover:bg-red-100' : 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'}`}
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                    {sd?.studentUserActive
                                      ? <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                                      : <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                    }
                                  </svg>
                                  {studentActionLoading === 'toggle' ? 'Updating...' : sd?.studentUserActive ? 'Deactivate' : 'Activate'}
                                </button>

                                {/* Reset Password */}
                                <button
                                  disabled={!sd?.studentUserId}
                                  onClick={() => { setStudentResetPwdOpen(v => !v); setStudentNotifOpen(false); setStudentResetPwdValue(''); }}
                                  className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${studentResetPwdOpen ? 'border-[#344E86] text-[#344E86] bg-[#344E86]/5' : 'border-[#E2E8F0] text-[#5F6C80] hover:bg-[#F5F7FA]'}`}
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
                                  Reset Password
                                </button>

                                {/* Notify */}
                                <button
                                  onClick={() => { setStudentNotifOpen(v => !v); setStudentResetPwdOpen(false); setStudentNotifMessage(''); }}
                                  className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${studentNotifOpen ? 'border-[#344E86] text-[#344E86] bg-[#344E86]/5' : 'border-[#E2E8F0] text-[#5F6C80] hover:bg-[#F5F7FA]'}`}
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                                  Notify
                                </button>

                                {/* Download per-learner export */}
                                <div className="relative group">
                                  <button className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-[#E2E8F0] text-[#5F6C80] hover:bg-[#F5F7FA] transition-colors">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                                    Download
                                  </button>
                                  <div className="absolute right-0 top-8 bg-white border border-[#E2E8F0] rounded-xl shadow-lg z-20 py-1 min-w-[130px] hidden group-hover:block">
                                    {(['pdf','xlsx','csv'] as const).map(fmt => (
                                      <a key={fmt}
                                        href={`/api/admin/students/${selectedStudent?.id}/export?format=${fmt}`}
                                        target="_blank" rel="noreferrer"
                                        className="flex items-center gap-2 px-3 py-2 text-xs text-[#2E3440] hover:bg-[#F5F7FA] transition-colors">
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${fmt === 'pdf' ? 'bg-red-100 text-red-700' : fmt === 'xlsx' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{fmt.toUpperCase()}</span>
                                        {fmt === 'pdf' ? 'PDF Report' : fmt === 'xlsx' ? 'Excel File' : 'CSV File'}
                                      </a>
                                    ))}
                                  </div>
                                </div>

                                {/* Refresh */}
                                <button
                                  onClick={() => refetchStudents()}
                                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-[#E2E8F0] text-[#5F6C80] hover:bg-[#F5F7FA] transition-colors"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                                  Refresh
                                </button>
                              </div>
                            </div>

                            {/* Action feedback banner */}
                            {studentActionFeedback && (
                              <div className={`mt-3 px-3 py-2 rounded-lg text-xs font-medium ${studentActionFeedback.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                                {studentActionFeedback.msg}
                              </div>
                            )}

                            {/* Reset Password Panel */}
                            {studentResetPwdOpen && (
                              <div className="mt-3 p-3 bg-[#F5F7FA] rounded-xl border border-[#E2E8F0]">
                                <p className="text-xs font-semibold text-[#5F6C80] mb-2">Set New Password for {sd?.name}</p>
                                <div className="flex gap-2">
                                  <input
                                    type="password"
                                    value={studentResetPwdValue}
                                    onChange={e => setStudentResetPwdValue(e.target.value)}
                                    placeholder="New password (min 6 characters)"
                                    className="flex-1 text-xs border border-[#E2E8F0] rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#344E86]"
                                  />
                                  <button
                                    disabled={studentResetPwdValue.length < 6 || studentActionLoading === 'resetpwd'}
                                    onClick={async () => {
                                      setStudentActionLoading('resetpwd');
                                      try {
                                        const res = await fetch(`/api/admin/users/${sd?.studentUserId}/reset-password`, {
                                          method: 'POST', credentials: 'include',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ password: studentResetPwdValue }),
                                        });
                                        const data = await res.json();
                                        setStudentActionFeedback({ ok: res.ok, msg: res.ok ? 'Password reset successfully' : (data.message || 'Failed to reset password') });
                                        if (res.ok) { setStudentResetPwdOpen(false); setStudentResetPwdValue(''); }
                                      } catch { setStudentActionFeedback({ ok: false, msg: 'Network error' }); }
                                      finally { setStudentActionLoading(null); setTimeout(() => setStudentActionFeedback(null), 3500); }
                                    }}
                                    className="text-xs font-medium px-3 py-2 rounded-lg bg-[#344E86] text-white hover:bg-[#2d4373] disabled:opacity-50 transition-colors whitespace-nowrap"
                                  >
                                    {studentActionLoading === 'resetpwd' ? 'Saving...' : 'Set Password'}
                                  </button>
                                  <button onClick={() => setStudentResetPwdOpen(false)} className="text-xs font-medium px-3 py-2 rounded-lg border border-[#E2E8F0] text-[#9AA4B2] hover:bg-white transition-colors">Cancel</button>
                                </div>
                              </div>
                            )}

                            {/* Send Notification Panel */}
                            {studentNotifOpen && (
                              <div className="mt-3 p-3 bg-[#F5F7FA] rounded-xl border border-[#E2E8F0]">
                                <p className="text-xs font-semibold text-[#5F6C80] mb-2">Send Notification to {sd?.name}</p>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={studentNotifMessage}
                                    onChange={e => setStudentNotifMessage(e.target.value)}
                                    placeholder="Enter notification message..."
                                    className="flex-1 text-xs border border-[#E2E8F0] rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#344E86]"
                                  />
                                  <button
                                    disabled={!studentNotifMessage.trim() || studentActionLoading === 'notify'}
                                    onClick={async () => {
                                      setStudentActionLoading('notify');
                                      const recipientId = sd?.studentUserId || sd?.parentId;
                                      try {
                                        const res = await fetch('/api/admin/notifications/send', {
                                          method: 'POST', credentials: 'include',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({
                                            recipientId,
                                            title: 'Message from Admin',
                                            message: studentNotifMessage.trim(),
                                            type: 'info',
                                            category: 'general',
                                          }),
                                        });
                                        setStudentActionFeedback({ ok: res.ok, msg: res.ok ? 'Notification sent successfully' : 'Failed to send notification' });
                                        if (res.ok) { setStudentNotifOpen(false); setStudentNotifMessage(''); }
                                      } catch { setStudentActionFeedback({ ok: false, msg: 'Network error' }); }
                                      finally { setStudentActionLoading(null); setTimeout(() => setStudentActionFeedback(null), 3500); }
                                    }}
                                    className="text-xs font-medium px-3 py-2 rounded-lg bg-[#344E86] text-white hover:bg-[#2d4373] disabled:opacity-50 transition-colors whitespace-nowrap"
                                  >
                                    {studentActionLoading === 'notify' ? 'Sending...' : 'Send'}
                                  </button>
                                  <button onClick={() => setStudentNotifOpen(false)} className="text-xs font-medium px-3 py-2 rounded-lg border border-[#E2E8F0] text-[#9AA4B2] hover:bg-white transition-colors">Cancel</button>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Stats row */}
                          <div className="bg-white border-b border-[#E2E8F0] px-6 py-2 flex-shrink-0">
                            <div className="flex items-center gap-6">
                              {[
                                { label: 'Bookings', value: sd?.totalBookings ?? 0 },
                                { label: 'Wellness', value: sd?.wellnessCheckins ?? 0 },
                                { label: 'LBI Sessions', value: sd?.lbiSessions ?? 0 },
                                { label: 'Registered', value: sd?.createdAt ? new Date(sd.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' },
                              ].map(({ label, value }) => (
                                <div key={label} className="text-center">
                                  <p className="text-xs font-bold text-[#2E3440]">{value}</p>
                                  <p className="text-[10px] text-[#9AA4B2]">{label}</p>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="bg-white border-b border-[#E2E8F0] px-6 flex-shrink-0">
                            <div className="flex">
                              {([
                                { id: 'profile', label: 'Profile' },
                                { id: 'academic', label: 'Academic' },
                                { id: 'wellness', label: 'Wellness' },
                                { id: 'lbi', label: 'LBI' },
                                { id: 'bookings', label: 'Bookings' },
                                { id: 'subscription', label: 'Subscription' },
                                { id: 'consent', label: 'Consent' },
                              ] as const).map(tab => (
                                <button key={tab.id} onClick={() => setStudentDetailTab(tab.id)}
                                  className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${studentDetailTab === tab.id ? 'border-[#4ECDC4] text-[#4ECDC4]' : 'border-transparent text-[#9AA4B2] hover:text-[#5F6C80]'}`}>
                                  {tab.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="flex-1 overflow-y-auto p-6 bg-[#F5F7FA]">
                            {studentDetailTab === 'profile' && (
                              <div className="space-y-4 max-w-2xl">
                                <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5">
                                  <h3 className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide mb-4">Personal Information</h3>
                                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                                    {[
                                      { label: 'Full Name', value: sd?.name || '—' },
                                      { label: 'Platform ID', value: sd?.platformId || '—' },
                                      { label: 'Gender', value: sd?.gender || '—' },
                                      { label: 'Date of Birth', value: sd?.dateOfBirth ? new Date(sd.dateOfBirth).toLocaleDateString('en-IN') : '—' },
                                      { label: 'Age', value: sd?.age ? `${sd.age} years` : '—' },
                                      { label: 'Blood Group', value: sd?.bloodGroup || '—' },
                                      { label: 'Language', value: sd?.language || '—' },
                                      { label: 'City', value: sd?.city || '—' },
                                      { label: 'State', value: sd?.state || '—' },
                                    ].map(({ label, value }) => (
                                      <div key={label}>
                                        <p className="text-xs font-medium text-[#9AA4B2] uppercase tracking-wide mb-1">{label}</p>
                                        <p className="text-sm font-medium text-[#2E3440] capitalize">{value}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5">
                                  <h3 className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide mb-4">Parent / Guardian</h3>
                                  <div className="grid grid-cols-3 gap-6">
                                    {[
                                      { label: 'Name', value: sd?.parentName || '—' },
                                      { label: 'Email', value: sd?.parentEmail || '—' },
                                      { label: 'Mobile', value: sd?.parentMobile || '—' },
                                    ].map(({ label, value }) => (
                                      <div key={label}>
                                        <p className="text-xs font-medium text-[#9AA4B2] uppercase tracking-wide mb-1">{label}</p>
                                        <p className="text-sm font-medium text-[#2E3440] truncate">{value}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}

                            {studentDetailTab === 'academic' && (
                              <div className="space-y-4 max-w-2xl">
                                <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5">
                                  <h3 className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide mb-4">Academic Profile</h3>
                                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                                    {[
                                      { label: 'School / Institution', value: sd?.school || '—' },
                                      { label: 'School Type', value: sd?.schoolType || '—' },
                                      { label: 'Board', value: sd?.board || '—' },
                                      { label: 'Medium', value: sd?.medium || '—' },
                                      { label: 'Grade / Year', value: sd?.grade || '—' },
                                      { label: 'Study Hours / Day', value: sd?.studyHoursPerDay ? `${sd.studyHoursPerDay} hrs` : '—' },
                                      { label: 'Learning Style', value: sd?.learningStyle || '—' },
                                      { label: 'Career Interest', value: sd?.careerInterest || '—' },
                                    ].map(({ label, value }) => (
                                      <div key={label}>
                                        <p className="text-xs font-medium text-[#9AA4B2] uppercase tracking-wide mb-1">{label}</p>
                                        <p className="text-sm font-medium text-[#2E3440] capitalize">{value}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                {(sd?.favoriteSubjects?.length > 0 || sd?.weakSubjects?.length > 0) && (
                                  <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5">
                                    <h3 className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide mb-4">Subject Proficiency</h3>
                                    {sd?.favoriteSubjects?.length > 0 && (
                                      <div className="mb-4">
                                        <p className="text-xs font-medium text-[#9AA4B2] uppercase tracking-wide mb-2">Strong Areas</p>
                                        <div className="flex flex-wrap gap-1.5">
                                          {sd.favoriteSubjects.map((s: string, i: number) => (
                                            <span key={i} className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{s}</span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {sd?.weakSubjects?.length > 0 && (
                                      <div>
                                        <p className="text-xs font-medium text-[#9AA4B2] uppercase tracking-wide mb-2">Areas for Improvement</p>
                                        <div className="flex flex-wrap gap-1.5">
                                          {sd.weakSubjects.map((s: string, i: number) => (
                                            <span key={i} className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-red-50 text-red-700">{s}</span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {studentDetailTab === 'wellness' && (
                              <div className="max-w-2xl space-y-3">
                                <div className="flex items-center justify-between">
                                  <h3 className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide">{studentWellness.length} Check-in{studentWellness.length !== 1 ? 's' : ''} — Last 30 Days</h3>
                                  <button onClick={() => refetchStudentWellness()} className="text-xs font-medium text-[#5F6C80] border border-[#E2E8F0] px-3 py-1.5 rounded-lg hover:bg-[#F5F7FA] transition-colors">Refresh</button>
                                </div>
                                {studentWellness.length === 0 ? (
                                  <div className="py-16 text-center text-sm text-[#9AA4B2] rounded-xl border border-dashed border-[#E2E8F0] bg-white">No wellness check-ins recorded yet</div>
                                ) : studentWellness.map((w: any) => (
                                  <div key={w.id} className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm px-5 py-4">
                                    <div className="flex items-center justify-between mb-3">
                                      <div>
                                        <p className="text-sm font-bold text-[#2E3440] capitalize">{w.mood}</p>
                                        <p className="text-xs text-[#9AA4B2]">{new Date(w.checkedAt).toLocaleDateString('en-IN')}</p>
                                      </div>
                                      {w.flags?.length > 0 && (
                                        <div className="flex gap-1.5 flex-wrap justify-end">
                                          {w.flags.map((f: string, i: number) => (
                                            <span key={i} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600">{f}</span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <div className="grid grid-cols-4 gap-4">
                                      {[
                                        { label: 'Stress', value: w.stressLevel, max: 10, alert: w.stressLevel > 7 },
                                        { label: 'Energy', value: w.energy, max: 10, alert: false },
                                        { label: 'Focus', value: w.focus, max: 10, alert: false },
                                        { label: 'Sleep', value: w.sleepHours, max: 12, unit: 'h', alert: w.sleepHours < 6 },
                                      ].map(({ label, value, max, unit, alert }) => (
                                        <div key={label}>
                                          <p className="text-xs font-medium text-[#9AA4B2] uppercase tracking-wide mb-1">{label}</p>
                                          <p className={`text-base font-bold ${alert ? 'text-red-500' : 'text-[#2E3440]'}`}>{value}{unit || ''}</p>
                                          <div className="h-1.5 bg-[#F5F7FA] rounded-full mt-1 overflow-hidden">
                                            <div className={`h-full rounded-full ${alert ? 'bg-red-400' : 'bg-[#4ECDC4]'}`} style={{ width: `${(value / max) * 100}%` }} />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                    {w.notes && <p className="text-sm text-[#5F6C80] mt-3 italic border-t border-[#F5F7FA] pt-3">{w.notes}</p>}
                                  </div>
                                ))}
                              </div>
                            )}

                            {studentDetailTab === 'lbi' && (
                              <div className="max-w-2xl space-y-3">
                                <div className="flex items-center justify-between">
                                  <h3 className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide">{studentLbi.length} LBI Session{studentLbi.length !== 1 ? 's' : ''}</h3>
                                  <button onClick={() => refetchStudentLbi()} className="text-xs font-medium text-[#5F6C80] border border-[#E2E8F0] px-3 py-1.5 rounded-lg hover:bg-[#F5F7FA] transition-colors">Refresh</button>
                                </div>
                                {studentLbi.length === 0 ? (
                                  <div className="py-16 text-center text-sm text-[#9AA4B2] rounded-xl border border-dashed border-[#E2E8F0] bg-white">No LBI assessments taken yet</div>
                                ) : studentLbi.map((s: any) => (
                                  <div key={s.id} className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm px-5 py-4">
                                    <div className="flex items-start justify-between gap-4">
                                      <div className="flex-1">
                                        <p className="text-sm font-bold text-[#2E3440]">{s.moduleName || `Module ${s.id}`}</p>
                                        {s.moduleDescription && <p className="text-sm text-[#5F6C80] mt-0.5">{s.moduleDescription}</p>}
                                        <div className="flex items-center gap-4 mt-2 text-xs text-[#9AA4B2]">
                                          <span>{new Date(s.startedAt).toLocaleDateString('en-IN')}</span>
                                          {s.completedAt && <span className="text-emerald-600 font-medium">Completed</span>}
                                          <span>{s.questionsAnswered}/{s.totalQuestions} answered</span>
                                        </div>
                                      </div>
                                      <div className="text-right flex-shrink-0">
                                        {s.percentageScore != null && (
                                          <p className={`text-xl font-bold ${s.percentageScore >= 70 ? 'text-emerald-600' : s.percentageScore >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                                            {parseFloat(s.percentageScore).toFixed(1)}%
                                          </p>
                                        )}
                                        {s.percentileScore != null && (
                                          <p className="text-xs text-[#9AA4B2]">{parseFloat(s.percentileScore).toFixed(1)} percentile</p>
                                        )}
                                        {getStatusBadge(s.status)}
                                      </div>
                                    </div>
                                    {s.rawScore != null && (
                                      <div className="mt-3 h-1.5 bg-[#F5F7FA] rounded-full overflow-hidden">
                                        <div className="h-full bg-[#344E86] rounded-full" style={{ width: `${(s.rawScore / (s.maxScore || 1)) * 100}%` }} />
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {studentDetailTab === 'bookings' && (
                              <div className="max-w-2xl space-y-3">
                                <div className="flex items-center justify-between">
                                  <h3 className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide">{studentBookings.length} Session Booking{studentBookings.length !== 1 ? 's' : ''}</h3>
                                  <button onClick={() => refetchStudentBookings()} className="text-xs font-medium text-[#5F6C80] border border-[#E2E8F0] px-3 py-1.5 rounded-lg hover:bg-[#F5F7FA] transition-colors">Refresh</button>
                                </div>
                                {studentBookings.length === 0 ? (
                                  <div className="py-16 text-center text-sm text-[#9AA4B2] rounded-xl border border-dashed border-[#E2E8F0] bg-white">No session bookings on record</div>
                                ) : studentBookings.map((b: any) => (
                                  <div key={b.id} className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm px-5 py-4">
                                    <div className="flex items-start justify-between gap-4">
                                      <div>
                                        <p className="text-sm font-bold text-[#2E3440]">{b.mentorName || 'Unknown Mentor'}</p>
                                        <div className="flex items-center gap-4 mt-1.5 text-xs text-[#5F6C80]">
                                          <span>{b.slotDate ? new Date(b.slotDate).toLocaleDateString('en-IN') : '—'}</span>
                                          <span>{b.startTime} – {b.endTime}</span>
                                          <span className="capitalize">{b.mode}</span>
                                        </div>
                                        {b.notes && <p className="text-xs text-[#9AA4B2] mt-1.5 italic">{b.notes}</p>}
                                      </div>
                                      {getStatusBadge(b.status)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {studentDetailTab === 'subscription' && (
                              <div className="max-w-2xl space-y-3">
                                {studentSubscription.length === 0 ? (
                                  <div className="py-16 text-center text-sm text-[#9AA4B2] rounded-xl border border-dashed border-[#E2E8F0] bg-white">No subscription assigned to this student</div>
                                ) : studentSubscription.map((sub: any) => (
                                  <div key={sub.id} className={`rounded-xl border shadow-sm px-5 py-4 ${sub.status === 'active' ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-[#E2E8F0]'}`}>
                                    <div className="flex items-start justify-between gap-4">
                                      <div>
                                        <p className="text-sm font-bold text-[#2E3440]">{sub.packageName || 'Unknown Package'}</p>
                                        {sub.packageDescription && <p className="text-sm text-[#5F6C80] mt-0.5">{sub.packageDescription}</p>}
                                        <div className="flex items-center gap-4 mt-2 text-xs text-[#5F6C80]">
                                          <span>Purchased: {sub.purchaseDate ? new Date(sub.purchaseDate).toLocaleDateString('en-IN') : '—'}</span>
                                          <span>Expires: {sub.expiryDate ? new Date(sub.expiryDate).toLocaleDateString('en-IN') : '—'}</span>
                                        </div>
                                        {sub.price && <p className="text-xs text-[#9AA4B2] mt-1">{sub.currency} {sub.price}</p>}
                                      </div>
                                      {getStatusBadge(sub.status)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {studentDetailTab === 'consent' && (
                              <div className="max-w-2xl space-y-4">
                                <div className={`p-5 rounded-xl border shadow-sm ${sd?.consentGiven ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                                  <p className={`text-sm font-bold ${sd?.consentGiven ? 'text-emerald-800' : 'text-red-700'}`}>
                                    {sd?.consentGiven ? 'Consent Obtained' : 'Consent Not Yet Given'}
                                  </p>
                                  {sd?.consentGivenAt && (
                                    <p className="text-xs text-[#5F6C80] mt-1">Obtained on {new Date(sd.consentGivenAt).toLocaleDateString('en-IN')}</p>
                                  )}
                                </div>
                                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-sm text-blue-700 leading-relaxed">
                                  Per DPDP Act 2023, parental/guardian consent is mandatory before processing any personal data of a child under 18 years. Without consent, sessions cannot proceed and data collection is restricted.
                                </div>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
}
