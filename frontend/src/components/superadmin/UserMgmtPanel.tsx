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

export default function UserMgmtPanel() {
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
    <>
              {activeTab === 'usermgmt' && (
                <div className="flex gap-1 mb-6 bg-white border border-gray-200 rounded-xl p-1 max-w-sm shadow-sm">
                  {([
                    { view: 'users' as const,      Icon: Users,    label: 'User Management' },
                    { view: 'onboarding' as const, Icon: UserPlus, label: 'Onboarding' },
                  ]).map(({ view, Icon, label }) => (
                    <button
                      key={view}
                      onClick={() => setUserMgmtView(view)}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        userMgmtView === view ? 'text-white shadow-sm' : 'text-gray-600 hover:text-gray-800'
                      }`}
                      style={userMgmtView === view ? { backgroundColor: BRAND.primary } : {}}
                    >
                      <Icon className="h-4 w-4" /> {label}
                    </button>
                  ))}
                </div>
              )}

              {/* User Management Tab */}
              {activeTab === 'usermgmt' && userMgmtView === 'users' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Users className="h-5 w-5" style={{ color: BRAND.primary }} />
                        User Management
                      </h3>
                      <p className="text-sm text-gray-500">Manage all platform users — edit details, reset passwords, activate or deactivate accounts</p>
                    </div>
                  </div>

                  {/* Stats Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                      { label: 'Total Users', value: umTotal, color: BRAND.primary, filter: 'all' },
                      { label: 'Parents', value: umRoleCounts.find((r: any) => r.role === 'parent')?.count || stats?.totalParents || 0, color: '#10b981', filter: 'parent' },
                      { label: 'Students', value: umRoleCounts.find((r: any) => r.role === 'student')?.count || stats?.totalStudents || 0, color: '#6366f1', filter: 'student' },
                      { label: 'Mentors', value: umRoleCounts.find((r: any) => r.role === 'mentor')?.count || stats?.totalMentors || 0, color: '#f59e0b', filter: 'mentor' },
                      { label: 'Institutes', value: umRoleCounts.find((r: any) => r.role === 'institute')?.count || stats?.totalInstitutes || 0, color: '#ef4444', filter: 'institute' },
                    ].map((stat) => (
                      <Card key={stat.label} className={`cursor-pointer hover:shadow-md transition-shadow ${umRoleFilter === stat.filter ? 'ring-2' : ''}`} style={umRoleFilter === stat.filter ? { ringColor: stat.color } : {}} onClick={() => { setUmRoleFilter(stat.filter); setUmPage(1); }}>
                        <CardContent className="pt-5 pb-4">
                          <p className="text-xs text-gray-500">{stat.label}</p>
                          <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Filters */}
                  <Card>
                    <CardContent className="pt-5">
                      <div className="flex flex-wrap gap-3 items-center">
                        <div className="relative flex-1 min-w-[200px]">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input
                            placeholder="Search by name, email, or mobile..."
                            value={umSearch}
                            onChange={(e) => { setUmSearch(e.target.value); setUmPage(1); }}
                            className="pl-10"
                          />
                        </div>
                        <Select value={umRoleFilter} onValueChange={(val) => { setUmRoleFilter(val); setUmPage(1); }}>
                          <SelectTrigger className="w-40"><SelectValue placeholder="All Roles" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Roles</SelectItem>
                            <SelectItem value="parent">Parent</SelectItem>
                            <SelectItem value="student">Student</SelectItem>
                            <SelectItem value="mentor">Mentor</SelectItem>
                            <SelectItem value="institute">Institute</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="super_admin">Super Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={umStatusFilter} onValueChange={(val) => { setUmStatusFilter(val); setUmPage(1); }}>
                          <SelectTrigger className="w-36"><SelectValue placeholder="All Status" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="true">Active</SelectItem>
                            <SelectItem value="false">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="outline" size="sm" onClick={() => { setUmSearch(''); setUmRoleFilter('all'); setUmStatusFilter('all'); setUmPage(1); }}>
                          <RotateCcw className="h-4 w-4 mr-1" /> Reset
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Users Table */}
                  <Card>
                    <CardContent className="p-0">
                      {umLoading ? (
                        <div className="flex items-center justify-center py-16">
                          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                          <span className="ml-2 text-gray-500">Loading users...</span>
                        </div>
                      ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 border-b">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">User</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Email / Mobile</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Role</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Joined</th>
                              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {umUsers.length === 0 && (
                              <tr><td colSpan={6} className="px-4 py-16 text-center text-gray-400">
                                <Users className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                                <p className="font-medium">No users found</p>
                                <p className="text-sm">Try adjusting your search or filters</p>
                              </td></tr>
                            )}
                            {umUsers.map((user: any) => {
                              const roleColors: Record<string, string> = {
                                parent: '#10b981', student: '#6366f1', mentor: '#f59e0b',
                                institute: '#ef4444', admin: '#8b5cf6', super_admin: '#dc2626'
                              };
                              return (
                                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: roleColors[user.role] || BRAND.primary }}>
                                        {(user.full_name || user.username || user.email || 'U').charAt(0).toUpperCase()}
                                      </div>
                                      <div>
                                        <p className="font-medium text-sm">{user.full_name || user.username || 'Unnamed'}</p>
                                        <p className="text-xs text-gray-400">ID: {user.id?.slice(0, 8)}...</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <p className="text-sm">{user.email || '—'}</p>
                                    <p className="text-xs text-gray-400">{user.mobile || ''}</p>
                                  </td>
                                  <td className="px-4 py-3">
                                    <Badge className="text-xs capitalize" style={{ backgroundColor: `${roleColors[user.role] || BRAND.primary}20`, color: roleColors[user.role] || BRAND.primary, border: 'none' }}>
                                      {user.role?.replace('_', ' ') || 'unknown'}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <div className={`w-2 h-2 rounded-full ${user.is_active ? 'bg-green-500' : 'bg-red-400'}`} />
                                      <span className="text-sm">{user.is_active ? 'Active' : 'Inactive'}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-500">
                                    {user.created_at ? new Date(user.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex justify-center gap-1">
                                      {/* Edit */}
                                      <Button size="sm" variant="ghost" title="Edit user" onClick={() => {
                                        setEditUserDialog({ open: true, user });
                                        setEditUserData({ full_name: user.full_name, email: user.email, mobile: user.mobile, role: user.role, is_active: user.is_active, is_verified: user.is_verified });
                                      }}>
                                        <Edit className="h-4 w-4" style={{ color: BRAND.primary }} />
                                      </Button>
                                      {/* Reset Password */}
                                      <Button size="sm" variant="ghost" title="Reset password" onClick={() => {
                                        setUmResetPwDialog({ open: true, user });
                                        setUmNewPassword('');
                                      }}>
                                        <Key className="h-4 w-4 text-orange-500" />
                                      </Button>
                                      {/* Toggle Active */}
                                      <Button size="sm" variant="ghost" title={user.is_active ? 'Deactivate' : 'Activate'} onClick={async () => {
                                        try {
                                          const res = await fetch(`/api/admin/users/${user.id}/status`, {
                                            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                                            body: JSON.stringify({ is_active: !user.is_active }),
                                          });
                                          if (res.ok) {
                                            refetchUm();
                                            toast({ title: user.is_active ? 'User Deactivated' : 'User Activated', description: `${user.full_name || 'User'} is now ${user.is_active ? 'inactive' : 'active'}.` });
                                          }
                                        } catch {}
                                      }}>
                                        {user.is_active
                                          ? <Ban className="h-4 w-4 text-red-500" />
                                          : <CheckCircle className="h-4 w-4 text-green-500" />
                                        }
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      )}
                    </CardContent>
                    {/* Pagination */}
                    {umTotalPages > 0 && (
                      <div className="px-4 py-3 border-t flex items-center justify-between bg-gray-50">
                        <span className="text-sm text-gray-500">Showing page {umData?.page || 1} of {umTotalPages} ({umTotal} users)</span>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" disabled={umPage <= 1} onClick={() => setUmPage(p => p - 1)}>Previous</Button>
                          <Button size="sm" variant="outline" disabled={umPage >= umTotalPages} onClick={() => setUmPage(p => p + 1)}>Next</Button>
                        </div>
                      </div>
                    )}
                  </Card>
                </div>
              )}

              {/* Onboarding Tab — sub-tab of User Management */}
              {activeTab === 'usermgmt' && userMgmtView === 'onboarding' && (
                <div className="space-y-6">

                  {/* ── Onboarding KPI Strip ── */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                    {[
                      { label: 'Total Requests',  value: onboardingStats?.total ?? 0,           color: BRAND.primary, bg: '#344E8618' },
                      { label: 'Pending',          value: onboardingStats?.pending ?? 0,         color: '#F59E0B',     bg: '#F59E0B18' },
                      { label: 'Approved',         value: onboardingStats?.approved ?? 0,        color: '#059669',     bg: '#05966918' },
                      { label: 'Rejected',         value: onboardingStats?.rejected ?? 0,        color: '#EF4444',     bg: '#EF444418' },
                      { label: 'Institutes',       value: onboardingStats?.byType?.institute ?? 0, color: '#6366F1', bg: '#6366F118' },
                      { label: 'Mentors',          value: onboardingStats?.byType?.mentor ?? 0,  color: BRAND.accent,  bg: `${BRAND.accent}18` },
                      { label: 'NGOs',             value: onboardingStats?.byType?.ngo ?? 0,     color: '#0EA5E9',     bg: '#0EA5E918' },
                      { label: 'LEIs',             value: onboardingStats?.byType?.lei ?? 0,     color: '#8B5CF6',     bg: '#8B5CF618' },
                    ].map((s, i) => (
                      <div key={i} className="bg-white border border-[#E2E8F0] rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                        <p className="text-[11px] font-medium text-[#9AA4B2] mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* ── Sub-Tabs ── */}
                  <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
                    <div className="flex border-b border-[#E2E8F0] overflow-x-auto">
                      {([
                        { id: 'requests',         label: 'Approvals',          badge: onboardingStats?.pending ?? 0,                                                      badgeColor: '#F59E0B' },
                        { id: 'kyc',              label: 'Document KYC',       badge: kycDocuments.filter((k: any) => k.status === 'pending').length,                    badgeColor: '#EF4444' },
                        { id: 'mentor-pipeline',  label: 'Mentor Pipeline',    badge: mentors.filter((m: any) => m.onboardingStage !== 'active').length,              badgeColor: '#8B5CF6' },
                        { id: 'enrollments',      label: 'Enrollments',        badge: studentEnrollments.length,                                                          badgeColor: BRAND.primary },
                        { id: 'enrollment-kyc',   label: 'Student KYC',        badge: enrollmentKycList.filter((e: any) => e.kycStatus !== 'verified').length,           badgeColor: '#0EA5E9' },
                      ] as const).map(tab => (
                        <button key={tab.id} onClick={() => setOnboardingSubTab(tab.id)}
                          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors flex-shrink-0 ${
                            onboardingSubTab === tab.id ? 'border-[#344E86] text-[#344E86]' : 'border-transparent text-[#9AA4B2] hover:text-[#5F6C80]'
                          }`}
                          data-testid={`onboarding-subtab-${tab.id}`}>
                          {tab.label}
                          {tab.badge > 0 && (
                            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: tab.badgeColor }}>
                              {tab.badge}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Onboarding Requests Sub-Tab */}
                  {onboardingSubTab === 'requests' && (
                    <>
                  {/* Entity type quick-filter (collapsed from the old stats cards) */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <Card>
                      <CardContent className="p-4 text-center">
                        <p className="text-3xl font-bold" style={{ color: BRAND.primary }}>{onboardingStats?.total || 0}</p>
                        <p className="text-xs text-gray-500">Total Requests</p>
                      </CardContent>
                    </Card>
                    <Card className="border-yellow-200 bg-yellow-50/50">
                      <CardContent className="p-4 text-center">
                        <p className="text-3xl font-bold text-yellow-600">{onboardingStats?.pending || 0}</p>
                        <p className="text-xs text-gray-500">Pending</p>
                      </CardContent>
                    </Card>
                    <Card className="border-green-200 bg-green-50/50">
                      <CardContent className="p-4 text-center">
                        <p className="text-3xl font-bold text-green-600">{onboardingStats?.approved || 0}</p>
                        <p className="text-xs text-gray-500">Approved</p>
                      </CardContent>
                    </Card>
                    <Card className="border-red-200 bg-red-50/50">
                      <CardContent className="p-4 text-center">
                        <p className="text-3xl font-bold text-red-600">{onboardingStats?.rejected || 0}</p>
                        <p className="text-xs text-gray-500">Rejected</p>
                      </CardContent>
                    </Card>
                    <Card className="border-orange-200 bg-orange-50/50">
                      <CardContent className="p-4 text-center">
                        <p className="text-3xl font-bold text-orange-600">{onboardingStats?.suspended || 0}</p>
                        <p className="text-xs text-gray-500">Suspended</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* By Entity Type */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {['institute', 'parent', 'mentor', 'ngo', 'lei'].map(type => (
                      <div 
                        key={type} 
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${entityTypeFilter === type ? 'ring-2' : ''}`}
                        style={{ borderColor: entityTypeFilter === type ? BRAND.primary : undefined, backgroundColor: `${BRAND.primary}05` }}
                        onClick={() => setEntityTypeFilter(entityTypeFilter === type ? 'all' : type)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium" style={{ color: BRAND.primary }}>{formatEntityType(type)}</span>
                          <Badge variant="outline" className="text-xs">
                            {onboardingStats?.byType?.[type] || 0}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {onboardingStats?.pendingByType?.[type] || 0} pending
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* List */}
                    <div className={selectedOnboarding ? "lg:col-span-1" : "lg:col-span-3"}>
                      <Card>
                        <CardHeader className="border-b pb-4">
                          <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between">
                              <CardTitle>Onboarding Requests</CardTitle>
                              <Button variant="outline" size="sm" onClick={() => refetchOnboarding()} data-testid="button-refresh-onboarding">
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="flex flex-wrap gap-3">
                              <div className="relative flex-1 min-w-[200px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                  placeholder="Search by name or email..."
                                  value={onboardingSearch}
                                  onChange={(e) => setOnboardingSearch(e.target.value)}
                                  className="pl-10"
                                  data-testid="input-onboarding-search"
                                />
                              </div>
                              <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-32" data-testid="filter-status">
                                  <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">All Status</SelectItem>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="approved">Approved</SelectItem>
                                  <SelectItem value="rejected">Rejected</SelectItem>
                                  <SelectItem value="suspended">Suspended</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-0 max-h-[600px] overflow-y-auto">
                          <div className="divide-y">
                            {onboardingApprovals
                              .filter((item: any) => {
                                const search = onboardingSearch.toLowerCase();
                                return !search || 
                                  item.entityName?.toLowerCase().includes(search) ||
                                  item.entityEmail?.toLowerCase().includes(search);
                              })
                              .map((item: any) => {
                                const isSelected = selectedOnboarding?.id === item.id;
                                const typeIcon = item.entityType === 'institute' ? Building2 : 
                                  item.entityType === 'mentor' ? GraduationCap : Users;
                                const IconComponent = typeIcon;
                                return (
                                  <div 
                                    key={item.id} 
                                    className={`p-4 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                                    onClick={() => setSelectedOnboarding(isSelected ? null : item)}
                                    data-testid={`onboarding-row-${item.id}`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND.primary}15` }}>
                                          <IconComponent className="h-5 w-5" style={{ color: BRAND.primary }} />
                                        </div>
                                        <div>
                                          <div className="flex items-center gap-2">
                                            <p className="font-medium text-sm" style={{ color: BRAND.primary }}>{item.entityName}</p>
                                            {getStatusBadge(item.status)}
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <p className="text-xs text-gray-500">{formatEntityType(item.entityType)}</p>
                                            {item.applicantCode && (
                                              <code className="text-xs px-1.5 py-0.5 rounded font-mono font-semibold" style={{ backgroundColor: `${BRAND.primary}12`, color: BRAND.primary }}>
                                                {item.applicantCode}
                                              </code>
                                            )}
                                          </div>
                                          <div className="flex gap-2 mt-1">
                                            {item.documentsVerified && <Badge variant="outline" className="text-xs text-green-600 border-green-200">Docs</Badge>}
                                            {item.kycVerified && <Badge variant="outline" className="text-xs text-green-600 border-green-200">KYC</Badge>}
                                          </div>
                                        </div>
                                      </div>
                                      <ChevronRight className={`h-5 w-5 text-gray-400 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                                    </div>
                                  </div>
                                );
                              })}
                            {onboardingApprovals.length === 0 && (
                              <div className="p-8 text-center text-gray-500">No onboarding requests found</div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Detail Panel */}
                    {selectedOnboarding && (
                      <div className="lg:col-span-2">
                        <Card>
                          <CardHeader className="border-b">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${BRAND.primary}15` }}>
                                  {selectedOnboarding.entityType === 'institute' ? <Building2 className="h-6 w-6" style={{ color: BRAND.primary }} /> :
                                   selectedOnboarding.entityType === 'mentor' ? <GraduationCap className="h-6 w-6" style={{ color: BRAND.primary }} /> :
                                   <Users className="h-6 w-6" style={{ color: BRAND.primary }} />}
                                </div>
                                <div>
                                  <CardTitle>{selectedOnboarding.entityName}</CardTitle>
                                  <CardDescription>{formatEntityType(selectedOnboarding.entityType)} Registration</CardDescription>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {getStatusBadge(selectedOnboarding.status)}
                                <Button variant="ghost" size="sm" onClick={() => setSelectedOnboarding(null)}>
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="p-6 space-y-6">
                            {/* Contact Info */}
                            <div>
                              <h4 className="text-sm font-semibold mb-3" style={{ color: BRAND.primary }}>Contact Information</h4>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <p className="text-gray-500">Email</p>
                                  <p className="font-medium">{selectedOnboarding.entityEmail || 'N/A'}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500">Phone</p>
                                  <p className="font-medium">{selectedOnboarding.entityPhone || 'N/A'}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500">Submitted</p>
                                  <p className="font-medium">{formatDateTime(selectedOnboarding.submittedAt)}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500">Entity ID</p>
                                  <p className="font-medium font-mono text-xs">{selectedOnboarding.entityId}</p>
                                </div>
                                {selectedOnboarding.entityType === 'mentor' && selectedOnboarding.applicantCode && (
                                  <div className="col-span-2">
                                    <p className="text-gray-500 text-xs mb-0.5">Application Reference ID</p>
                                    <div className="flex items-center gap-2">
                                      <code className="font-mono text-sm font-bold px-2 py-0.5 rounded-md" style={{ backgroundColor: `${BRAND.primary}12`, color: BRAND.primary }}>
                                        {selectedOnboarding.applicantCode}
                                      </code>
                                      {selectedOnboarding.status === 'approved' && selectedOnboarding.mentorCode && (
                                        <span className="text-xs text-gray-400">→ promoted to</span>
                                      )}
                                      {selectedOnboarding.status === 'approved' && selectedOnboarding.mentorCode && (
                                        <code className="font-mono text-sm font-bold px-2 py-0.5 rounded-md" style={{ backgroundColor: '#dcfce7', color: '#166534' }}>
                                          {selectedOnboarding.mentorCode}
                                        </code>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Mentor Profile Info — shown for approved mentor requests */}
                            {selectedOnboarding.entityType === 'mentor' && selectedOnboarding.status === 'approved' && (
                              <div className="rounded-xl border p-4 space-y-3" style={{ backgroundColor: `${BRAND.primary}06`, borderColor: `${BRAND.primary}25` }}>
                                <h4 className="text-sm font-semibold flex items-center gap-2" style={{ color: BRAND.primary }}>
                                  <GraduationCap className="h-4 w-4" /> Mentor Profile Created
                                </h4>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                  <div>
                                    <p className="text-gray-500 text-xs mb-0.5">Mentor ID</p>
                                    {selectedOnboarding.mentorCode
                                      ? <code className="font-mono text-sm font-bold" style={{ color: BRAND.primary }}>{selectedOnboarding.mentorCode}</code>
                                      : <span className="text-gray-400 italic text-xs">Generating…</span>}
                                  </div>
                                  <div>
                                    <p className="text-gray-500 text-xs mb-0.5">Agreement Status</p>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border inline-block ${
                                      selectedOnboarding.mentorAgreementStatus === 'completed' ? 'bg-green-50 text-green-700 border-green-200' :
                                      selectedOnboarding.mentorAgreementStatus === 'acknowledged' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                      selectedOnboarding.mentorAgreementStatus === 'sent' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                      'bg-gray-50 text-gray-500 border-gray-200'
                                    }`}>
                                      {selectedOnboarding.mentorAgreementStatus
                                        ? (selectedOnboarding.mentorAgreementStatus as string).replace(/_/g, ' ')
                                        : 'not sent'}
                                    </span>
                                  </div>
                                  <div>
                                    <p className="text-gray-500 text-xs mb-0.5">Profile Status</p>
                                    <span className={`text-xs font-medium capitalize ${
                                      selectedOnboarding.mentorProfileStatus === 'active' ? 'text-green-600' :
                                      selectedOnboarding.mentorProfileStatus === 'pending_agreement' ? 'text-amber-600' :
                                      'text-gray-500'
                                    }`}>
                                      {(selectedOnboarding.mentorProfileStatus || '').replace(/_/g, ' ') || 'N/A'}
                                    </span>
                                  </div>
                                  {selectedOnboarding.mentorCode && selectedOnboarding.mentorAgreementStatus !== 'completed' && (
                                    <div className="flex items-end">
                                      <button
                                        className="text-xs underline font-medium"
                                        style={{ color: BRAND.primary }}
                                        onClick={async () => {
                                          try {
                                            const res = await fetch(`/api/admin/mentors/${selectedOnboarding.mentorCode}/resend-agreement`, {
                                              method: 'POST', credentials: 'include'
                                            });
                                            const data = await res.json();
                                            if (res.ok) alert('Agreement email resent.');
                                            else alert(data.message || 'Failed to resend.');
                                          } catch { alert('Network error.'); }
                                        }}
                                      >
                                        Resend Agreement Email ↗
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Verification Status */}
                            <div>
                              <h4 className="text-sm font-semibold mb-3" style={{ color: BRAND.primary }}>Verification Status</h4>
                              <div className="grid grid-cols-2 gap-4">
                                <Card className={selectedOnboarding.documentsVerified ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}>
                                  <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <FileText className={`h-5 w-5 ${selectedOnboarding.documentsVerified ? 'text-green-600' : 'text-orange-600'}`} />
                                        <span className="font-medium">Documents</span>
                                      </div>
                                      <Button
                                        size="sm"
                                        variant={selectedOnboarding.documentsVerified ? "outline" : "default"}
                                        onClick={() => verifyDocumentsMutation.mutate({ id: selectedOnboarding.id, verified: !selectedOnboarding.documentsVerified })}
                                        style={!selectedOnboarding.documentsVerified ? { backgroundColor: BRAND.accent } : undefined}
                                        data-testid="button-toggle-docs"
                                      >
                                        {selectedOnboarding.documentsVerified ? 'Unmark' : 'Verify'}
                                      </Button>
                                    </div>
                                    <p className="text-xs mt-2 text-gray-600">
                                      {selectedOnboarding.documentsVerified ? 'Documents have been verified' : 'Documents pending verification'}
                                    </p>
                                  </CardContent>
                                </Card>
                                <Card className={selectedOnboarding.kycVerified ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}>
                                  <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <Shield className={`h-5 w-5 ${selectedOnboarding.kycVerified ? 'text-green-600' : 'text-orange-600'}`} />
                                        <span className="font-medium">KYC</span>
                                      </div>
                                      <Button
                                        size="sm"
                                        variant={selectedOnboarding.kycVerified ? "outline" : "default"}
                                        onClick={() => verifyKycMutation.mutate({ id: selectedOnboarding.id, verified: !selectedOnboarding.kycVerified })}
                                        style={!selectedOnboarding.kycVerified ? { backgroundColor: BRAND.accent } : undefined}
                                        data-testid="button-toggle-kyc"
                                      >
                                        {selectedOnboarding.kycVerified ? 'Unmark' : 'Verify'}
                                      </Button>
                                    </div>
                                    <p className="text-xs mt-2 text-gray-600">
                                      {selectedOnboarding.kycVerified ? 'KYC has been verified' : 'KYC pending verification'}
                                    </p>
                                  </CardContent>
                                </Card>
                              </div>
                            </div>

                            {/* Uploaded Documents */}
                            <div>
                              <h4 className="text-sm font-semibold mb-3" style={{ color: BRAND.primary }}>
                                KYC Documents
                                {kycDocs.length > 0 && (
                                  <span className="ml-2 text-xs font-normal text-gray-500">
                                    ({kycDocs.filter((d: any) => d.status === 'verified').length}/{kycDocs.length} verified)
                                  </span>
                                )}
                              </h4>
                              {kycDocs.length === 0 ? (
                                <p className="text-sm text-gray-500 italic">No KYC documents seeded for this request.</p>
                              ) : (
                              <div className="space-y-2">
                                {kycDocs.map((doc: any) => {
                                  const docLabelMap: Record<string, string> = {
                                    registration_certificate: 'Registration Certificate',
                                    pan_card: 'PAN Card',
                                    gst_certificate: 'GST Certificate',
                                    address_proof: 'Address Proof',
                                    identity_proof: 'Identity Proof (Aadhaar/Passport)',
                                    authorization_letter: 'Authorization Letter',
                                    bank_details: 'Bank Account Details',
                                    qualification_certificate: 'Qualification Certificate',
                                    '80g_certificate': '80G Certificate',
                                    fcra_certificate: 'FCRA Certificate',
                                    ngo_registration: 'NGO Registration',
                                    accreditation: 'Accreditation Certificate',
                                    affiliation_certificate: 'Affiliation Certificate',
                                    trust_deed: 'Trust Deed',
                                    memorandum: 'Memorandum of Association',
                                    board_resolution: 'Board Resolution',
                                    annual_report: 'Annual Report',
                                    tax_exemption: 'Tax Exemption Certificate',
                                  };
                                  const isUploaded = !!doc.fileUrl;
                                  const statusColor = doc.status === 'verified' ? 'green' : doc.status === 'checker_verified' ? 'blue' : doc.status === 'maker_verified' ? 'yellow' : doc.status === 'rejected' ? 'red' : 'gray';
                                  const statusBg = { green: 'bg-green-100', blue: 'bg-blue-100', yellow: 'bg-yellow-100', red: 'bg-red-100', gray: 'bg-gray-200' }[statusColor];
                                  const iconColor = { green: 'text-green-600', blue: 'text-blue-600', yellow: 'text-yellow-600', red: 'text-red-600', gray: 'text-gray-400' }[statusColor];
                                  const statusLabel = { pending: 'Awaiting upload', maker_verified: 'Maker verified', checker_verified: 'Checker verified', verified: 'Fully verified', rejected: 'Rejected' }[doc.status as string] ?? doc.status;
                                  return (
                                    <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border bg-gray-50 hover:bg-gray-100 transition-colors" data-testid={`doc-row-${doc.documentType}`}>
                                      <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${statusBg}`}>
                                          <FileText className={`h-4 w-4 ${iconColor}`} />
                                        </div>
                                        <div>
                                          <p className="text-sm font-medium">{docLabelMap[doc.documentType] ?? (doc.documentType || '').replace(/_/g, ' ')}</p>
                                          <p className="text-xs text-gray-500">{statusLabel}</p>
                                          {doc.makerNotes && <p className="text-xs text-blue-600 mt-0.5">Note: {doc.makerNotes}</p>}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {isUploaded && (
                                          <Button size="sm" variant="outline" className="gap-1"
                                            onClick={() => window.open(doc.fileUrl, '_blank')}
                                            data-testid={`button-view-doc-${doc.documentType}`}
                                          >
                                            <Eye className="h-3 w-3" /> View
                                          </Button>
                                        )}
                                        {doc.status === 'pending' && (
                                          <Button size="sm" style={{ backgroundColor: BRAND.accent }} className="gap-1 text-white"
                                            onClick={() => makerVerifyKycMutation.mutate({ id: doc.id, notes: 'Document verified by maker' }, { onSuccess: () => refetchKycDocs() })}
                                            data-testid={`button-maker-verify-${doc.documentType}`}
                                          >
                                            <Check className="h-3 w-3" /> Maker ✓
                                          </Button>
                                        )}
                                        {doc.status === 'maker_verified' && (
                                          <Button size="sm" style={{ backgroundColor: BRAND.primary }} className="gap-1 text-white"
                                            onClick={() => checkerApproveKycMutation.mutate({ id: doc.id, notes: 'Document checker verified' }, { onSuccess: () => refetchKycDocs() })}
                                            data-testid={`button-checker-verify-${doc.documentType}`}
                                          >
                                            <Check className="h-3 w-3" /> Checker ✓
                                          </Button>
                                        )}
                                        {(doc.status === 'verified' || doc.status === 'checker_verified') && (
                                          <Badge className="bg-green-100 text-green-700 border-green-200">Verified</Badge>
                                        )}
                                        {doc.status === 'rejected' && (
                                          <Badge variant="destructive">Rejected</Badge>
                                        )}
                                        {!isUploaded && doc.status === 'pending' && (
                                          <Badge variant="outline" className="text-gray-500">Awaiting</Badge>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              )}
                              <div className="mt-3 flex items-center justify-between p-3 rounded-lg border-2 border-dashed" style={{ borderColor: `${BRAND.primary}40` }}>
                                <span className="text-sm text-gray-600">Request additional documents from applicant</span>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="gap-1" 
                                  onClick={() => {
                                    setDocumentRequestDialog({ open: true, onboarding: selectedOnboarding });
                                    setRequestedDocs([]);
                                    setDocumentRequestMessage('');
                                  }}
                                  data-testid="button-request-documents"
                                >
                                  <Upload className="h-3 w-3" /> Request Documents
                                </Button>
                              </div>
                            </div>

                            {/* Review History */}
                            {selectedOnboarding.reviewedAt && (
                              <div>
                                <h4 className="text-sm font-semibold mb-3" style={{ color: BRAND.primary }}>Review Information</h4>
                                <div className="bg-gray-50 rounded-lg p-4 text-sm">
                                  <div className="flex justify-between mb-2">
                                    <span className="text-gray-500">Reviewed At</span>
                                    <span className="font-medium">{formatDateTime(selectedOnboarding.reviewedAt)}</span>
                                  </div>
                                  {selectedOnboarding.reviewNotes && (
                                    <div className="mt-2 pt-2 border-t">
                                      <p className="text-gray-500 mb-1">Notes</p>
                                      <p className="text-gray-700">{selectedOnboarding.reviewNotes}</p>
                                    </div>
                                  )}
                                  {selectedOnboarding.rejectionReason && (
                                    <div className="mt-2 pt-2 border-t">
                                      <p className="text-gray-500 mb-1">Rejection Reason</p>
                                      <p className="text-red-600">{selectedOnboarding.rejectionReason}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Audit Trail */}
                            {onboardingHistory.length > 0 && (
                              <div>
                                <h4 className="text-sm font-semibold mb-3" style={{ color: BRAND.primary }}>Activity History</h4>
                                <div className="space-y-3">
                                  {onboardingHistory.map((log: any) => (
                                    <div key={log.id} className="flex items-start gap-3">
                                      <div className="w-2 h-2 rounded-full mt-2" style={{ backgroundColor: BRAND.accent }}></div>
                                      <div>
                                        <p className="text-sm font-medium capitalize">{(log.actionType || '').replace(/_/g, ' ')}</p>
                                        <p className="text-xs text-gray-500">{formatDateTime(log.createdAt)}</p>
                                        {log.notes && <p className="text-xs text-gray-600 mt-1">{log.notes}</p>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Actions */}
                            <div className="flex flex-wrap gap-3 pt-4 border-t">
                              {selectedOnboarding.status === 'pending' && (
                                <>
                                  <Button 
                                    onClick={() => setActionDialog({ open: true, type: 'approve', item: selectedOnboarding })} 
                                    style={{ backgroundColor: BRAND.accent }}
                                    data-testid="button-approve-detail"
                                  >
                                    <CheckCircle className="h-4 w-4 mr-2" /> Approve
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    onClick={() => setActionDialog({ open: true, type: 'reject', item: selectedOnboarding })}
                                    data-testid="button-reject-detail"
                                  >
                                    <XCircle className="h-4 w-4 mr-2" /> Reject
                                  </Button>
                                </>
                              )}
                              {selectedOnboarding.status === 'approved' && (
                                <Button 
                                  variant="destructive" 
                                  onClick={() => setActionDialog({ open: true, type: 'suspend-onboarding', item: selectedOnboarding })}
                                  data-testid="button-suspend-detail"
                                >
                                  <Ban className="h-4 w-4 mr-2" /> Suspend
                                </Button>
                              )}
                              {selectedOnboarding.status === 'suspended' && (
                                <Button 
                                  onClick={() => setActionDialog({ open: true, type: 'reinstate', item: selectedOnboarding })} 
                                  style={{ backgroundColor: BRAND.accent }}
                                  data-testid="button-reinstate-detail"
                                >
                                  <RotateCcw className="h-4 w-4 mr-2" /> Reinstate
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </div>
                    </>
                  )}

                  {/* KYC Verification Sub-Tab */}
                  {onboardingSubTab === 'kyc' && (
                    <div className="space-y-4">
                      {/* KYC Pipeline */}
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {[
                          { key: 'all', label: 'All', count: kycDocuments.length },
                          { key: 'pending', label: 'Pending', count: kycDocuments.filter((k: any) => k.status === 'pending').length, color: 'yellow' },
                          { key: 'maker_verified', label: 'Maker Verified', count: kycDocuments.filter((k: any) => k.status === 'maker_verified').length, color: 'blue' },
                          { key: 'approved', label: 'Approved', count: kycDocuments.filter((k: any) => k.status === 'approved').length, color: 'green' },
                          { key: 'rejected', label: 'Rejected', count: kycDocuments.filter((k: any) => k.status === 'rejected').length, color: 'red' }
                        ].map((stage) => (
                          <button
                            key={stage.key}
                            onClick={() => setKycStatusFilter(stage.key)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm whitespace-nowrap transition-all ${
                              kycStatusFilter === stage.key ? 'ring-2 ring-offset-1' : ''
                            }`}
                            style={{
                              borderColor: kycStatusFilter === stage.key ? BRAND.primary : '#e5e7eb',
                              backgroundColor: kycStatusFilter === stage.key ? `${BRAND.primary}10` : 'white'
                            }}
                            data-testid={`kyc-filter-${stage.key}`}
                          >
                            <span className="font-medium">{stage.label}</span>
                            <Badge variant="secondary" className="text-xs">{stage.count}</Badge>
                          </button>
                        ))}
                      </div>

                      {/* KYC List & Detail Panel */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2 space-y-2">
                          {kycDocuments.map((kyc: any) => (
                            <Card 
                              key={kyc.id} 
                              className={`cursor-pointer transition-all hover:shadow-md ${selectedKyc?.id === kyc.id ? 'ring-2' : ''}`}
                              style={{ borderColor: selectedKyc?.id === kyc.id ? BRAND.primary : undefined }}
                              onClick={() => setSelectedKyc(kyc)}
                              data-testid={`kyc-item-${kyc.id}`}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND.primary}10` }}>
                                      <FileText className="h-5 w-5" style={{ color: BRAND.primary }} />
                                    </div>
                                    <div>
                                      <p className="font-medium">{kyc.entityName}</p>
                                      <p className="text-xs text-gray-500">{formatEntityType(kyc.entityType)} - {kyc.documentType?.replace(/_/g, ' ')}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge className={
                                      kyc.status === 'approved' ? 'bg-green-100 text-green-700' :
                                      kyc.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                      kyc.status === 'maker_verified' ? 'bg-blue-100 text-blue-700' :
                                      'bg-yellow-100 text-yellow-700'
                                    }>
                                      {kyc.status === 'maker_verified' ? 'Awaiting Checker' : kyc.status?.replace(/_/g, ' ')}
                                    </Badge>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                          {kycDocuments.length === 0 && (
                            <div className="text-center py-8 text-gray-500">
                              No KYC documents found
                            </div>
                          )}
                        </div>

                        {/* KYC Detail Panel */}
                        {selectedKyc && (
                          <Card className="lg:col-span-1">
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-lg">KYC Details</CardTitle>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedKyc(null)}>
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-500">Entity</span>
                                  <span className="font-medium">{selectedKyc.entityName}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-500">Type</span>
                                  <span className="font-medium">{formatEntityType(selectedKyc.entityType)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-500">Document</span>
                                  <span className="font-medium capitalize">{selectedKyc.documentType?.replace(/_/g, ' ')}</span>
                                </div>
                                {selectedKyc.documentNumber && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Number</span>
                                    <span className="font-medium">{selectedKyc.documentNumber}</span>
                                  </div>
                                )}
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-500">Status</span>
                                  <Badge className={
                                    selectedKyc.status === 'approved' ? 'bg-green-100 text-green-700' :
                                    selectedKyc.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                    selectedKyc.status === 'maker_verified' ? 'bg-blue-100 text-blue-700' :
                                    'bg-yellow-100 text-yellow-700'
                                  }>
                                    {selectedKyc.status?.replace(/_/g, ' ')}
                                  </Badge>
                                </div>
                              </div>

                              {/* Maker-Checker Workflow Visualization */}
                              <div className="border rounded-lg p-3 space-y-2">
                                <p className="text-xs font-medium text-gray-500 uppercase">Verification Workflow</p>
                                <div className="flex items-center gap-2">
                                  <div className={`flex-1 p-2 rounded text-center text-xs ${
                                    selectedKyc.status !== 'pending' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                  }`}>
                                    <span className="font-medium">Maker</span>
                                    {selectedKyc.makerVerifiedAt && <p className="text-[10px]">✓ Verified</p>}
                                  </div>
                                  <ArrowRight className="h-4 w-4 text-gray-400" />
                                  <div className={`flex-1 p-2 rounded text-center text-xs ${
                                    selectedKyc.status === 'approved' ? 'bg-green-100 text-green-700' :
                                    selectedKyc.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                    selectedKyc.status === 'maker_verified' ? 'bg-blue-100 text-blue-700' :
                                    'bg-gray-100 text-gray-500'
                                  }`}>
                                    <span className="font-medium">Checker</span>
                                    {selectedKyc.checkerVerifiedAt && <p className="text-[10px]">✓ Complete</p>}
                                  </div>
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex flex-col gap-2 pt-2">
                                {selectedKyc.status === 'pending' && (
                                  <Button 
                                    className="w-full" 
                                    style={{ backgroundColor: BRAND.primary }}
                                    onClick={() => setActionDialog({ open: true, type: 'maker-verify-kyc', item: selectedKyc })}
                                    data-testid="button-maker-verify"
                                  >
                                    <CheckCircle className="h-4 w-4 mr-2" /> Maker Verify
                                  </Button>
                                )}
                                {selectedKyc.status === 'maker_verified' && (
                                  <>
                                    <Button 
                                      className="w-full" 
                                      style={{ backgroundColor: BRAND.accent }}
                                      onClick={() => setActionDialog({ open: true, type: 'checker-approve-kyc', item: selectedKyc })}
                                      data-testid="button-checker-approve"
                                    >
                                      <CheckCircle className="h-4 w-4 mr-2" /> Checker Approve
                                    </Button>
                                    <Button 
                                      variant="destructive" 
                                      className="w-full"
                                      onClick={() => setActionDialog({ open: true, type: 'reject-kyc', item: selectedKyc })}
                                      data-testid="button-reject-kyc"
                                    >
                                      <XCircle className="h-4 w-4 mr-2" /> Reject
                                    </Button>
                                  </>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Student Enrollments Sub-Tab */}
                  {onboardingSubTab === 'enrollments' && (
                    <div className="space-y-4">
                      {/* Payment Status Filter */}
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {[
                          { key: 'all', label: 'All Students', count: studentEnrollments.length },
                          { key: 'completed', label: 'Paid', count: studentEnrollments.filter((e: any) => e.paymentStatus === 'completed').length, color: 'green' },
                          { key: 'payment_pending', label: 'Payment Pending', count: studentEnrollments.filter((e: any) => e.paymentStatus === 'pending' || e.paymentStatus === 'payment_pending').length, color: 'yellow' },
                          { key: 'overdue', label: 'Overdue', count: studentEnrollments.filter((e: any) => e.paymentStatus === 'overdue').length, color: 'red' },
                          { key: 'waived', label: 'Waived', count: studentEnrollments.filter((e: any) => e.paymentStatus === 'waived').length, color: 'gray' }
                        ].map((stage) => (
                          <button
                            key={stage.key}
                            onClick={() => setEnrollmentStatusFilter(stage.key)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm whitespace-nowrap transition-all ${
                              enrollmentStatusFilter === stage.key ? 'ring-2 ring-offset-1' : ''
                            }`}
                            style={{
                              borderColor: enrollmentStatusFilter === stage.key ? BRAND.primary : '#e5e7eb',
                              backgroundColor: enrollmentStatusFilter === stage.key ? `${BRAND.primary}10` : 'white'
                            }}
                            data-testid={`enrollment-filter-${stage.key}`}
                          >
                            <span className="font-medium">{stage.label}</span>
                            <Badge variant="secondary" className="text-xs">{stage.count}</Badge>
                          </button>
                        ))}
                      </div>

                      {/* Enrollments Table */}
                      <Card>
                        <CardContent className="p-0">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-50 border-b">
                                <tr>
                                  <th className="text-left p-3 font-medium">Student</th>
                                  <th className="text-left p-3 font-medium">Institute</th>
                                  <th className="text-left p-3 font-medium">Class</th>
                                  <th className="text-left p-3 font-medium">Parent</th>
                                  <th className="text-left p-3 font-medium">Status</th>
                                  <th className="text-left p-3 font-medium">Payment</th>
                                  <th className="text-right p-3 font-medium">Fee</th>
                                  <th className="text-right p-3 font-medium">Paid</th>
                                </tr>
                              </thead>
                              <tbody>
                                {studentEnrollments.map((enrollment: any) => (
                                  <tr 
                                    key={enrollment.id} 
                                    className="border-b hover:bg-gray-50 cursor-pointer"
                                    onClick={() => setSelectedEnrollment(enrollment)}
                                    data-testid={`enrollment-row-${enrollment.id}`}
                                  >
                                    <td className="p-3 font-medium">{enrollment.studentName}</td>
                                    <td className="p-3 text-gray-600">{enrollment.instituteName}</td>
                                    <td className="p-3 text-gray-600">{enrollment.className} {enrollment.section}</td>
                                    <td className="p-3 text-gray-600">{enrollment.parentName}</td>
                                    <td className="p-3">
                                      <Badge className={
                                        enrollment.status === 'active' ? 'bg-green-100 text-green-700' :
                                        enrollment.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                                        enrollment.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-gray-100 text-gray-700'
                                      }>
                                        {enrollment.status}
                                      </Badge>
                                    </td>
                                    <td className="p-3">
                                      <Badge className={
                                        enrollment.paymentStatus === 'completed' ? 'bg-green-100 text-green-700' :
                                        enrollment.paymentStatus === 'overdue' ? 'bg-red-100 text-red-700' :
                                        enrollment.paymentStatus === 'waived' ? 'bg-gray-100 text-gray-700' :
                                        'bg-yellow-100 text-yellow-700'
                                      }>
                                        {enrollment.paymentStatus === 'payment_pending' ? 'Pending' : enrollment.paymentStatus}
                                      </Badge>
                                    </td>
                                    <td className="p-3 text-right font-medium">₹{enrollment.feeAmount?.toLocaleString() || 0}</td>
                                    <td className="p-3 text-right text-gray-600">₹{enrollment.paidAmount?.toLocaleString() || 0}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {studentEnrollments.length === 0 && (
                              <div className="text-center py-8 text-gray-500">
                                No student enrollments found
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Enrollment KYC Sub-Tab */}
                  {onboardingSubTab === 'enrollment-kyc' && (
                    <div className="space-y-4">
                      {/* Legend */}
                      <div className="flex flex-wrap gap-3 text-xs">
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-400 inline-block" /> Minor (&lt;18) — parent KYC + consent required</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Major (18+) — student KYC only</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> KYC Verified</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" /> Pending</span>
                      </div>

                      {/* Search */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
                          placeholder="Search by student or parent name…"
                          value={enrollmentKycSearchQuery}
                          onChange={e => setEnrollmentKycSearchQuery(e.target.value)}
                        />
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Left: Enrollment list */}
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Student Enrollments</CardTitle>
                          </CardHeader>
                          <CardContent className="p-0">
                            <div className="divide-y max-h-[520px] overflow-y-auto">
                              {enrollmentKycList
                                .filter((e: any) => {
                                  const q = enrollmentKycSearchQuery.toLowerCase();
                                  return !q || (e.student_name || '').toLowerCase().includes(q) || (e.parent_name || '').toLowerCase().includes(q);
                                })
                                .map((enr: any) => {
                                  const isMinor = enr.isMinor;
                                  const kycDocs: any[] = enr.kyc_docs || [];
                                  const verified = kycDocs.filter((d: any) => d.status === 'verified').length;
                                  const pending = kycDocs.filter((d: any) => d.status === 'pending').length;
                                  const consentOk = !isMinor || enr.consent_given;
                                  const kycComplete = isMinor
                                    ? kycDocs.length >= 3 && verified === kycDocs.length && enr.consent_given
                                    : kycDocs.length >= 2 && verified === kycDocs.length;
                                  const isSelected = selectedEnrollmentKyc?.id === enr.id;
                                  return (
                                    <div
                                      key={enr.id}
                                      className={`p-3 cursor-pointer hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50 border-l-4' : ''}`}
                                      style={{ borderLeftColor: isSelected ? BRAND.primary : 'transparent' }}
                                      onClick={() => setSelectedEnrollmentKyc(isSelected ? null : enr)}
                                      data-testid={`enrollment-kyc-row-${enr.id}`}
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                          <p className="font-medium text-sm truncate">{enr.student_name}</p>
                                          <p className="text-xs text-gray-500">{enr.parent_name ? `Parent: ${enr.parent_name}` : 'No parent linked'}</p>
                                          <p className="text-xs text-gray-400">{enr.institute_name} {enr.grade ? `· Grade ${enr.grade}` : ''}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-1 shrink-0">
                                          <Badge className={isMinor ? 'bg-orange-100 text-orange-700 text-[10px]' : 'bg-blue-100 text-blue-700 text-[10px]'}>
                                            {isMinor ? 'Minor' : 'Major'}
                                          </Badge>
                                          {kycComplete
                                            ? <Badge className="bg-green-100 text-green-700 text-[10px]">KYC ✓</Badge>
                                            : pending > 0
                                            ? <Badge className="bg-yellow-100 text-yellow-700 text-[10px]">{pending} pending</Badge>
                                            : <Badge className="bg-gray-100 text-gray-600 text-[10px]">No docs</Badge>
                                          }
                                          {isMinor && (
                                            <Badge className={consentOk ? 'bg-green-100 text-green-700 text-[10px]' : 'bg-red-100 text-red-700 text-[10px]'}>
                                              {consentOk ? 'Consent ✓' : 'Consent needed'}
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              {enrollmentKycList.length === 0 && (
                                <div className="text-center py-8 text-gray-400 text-sm">No enrollments found</div>
                              )}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Right: Detail panel */}
                        {selectedEnrollmentKyc ? (
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm font-medium">
                                {selectedEnrollmentKyc.student_name}
                                <Badge className={`ml-2 text-[10px] ${selectedEnrollmentKyc.isMinor ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                  {selectedEnrollmentKyc.isMinor ? 'Minor' : 'Major (18+)'}
                                </Badge>
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              {/* DOB row */}
                              <div className="p-3 rounded-lg bg-gray-50 border text-sm space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Date of Birth</span>
                                  <span className="font-medium">
                                    {selectedEnrollmentKyc.date_of_birth
                                      ? new Date(selectedEnrollmentKyc.date_of_birth).toLocaleDateString('en-IN')
                                      : <span className="text-yellow-600">Not set</span>}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Parent</span>
                                  <span className="font-medium">{selectedEnrollmentKyc.parent_name || '—'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Parent Email</span>
                                  <span className="font-medium">{selectedEnrollmentKyc.parent_email || '—'}</span>
                                </div>
                              </div>

                              {/* Consent block — only for minors */}
                              {selectedEnrollmentKyc.isMinor && (
                                <div className={`p-3 rounded-lg border text-sm ${selectedEnrollmentKyc.consent_given ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="font-medium">{selectedEnrollmentKyc.consent_given ? 'Parental Consent Received' : 'Parental Consent Required'}</p>
                                      {selectedEnrollmentKyc.consent_given && (
                                        <p className="text-xs text-gray-500 mt-1">
                                          By {selectedEnrollmentKyc.consent_given_by || 'parent'} on{' '}
                                          {selectedEnrollmentKyc.consent_given_at ? new Date(selectedEnrollmentKyc.consent_given_at).toLocaleDateString('en-IN') : '—'}
                                        </p>
                                      )}
                                    </div>
                                    {!selectedEnrollmentKyc.consent_given && (
                                      <Button
                                        size="sm"
                                        style={{ backgroundColor: BRAND.primary }}
                                        onClick={async () => {
                                          const by = prompt('Enter parent name who gave consent:');
                                          if (!by) return;
                                          await fetch(`/api/admin/enrollment/${selectedEnrollmentKyc.id}/consent`, {
                                            method: 'PATCH',
                                            headers: { 'Content-Type': 'application/json' },
                                            credentials: 'include',
                                            body: JSON.stringify({ consentGiven: true, consentGivenBy: by }),
                                          });
                                          refetchEnrollmentKyc();
                                          setSelectedEnrollmentKyc((prev: any) => ({ ...prev, consent_given: true, consent_given_by: by, consent_given_at: new Date().toISOString() }));
                                        }}
                                      >
                                        Mark Consent Given
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* KYC document list */}
                              <div>
                                <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                                  {selectedEnrollmentKyc.isMinor ? 'Required: Parent Identity Proof, PAN Card, Address Proof' : 'Required: Identity Proof, PAN Card'}
                                </p>
                                {(selectedEnrollmentKyc.kyc_docs || []).length === 0 ? (
                                  <p className="text-sm text-gray-400 text-center py-4">No documents uploaded yet</p>
                                ) : (
                                  <div className="space-y-2">
                                    {(selectedEnrollmentKyc.kyc_docs || []).map((doc: any) => (
                                      <div key={doc.id} className="flex items-center justify-between p-2 rounded-lg border text-sm">
                                        <div>
                                          <p className="font-medium capitalize">{(doc.documentType || '').replace(/_/g, ' ')}</p>
                                          <p className="text-xs text-gray-400">by {doc.submittedBy}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {doc.fileUrl && (
                                            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline">View</a>
                                          )}
                                          <Badge className={
                                            doc.status === 'verified' ? 'bg-green-100 text-green-700 text-[10px]' :
                                            doc.status === 'rejected' ? 'bg-red-100 text-red-700 text-[10px]' :
                                            'bg-yellow-100 text-yellow-700 text-[10px]'
                                          }>
                                            {doc.status}
                                          </Badge>
                                          {doc.status === 'pending' && (
                                            <div className="flex gap-1">
                                              <Button size="sm" variant="outline" className="h-6 text-[10px] text-green-700 border-green-200"
                                                onClick={async () => {
                                                  await fetch(`/api/admin/enrollment-kyc/doc/${doc.id}/verify`, {
                                                    method: 'PATCH',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    credentials: 'include',
                                                    body: JSON.stringify({ action: 'approve' }),
                                                  });
                                                  refetchEnrollmentKyc();
                                                  setSelectedEnrollmentKyc((prev: any) => ({
                                                    ...prev,
                                                    kyc_docs: prev.kyc_docs.map((d: any) => d.id === doc.id ? { ...d, status: 'verified' } : d)
                                                  }));
                                                }}
                                              >✓ Approve</Button>
                                              <Button size="sm" variant="outline" className="h-6 text-[10px] text-red-700 border-red-200"
                                                onClick={async () => {
                                                  await fetch(`/api/admin/enrollment-kyc/doc/${doc.id}/verify`, {
                                                    method: 'PATCH',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    credentials: 'include',
                                                    body: JSON.stringify({ action: 'reject' }),
                                                  });
                                                  refetchEnrollmentKyc();
                                                  setSelectedEnrollmentKyc((prev: any) => ({
                                                    ...prev,
                                                    kyc_docs: prev.kyc_docs.map((d: any) => d.id === doc.id ? { ...d, status: 'rejected' } : d)
                                                  }));
                                                }}
                                              >✗ Reject</Button>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ) : (
                          <div className="flex items-center justify-center h-48 text-gray-400 text-sm border-2 border-dashed rounded-xl">
                            Select a student to view KYC details
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Mentor Pipeline Sub-Tab */}
                  {onboardingSubTab === 'mentor-pipeline' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide">Mentor Onboarding Pipeline — {mentorPipelineList.length} mentors</p>
                        <button onClick={() => refetchMentorPipeline()} className="text-xs font-medium text-[#5F6C80] border border-[#E2E8F0] px-3 py-1.5 rounded-lg hover:bg-[#F5F7FA] transition-colors">Refresh</button>
                      </div>

                      {/* Stage Pipeline Visual */}
                      {(() => {
                        const stages = [
                          { key: 'application',  label: 'Application',   color: '#9AA4B2' },
                          { key: 'training',     label: 'Training',      color: '#F59E0B' },
                          { key: 'assessment',   label: 'Assessment',    color: '#6366F1' },
                          { key: 'kyc',          label: 'KYC',           color: '#0EA5E9' },
                          { key: 'profiler',     label: 'Profiler',      color: '#8B5CF6' },
                          { key: 'active',       label: 'Active',        color: '#059669' },
                        ];
                        return (
                          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
                            <div className="flex items-center gap-0 overflow-x-auto">
                              {stages.map((s, i) => {
                                const count = mentorPipelineList.filter((m: any) => (m.onboardingStage || 'application') === s.key).length;
                                return (
                                  <React.Fragment key={s.key}>
                                    <div className="flex flex-col items-center flex-shrink-0 min-w-[80px]">
                                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: s.color }}>
                                        {count}
                                      </div>
                                      <p className="text-[11px] font-medium text-[#5F6C80] mt-1.5 text-center">{s.label}</p>
                                    </div>
                                    {i < stages.length - 1 && (
                                      <div className="flex-1 h-0.5 bg-[#E2E8F0] mx-2 mt-[-14px] min-w-[24px]" />
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Mentor table */}
                      {mentorPipelineList.length === 0 ? (
                        <div className="py-16 text-center text-sm text-[#9AA4B2] rounded-xl border border-dashed border-[#E2E8F0] bg-white">No mentor data available</div>
                      ) : (
                        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                                <th className="text-left text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide px-4 py-3">Mentor</th>
                                <th className="text-left text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide px-4 py-3">Platform ID</th>
                                <th className="text-left text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide px-4 py-3">Specialization</th>
                                <th className="text-left text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide px-4 py-3">Onboarding Stage</th>
                                <th className="text-left text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide px-4 py-3">KYC Status</th>
                                <th className="text-left text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide px-4 py-3">Agreement</th>
                                <th className="text-left text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide px-4 py-3">Profile</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#F1F5F9]">
                              {mentorPipelineList.map((m: any) => {
                                const stageColor: Record<string, string> = {
                                  application: '#9AA4B2', training: '#F59E0B', assessment: '#6366F1',
                                  kyc: '#0EA5E9', profiler: '#8B5CF6', active: '#059669',
                                };
                                const stage = m.onboardingStage || 'application';
                                return (
                                  <tr key={m.id} className="hover:bg-[#F8FAFC] transition-colors cursor-pointer" onClick={() => { setActiveTab('mentors'); }}>
                                    <td className="px-4 py-3">
                                      <p className="font-medium text-[#2E3440]">{m.displayName || m.full_name || m.name}</p>
                                      <p className="text-xs text-[#9AA4B2]">{m.email}</p>
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs text-[#5F6C80]">{m.mentorCode || m.platform_id || '—'}</td>
                                    <td className="px-4 py-3 text-[#5F6C80] text-xs">{m.specialization || '—'}</td>
                                    <td className="px-4 py-3">
                                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize text-white" style={{ backgroundColor: stageColor[stage] || '#9AA4B2' }}>
                                        {stage}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">{getStatusBadge(m.kycStatus || 'pending')}</td>
                                    <td className="px-4 py-3">
                                      <span className={`text-xs font-medium capitalize ${m.agreementStatus === 'completed' ? 'text-emerald-600' : m.agreementStatus === 'sent' ? 'text-amber-600' : 'text-[#9AA4B2]'}`}>
                                        {m.agreementStatus || 'not sent'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">{getStatusBadge(m.status || 'inactive')}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              )}

    </>
  );
}
