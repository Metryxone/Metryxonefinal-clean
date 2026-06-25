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

export default function HRPanel() {
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
                <div className="space-y-6">
                  {/* HR Stats Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card data-testid="hr-stat-published-jobs">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${BRAND.accent}15` }}>
                            <Briefcase className="h-5 w-5" style={{ color: BRAND.accent }} />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Published Jobs</p>
                            <p className="text-xl font-bold" style={{ color: BRAND.primary }}>
                              {jobs.filter((j: any) => j.status === 'published').length}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card data-testid="hr-stat-pending-review">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-orange-50">
                            <Clock className="h-5 w-5 text-orange-500" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Pending Review</p>
                            <p className="text-xl font-bold" style={{ color: BRAND.primary }}>
                              {jobs.filter((j: any) => ['hr_review', 'legal_review', 'leadership_approval'].includes(j.status)).length}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card data-testid="hr-stat-applications">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${BRAND.cyan}15` }}>
                            <Users className="h-5 w-5" style={{ color: BRAND.cyan }} />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">New Applications</p>
                            <p className="text-xl font-bold" style={{ color: BRAND.primary }}>
                              {Array.isArray(applications) ? applications.filter((a: any) => a.status === 'applied').length : 0}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card data-testid="hr-stat-active-mentors">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-green-50">
                            <GraduationCap className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Active Mentors</p>
                            <p className="text-xl font-bold" style={{ color: BRAND.primary }}>
                              {mentors.filter((m: any) => m.status === 'active').length}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* HR Sub-Tabs */}
                  <div className="flex items-center gap-2 border-b pb-2">
                    {[
                      { id: 'jobs', label: 'Job Postings', icon: Briefcase },
                      { id: 'applicants', label: 'Applicants', icon: Users },
                      { id: 'mentors', label: 'Mentors', icon: GraduationCap }
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setHrSubTab(tab.id as any)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                          hrSubTab === tab.id 
                            ? 'bg-white shadow-sm font-medium' 
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                        style={hrSubTab === tab.id ? { color: BRAND.primary } : {}}
                        data-testid={`hr-subtab-${tab.id}`}
                      >
                        <tab.icon className="h-4 w-4" />
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Jobs Sub-Tab */}
                  {hrSubTab === 'jobs' && (
                    <div className="space-y-4">
                      {/* Filters Bar */}
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex flex-wrap gap-4 items-center">
                            <div className="flex-1 min-w-[200px]">
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                  placeholder="Search jobs by title..."
                                  value={searchQuery}
                                  onChange={(e) => setSearchQuery(e.target.value)}
                                  className="pl-10"
                                  data-testid="input-job-search"
                                />
                              </div>
                            </div>
                            <Select value={jobStatusFilter} onValueChange={setJobStatusFilter}>
                              <SelectTrigger className="w-[180px]" data-testid="select-job-status-filter">
                                <Filter className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="Filter by status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="hr_review">HR Review</SelectItem>
                                <SelectItem value="legal_review">Legal Review</SelectItem>
                                <SelectItem value="leadership_approval">Leadership Approval</SelectItem>
                                <SelectItem value="approved">Approved</SelectItem>
                                <SelectItem value="published">Published</SelectItem>
                                <SelectItem value="closed">Closed</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button variant="outline" onClick={() => refetchJobs()} data-testid="button-refresh-jobs">
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            <Button onClick={() => setActionDialog({ open: true, type: 'create-job', item: null })} style={{ backgroundColor: BRAND.primary }} data-testid="button-create-job">
                              <Plus className="h-4 w-4 mr-2" /> Create Job
                            </Button>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Workflow Pipeline Visualization */}
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            {[
                              { status: 'draft', label: 'Draft', icon: FileText },
                              { status: 'hr_review', label: 'HR Review', icon: Users },
                              { status: 'legal_review', label: 'Legal', icon: Scale },
                              { status: 'leadership_approval', label: 'Leadership', icon: Shield },
                              { status: 'approved', label: 'Approved', icon: CheckCircle },
                              { status: 'published', label: 'Published', icon: Globe },
                              { status: 'closed', label: 'Closed', icon: XCircle }
                            ].map((stage, i, arr) => {
                              const count = jobs.filter((j: any) => j.status === stage.status).length;
                              return (
                                <div key={stage.status} className="flex items-center">
                                  <button
                                    onClick={() => setJobStatusFilter(jobStatusFilter === stage.status ? 'all' : stage.status)}
                                    className={`flex flex-col items-center p-2 rounded-lg transition-all ${jobStatusFilter === stage.status ? 'bg-blue-50 ring-2 ring-blue-500' : 'hover:bg-gray-50'}`}
                                  >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${count > 0 ? 'bg-blue-100' : 'bg-gray-100'}`}>
                                      <stage.icon className={`h-5 w-5 ${count > 0 ? 'text-blue-600' : 'text-gray-400'}`} />
                                    </div>
                                    <span className="text-xs mt-1 font-medium" style={{ color: count > 0 ? BRAND.primary : '#9ca3af' }}>{stage.label}</span>
                                    <span className="text-lg font-bold" style={{ color: count > 0 ? BRAND.primary : '#9ca3af' }}>{count}</span>
                                  </button>
                                  {i < arr.length - 1 && (
                                    <ChevronRight className="h-5 w-5 text-gray-300 mx-1" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Jobs List with Detail Panel */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Jobs List */}
                        <div className={selectedJob ? 'lg:col-span-1' : 'lg:col-span-3'}>
                          <Card>
                            <CardHeader className="border-b py-3">
                              <CardTitle className="text-base">Job Postings ({jobs.filter((j: any) => {
                                const matchesSearch = !searchQuery || j.title.toLowerCase().includes(searchQuery.toLowerCase());
                                const matchesStatus = jobStatusFilter === 'all' || j.status === jobStatusFilter;
                                return matchesSearch && matchesStatus;
                              }).length})</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0 max-h-[600px] overflow-y-auto">
                              <div className="divide-y">
                                {jobs
                                  .filter((j: any) => {
                                    const matchesSearch = !searchQuery || j.title.toLowerCase().includes(searchQuery.toLowerCase());
                                    const matchesStatus = jobStatusFilter === 'all' || j.status === jobStatusFilter;
                                    return matchesSearch && matchesStatus;
                                  })
                                  .map((job: any) => {
                                    const isSelected = selectedJob?.id === job.id;
                                    const appCount = applications?.filter((a: any) => a.jobId === job.id).length || 0;
                                    return (
                                      <div 
                                        key={job.id} 
                                        className={`p-4 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 border-l-4' : 'hover:bg-gray-50'}`}
                                        style={{ borderLeftColor: isSelected ? BRAND.primary : 'transparent' }}
                                        onClick={() => setSelectedJob(job)}
                                        data-testid={`job-row-${job.id}`}
                                      >
                                        <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${BRAND.cyan}15` }}>
                                            <Briefcase className="h-5 w-5" style={{ color: BRAND.cyan }} />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                              <p className="font-medium text-sm truncate" style={{ color: BRAND.primary }}>{job.title}</p>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                              {getStatusBadge(job.status)}
                                              {appCount > 0 && (
                                                <Badge variant="outline" className="text-xs">
                                                  <Users className="h-3 w-3 mr-1" />{appCount} apps
                                                </Badge>
                                              )}
                                            </div>
                                            <p className="text-xs text-gray-400 mt-1">{job.roleCategory} • {job.employmentType}</p>
                                          </div>
                                          <ChevronRight className="h-4 w-4 text-gray-400" />
                                        </div>
                                      </div>
                                    );
                                  })}
                                {jobs.length === 0 && (
                                  <div className="p-8 text-center text-gray-500">No job postings found.</div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Job Detail Panel */}
                        {selectedJob && (
                          <div className="lg:col-span-2">
                            <Card>
                              <CardHeader className="border-b">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${BRAND.accent}15` }}>
                                      <Briefcase className="h-7 w-7" style={{ color: BRAND.accent }} />
                                    </div>
                                    <div>
                                      <CardTitle>{selectedJob.title}</CardTitle>
                                      <div className="flex items-center gap-2 mt-1">
                                        {getStatusBadge(selectedJob.status)}
                                        <span className="text-sm text-gray-500">{selectedJob.roleCategory} • {selectedJob.employmentType} • {selectedJob.workMode}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <Button variant="ghost" size="sm" onClick={() => setSelectedJob(null)}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>

                                {/* Workflow Stage Indicator */}
                                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                                  <p className="text-xs text-gray-500 mb-2">Workflow Progress</p>
                                  <div className="flex items-center gap-1">
                                    {['draft', 'hr_review', 'legal_review', 'leadership_approval', 'approved', 'published'].map((stage, i, arr) => {
                                      const stages = ['draft', 'hr_review', 'legal_review', 'leadership_approval', 'approved', 'published', 'closed'];
                                      const currentIndex = stages.indexOf(selectedJob.status);
                                      const stageIndex = stages.indexOf(stage);
                                      const isPast = stageIndex < currentIndex;
                                      const isCurrent = stage === selectedJob.status;
                                      return (
                                        <div key={stage} className="flex items-center flex-1">
                                          <div className={`flex-1 h-2 rounded-full ${isPast || isCurrent ? 'bg-green-500' : 'bg-gray-200'}`} />
                                          {i < arr.length - 1 && <div className="w-1" />}
                                        </div>
                                      );
                                    })}
                                  </div>
                                  <div className="flex justify-between mt-1">
                                    <span className="text-xs text-gray-400">Draft</span>
                                    <span className="text-xs text-gray-400">Published</span>
                                  </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex flex-wrap gap-2 mt-4">
                                  {selectedJob.status === 'draft' && (
                                    <>
                                      <Button size="sm" onClick={() => submitJobMutation.mutate(selectedJob.id)} style={{ backgroundColor: BRAND.primary }} data-testid="button-submit-detail">
                                        <Upload className="h-4 w-4 mr-1" /> Submit for Review
                                      </Button>
                                      <Button size="sm" variant="outline" onClick={() => setActionDialog({ open: true, type: 'edit-job', item: selectedJob })} data-testid="button-edit-job">
                                        <Edit className="h-4 w-4 mr-1" /> Edit
                                      </Button>
                                    </>
                                  )}
                                  {selectedJob.status === 'hr_review' && (
                                    <>
                                      <Button size="sm" onClick={() => approveJobStageMutation.mutate(selectedJob.id)} style={{ backgroundColor: BRAND.accent }} data-testid="button-hr-approve-detail">
                                        <CheckCircle className="h-4 w-4 mr-1" /> HR Approve
                                      </Button>
                                      <Button size="sm" variant="destructive" onClick={() => setActionDialog({ open: true, type: 'reject-job', item: selectedJob })} data-testid="button-hr-reject-detail">
                                        <XCircle className="h-4 w-4 mr-1" /> Reject
                                      </Button>
                                    </>
                                  )}
                                  {selectedJob.status === 'legal_review' && (
                                    <>
                                      <Button size="sm" onClick={() => approveJobStageMutation.mutate(selectedJob.id)} style={{ backgroundColor: BRAND.accent }} data-testid="button-legal-approve-detail">
                                        <Scale className="h-4 w-4 mr-1" /> Legal Approve
                                      </Button>
                                      <Button size="sm" variant="destructive" onClick={() => setActionDialog({ open: true, type: 'reject-job', item: selectedJob })} data-testid="button-legal-reject-detail">
                                        <XCircle className="h-4 w-4 mr-1" /> Reject
                                      </Button>
                                    </>
                                  )}
                                  {selectedJob.status === 'leadership_approval' && (
                                    <>
                                      <Button size="sm" onClick={() => approveJobStageMutation.mutate(selectedJob.id)} style={{ backgroundColor: BRAND.accent }} data-testid="button-leadership-approve-detail">
                                        <Shield className="h-4 w-4 mr-1" /> Leadership Approve
                                      </Button>
                                      <Button size="sm" variant="destructive" onClick={() => setActionDialog({ open: true, type: 'reject-job', item: selectedJob })} data-testid="button-leadership-reject-detail">
                                        <XCircle className="h-4 w-4 mr-1" /> Reject
                                      </Button>
                                    </>
                                  )}
                                  {selectedJob.status === 'approved' && (
                                    <Button size="sm" onClick={() => publishJobMutation.mutate(selectedJob.id)} style={{ backgroundColor: '#22c55e' }} data-testid="button-publish-detail">
                                      <Globe className="h-4 w-4 mr-1" /> Publish to Careers
                                    </Button>
                                  )}
                                  {selectedJob.status === 'published' && (
                                    <Button size="sm" variant="destructive" onClick={() => closeJobMutation.mutate(selectedJob.id)} data-testid="button-close-detail">
                                      <XCircle className="h-4 w-4 mr-1" /> Close Position
                                    </Button>
                                  )}
                                </div>

                                {/* Share & Copy Link Section */}
                                {selectedJob.status === 'published' && (() => {
                                  const jobUrl = `${window.location.origin}/careers?job=${selectedJob.id}`;
                                  const shareText = `We're hiring! ${selectedJob.title} (${selectedJob.roleCategory}, ${selectedJob.employmentType}, ${selectedJob.workMode}) at MetryxOne. Apply now:`;

                                  return (
                                    <div className="mt-4 p-3 rounded-lg border" style={{ borderColor: `${BRAND.accent}40`, backgroundColor: `${BRAND.accent}05` }}>
                                      <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
                                        <Globe className="h-3.5 w-3.5" style={{ color: BRAND.primary }} />
                                        Share This Job
                                      </p>
                                      <div className="flex items-center gap-2 mb-3">
                                        <input
                                          readOnly
                                          value={jobUrl}
                                          className="flex-1 text-xs px-3 py-1.5 rounded-lg border bg-white text-gray-600 truncate"
                                          onClick={(e) => (e.target as HTMLInputElement).select()}
                                        />
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-8 px-3 text-xs shrink-0"
                                          onClick={() => {
                                            navigator.clipboard.writeText(jobUrl);
                                            toast({ title: 'Link Copied!', description: 'Job link copied to clipboard' });
                                          }}
                                          data-testid="button-copy-job-link"
                                        >
                                          <Download className="h-3.5 w-3.5 mr-1" /> Copy Link
                                        </Button>
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        <Button size="sm" className="h-7 px-3 text-xs text-white" style={{ backgroundColor: '#25D366' }}
                                          onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`${shareText} ${jobUrl}`)}`, '_blank')}>
                                          <Smartphone className="h-3.5 w-3.5 mr-1" /> WhatsApp
                                        </Button>
                                        <Button size="sm" className="h-7 px-3 text-xs text-white" style={{ backgroundColor: '#1877F2' }}
                                          onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(jobUrl)}&quote=${encodeURIComponent(shareText)}`, '_blank', 'width=600,height=400')}>
                                          <Globe className="h-3.5 w-3.5 mr-1" /> Facebook
                                        </Button>
                                        <Button size="sm" className="h-7 px-3 text-xs text-white" style={{ backgroundColor: '#0A66C2' }}
                                          onClick={() => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(jobUrl)}`, '_blank', 'width=600,height=400')}>
                                          <Briefcase className="h-3.5 w-3.5 mr-1" /> LinkedIn
                                        </Button>
                                        <Button size="sm" className="h-7 px-3 text-xs text-white" style={{ backgroundColor: '#000000' }}
                                          onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${shareText} ${jobUrl}`)}`, '_blank', 'width=600,height=400')}>
                                          <Send className="h-3.5 w-3.5 mr-1" /> X / Twitter
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                })()}
                              </CardHeader>

                              <CardContent className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
                                {/* Job Details */}
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <p className="text-xs text-gray-500">Eligibility</p>
                                    <p className="text-sm">{selectedJob.eligibility}</p>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-xs text-gray-500">Qualifications</p>
                                    <p className="text-sm">{selectedJob.qualifications}</p>
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-xs text-gray-500">Responsibilities</p>
                                  <p className="text-sm">{selectedJob.responsibilities}</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-xs text-gray-500">KPIs / Performance Metrics</p>
                                  <p className="text-sm">{selectedJob.kpis}</p>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-xs text-gray-500">Compensation Model</p>
                                  <p className="text-sm font-medium" style={{ color: BRAND.accent }}>{selectedJob.compensationModel}</p>
                                </div>

                                {/* Review History */}
                                {(selectedJob.hrReviewAt || selectedJob.legalReviewAt || selectedJob.leadershipApprovalAt) && (
                                  <div className="border-t pt-4">
                                    <p className="text-xs text-gray-500 mb-3">Approval History</p>
                                    <div className="space-y-2">
                                      {selectedJob.hrReviewAt && (
                                        <div className="flex items-center gap-3 p-2 bg-green-50 rounded-lg">
                                          <CheckCircle className="h-4 w-4 text-green-600" />
                                          <div>
                                            <p className="text-sm font-medium">HR Review Approved</p>
                                            <p className="text-xs text-gray-500">{formatDate(selectedJob.hrReviewAt)}</p>
                                          </div>
                                        </div>
                                      )}
                                      {selectedJob.legalReviewAt && (
                                        <div className="flex items-center gap-3 p-2 bg-green-50 rounded-lg">
                                          <Scale className="h-4 w-4 text-green-600" />
                                          <div>
                                            <p className="text-sm font-medium">Legal Review Approved</p>
                                            <p className="text-xs text-gray-500">{formatDate(selectedJob.legalReviewAt)}</p>
                                          </div>
                                        </div>
                                      )}
                                      {selectedJob.leadershipApprovalAt && (
                                        <div className="flex items-center gap-3 p-2 bg-green-50 rounded-lg">
                                          <Shield className="h-4 w-4 text-green-600" />
                                          <div>
                                            <p className="text-sm font-medium">Leadership Approved</p>
                                            <p className="text-xs text-gray-500">{formatDate(selectedJob.leadershipApprovalAt)}</p>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Applications for this job */}
                                <div className="border-t pt-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <p className="text-xs text-gray-500">Applications ({applications?.filter((a: any) => a.jobId === selectedJob.id).length || 0})</p>
                                    <Button size="sm" variant="ghost" onClick={() => { setHrSubTab('applicants'); setSelectedJob(null); }}>
                                      View All <ChevronRight className="h-4 w-4 ml-1" />
                                    </Button>
                                  </div>
                                  <div className="space-y-2">
                                    {applications?.filter((a: any) => a.jobId === selectedJob.id).slice(0, 3).map((app: any) => (
                                      <div key={app.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                        <div className="flex items-center gap-2">
                                          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-100">
                                            <Users className="h-4 w-4 text-blue-600" />
                                          </div>
                                          <div>
                                            <p className="text-sm font-medium">{app.fullName}</p>
                                            <p className="text-xs text-gray-500">{app.email}</p>
                                          </div>
                                        </div>
                                        {getStatusBadge(app.status)}
                                      </div>
                                    ))}
                                    {applications?.filter((a: any) => a.jobId === selectedJob.id).length === 0 && (
                                      <p className="text-sm text-gray-400 text-center py-2">No applications yet</p>
                                    )}
                                  </div>
                                </div>

                                {/* Timestamps */}
                                <div className="border-t pt-4 grid grid-cols-2 gap-4 text-xs text-gray-500">
                                  <div>Created: {formatDate(selectedJob.createdAt)}</div>
                                  <div>Updated: {formatDate(selectedJob.updatedAt)}</div>
                                  {selectedJob.publishedAt && <div>Published: {formatDate(selectedJob.publishedAt)}</div>}
                                  {selectedJob.closedAt && <div>Closed: {formatDate(selectedJob.closedAt)}</div>}
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Applicants Sub-Tab */}
                  {hrSubTab === 'applicants' && (
                    <div className="space-y-4">
                      {/* Filters Bar */}
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex flex-wrap gap-4 items-center">
                            <div className="flex-1 min-w-[200px]">
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                  placeholder="Search applicants by name or email..."
                                  value={searchQuery}
                                  onChange={(e) => setSearchQuery(e.target.value)}
                                  className="pl-10"
                                  data-testid="input-applicant-search"
                                />
                              </div>
                            </div>
                            <Select value={applicationStatusFilter} onValueChange={setApplicationStatusFilter}>
                              <SelectTrigger className="w-[180px]" data-testid="select-application-status-filter">
                                <Filter className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="Filter by status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="applied">Applied</SelectItem>
                                <SelectItem value="shortlisted">Shortlisted</SelectItem>
                                <SelectItem value="payment_pending">Payment Pending</SelectItem>
                                <SelectItem value="training">Training</SelectItem>
                                <SelectItem value="assessment">Assessment</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button variant="outline" onClick={() => refetchApplications()} data-testid="button-refresh-applications">
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Application Pipeline */}
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            {[
                              { status: 'applied', label: 'Applied', icon: FileText, color: '#3b82f6' },
                              { status: 'shortlisted', label: 'Shortlisted', icon: UserCheck, color: '#22c55e' },
                              { status: 'payment_pending', label: 'Payment', icon: CreditCard, color: '#f59e0b' },
                              { status: 'training', label: 'Training', icon: BookOpen, color: '#8b5cf6' },
                              { status: 'assessment', label: 'Assessment', icon: ClipboardList, color: '#ec4899' },
                              { status: 'active', label: 'Active', icon: CheckCircle, color: '#22c55e' },
                              { status: 'rejected', label: 'Rejected', icon: XCircle, color: '#ef4444' }
                            ].map((stage, i, arr) => {
                              const count = (applications || []).filter((a: any) => a.status === stage.status).length;
                              return (
                                <div key={stage.status} className="flex items-center">
                                  <button
                                    onClick={() => setApplicationStatusFilter(applicationStatusFilter === stage.status ? 'all' : stage.status)}
                                    className={`flex flex-col items-center p-2 rounded-lg transition-all ${applicationStatusFilter === stage.status ? 'bg-blue-50 ring-2 ring-blue-500' : 'hover:bg-gray-50'}`}
                                  >
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${stage.color}20` }}>
                                      <stage.icon className="h-4 w-4" style={{ color: stage.color }} />
                                    </div>
                                    <span className="text-xs mt-1">{stage.label}</span>
                                    <span className="text-sm font-bold" style={{ color: count > 0 ? stage.color : '#9ca3af' }}>{count}</span>
                                  </button>
                                  {i < arr.length - 1 && stage.status !== 'rejected' && (
                                    <ChevronRight className="h-4 w-4 text-gray-300 mx-1" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Applications List with Detail Panel */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Applications List */}
                        <div className={selectedApplication ? 'lg:col-span-1' : 'lg:col-span-3'}>
                          <Card>
                            <CardHeader className="border-b py-3">
                              <CardTitle className="text-base">Applications ({(applications || []).filter((a: any) => {
                                const matchesSearch = !searchQuery || 
                                  a.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                  a.email.toLowerCase().includes(searchQuery.toLowerCase());
                                const matchesStatus = applicationStatusFilter === 'all' || a.status === applicationStatusFilter;
                                return matchesSearch && matchesStatus;
                              }).length})</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0 max-h-[600px] overflow-y-auto">
                              <div className="divide-y">
                                {(applications || [])
                                  .filter((a: any) => {
                                    const matchesSearch = !searchQuery || 
                                      a.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                      a.email.toLowerCase().includes(searchQuery.toLowerCase());
                                    const matchesStatus = applicationStatusFilter === 'all' || a.status === applicationStatusFilter;
                                    return matchesSearch && matchesStatus;
                                  })
                                  .map((app: any) => {
                                    const isSelected = selectedApplication?.id === app.id;
                                    const job = jobs.find((j: any) => j.id === app.jobId);
                                    return (
                                      <div 
                                        key={app.id} 
                                        className={`p-4 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 border-l-4' : 'hover:bg-gray-50'}`}
                                        style={{ borderLeftColor: isSelected ? BRAND.primary : 'transparent' }}
                                        onClick={() => setSelectedApplication(app)}
                                        data-testid={`application-row-${app.id}`}
                                      >
                                        <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${BRAND.cyan}15` }}>
                                            <Users className="h-5 w-5" style={{ color: BRAND.cyan }} />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                              <p className="font-medium text-sm truncate" style={{ color: BRAND.primary }}>{app.fullName}</p>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                              {getStatusBadge(app.status)}
                                            </div>
                                            <p className="text-xs text-gray-400 mt-1 truncate">{job?.title || 'Unknown Job'}</p>
                                          </div>
                                          <ChevronRight className="h-4 w-4 text-gray-400" />
                                        </div>
                                      </div>
                                    );
                                  })}
                                {(!applications || applications.length === 0) && (
                                  <div className="p-8 text-center text-gray-500">No applications found.</div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Application Detail Panel */}
                        {selectedApplication && (
                          <div className="lg:col-span-2">
                            <Card>
                              <CardHeader className="border-b">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: `${BRAND.accent}15` }}>
                                      <Users className="h-7 w-7" style={{ color: BRAND.accent }} />
                                    </div>
                                    <div>
                                      <CardTitle>{selectedApplication.fullName}</CardTitle>
                                      <div className="flex items-center gap-2 mt-1">
                                        {getStatusBadge(selectedApplication.status)}
                                        <span className="text-sm text-gray-500">{selectedApplication.email}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <Button variant="ghost" size="sm" onClick={() => setSelectedApplication(null)}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex flex-wrap gap-2 mt-4">
                                  {selectedApplication.status === 'applied' && (
                                    <>
                                      <Button size="sm" onClick={() => shortlistApplicationMutation.mutate(selectedApplication.id)} style={{ backgroundColor: BRAND.accent }} data-testid="button-shortlist-detail">
                                        <UserCheck className="h-4 w-4 mr-1" /> Shortlist Candidate
                                      </Button>
                                      <Button size="sm" variant="destructive" onClick={() => setActionDialog({ open: true, type: 'reject-application', item: selectedApplication })} data-testid="button-reject-detail">
                                        <XCircle className="h-4 w-4 mr-1" /> Reject
                                      </Button>
                                    </>
                                  )}
                                  {selectedApplication.status === 'shortlisted' && (
                                    <>
                                      <Button size="sm" style={{ backgroundColor: '#f59e0b' }} data-testid="button-request-payment"
                                        onClick={() => advanceApplicationMutation.mutate({ id: selectedApplication.id, action: 'request-payment' })}>
                                        <CreditCard className="h-4 w-4 mr-1" /> Request Payment
                                      </Button>
                                      <Button size="sm" variant="destructive" onClick={() => setActionDialog({ open: true, type: 'reject-application', item: selectedApplication })} data-testid="button-reject-shortlisted">
                                        <XCircle className="h-4 w-4 mr-1" /> Reject
                                      </Button>
                                    </>
                                  )}
                                  {selectedApplication.status === 'payment_pending' && (
                                    <Button size="sm" style={{ backgroundColor: '#8b5cf6' }} data-testid="button-start-training"
                                      onClick={() => advanceApplicationMutation.mutate({ id: selectedApplication.id, action: 'start-training' })}>
                                      <BookOpen className="h-4 w-4 mr-1" /> Start Training
                                    </Button>
                                  )}
                                  {selectedApplication.status === 'training' && (
                                    <Button size="sm" style={{ backgroundColor: '#ec4899' }} data-testid="button-start-assessment"
                                      onClick={() => advanceApplicationMutation.mutate({ id: selectedApplication.id, action: 'start-assessment' })}>
                                      <ClipboardList className="h-4 w-4 mr-1" /> Start Assessment
                                    </Button>
                                  )}
                                  {selectedApplication.status === 'assessment' && (
                                    <Button size="sm" style={{ backgroundColor: '#22c55e' }} data-testid="button-activate-applicant"
                                      onClick={() => advanceApplicationMutation.mutate({ id: selectedApplication.id, action: 'activate' })}>
                                      <CheckCircle className="h-4 w-4 mr-1" /> Activate as Mentor
                                    </Button>
                                  )}
                                </div>
                              </CardHeader>

                              <CardContent className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
                                {/* Contact Details */}
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <p className="text-xs text-gray-500">Email</p>
                                    <p className="text-sm font-medium">{selectedApplication.email}</p>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-xs text-gray-500">Phone</p>
                                    <p className="text-sm font-medium">{selectedApplication.phone}</p>
                                  </div>
                                </div>

                                {/* Job Applied For */}
                                <div className="p-3 bg-gray-50 rounded-lg">
                                  <p className="text-xs text-gray-500 mb-2">Applied For</p>
                                  <div className="flex items-center gap-3">
                                    <Briefcase className="h-5 w-5" style={{ color: BRAND.cyan }} />
                                    <div>
                                      <p className="font-medium" style={{ color: BRAND.primary }}>
                                        {jobs.find((j: any) => j.id === selectedApplication.jobId)?.title || 'Unknown Job'}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {jobs.find((j: any) => j.id === selectedApplication.jobId)?.roleCategory || ''} • 
                                        {jobs.find((j: any) => j.id === selectedApplication.jobId)?.employmentType || ''}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                {/* Cover Letter / Motivation */}
                                {selectedApplication.coverLetter && (
                                  <div className="space-y-1">
                                    <p className="text-xs text-gray-500">Cover Letter / Motivation</p>
                                    <div className="p-3 bg-blue-50 rounded-lg">
                                      <p className="text-sm">{selectedApplication.coverLetter}</p>
                                    </div>
                                  </div>
                                )}

                                {/* Application Details */}
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <p className="text-xs text-gray-500">Source Channel</p>
                                    <div className="flex items-center gap-2">
                                      {selectedApplication.sourceChannel === 'linkedin' && <Badge className="bg-blue-100 text-blue-700">LinkedIn</Badge>}
                                      {selectedApplication.sourceChannel === 'indeed' && <Badge className="bg-purple-100 text-purple-700">Indeed</Badge>}
                                      {selectedApplication.sourceChannel === 'direct' && <Badge className="bg-gray-100 text-gray-700">Direct</Badge>}
                                      {selectedApplication.sourceChannel === 'referral' && <Badge className="bg-green-100 text-green-700">Referral</Badge>}
                                      {!selectedApplication.sourceChannel && <span className="text-sm">Direct</span>}
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-xs text-gray-500">Consent Captured</p>
                                    <div className="flex items-center gap-2">
                                      {selectedApplication.consentCaptured ? (
                                        <Badge className="bg-green-100 text-green-700"><CheckCircle className="h-3 w-3 mr-1" /> Yes</Badge>
                                      ) : (
                                        <Badge className="bg-red-100 text-red-700"><XCircle className="h-3 w-3 mr-1" /> No</Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Resume Link */}
                                {selectedApplication.resumeUrl && (
                                  <div className="space-y-1">
                                    <p className="text-xs text-gray-500">Resume</p>
                                    <Button variant="outline" size="sm">
                                      <Download className="h-4 w-4 mr-1" /> Download Resume
                                    </Button>
                                  </div>
                                )}

                                {/* Rejection Reason */}
                                {selectedApplication.status === 'rejected' && selectedApplication.rejectionReason && (
                                  <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                                    <p className="text-xs text-red-800 font-medium">Rejection Reason</p>
                                    <p className="text-sm text-red-700 mt-1">{selectedApplication.rejectionReason}</p>
                                  </div>
                                )}

                                {/* Timestamps */}
                                <div className="border-t pt-4 grid grid-cols-2 gap-4 text-xs text-gray-500">
                                  <div>Applied: {formatDate(selectedApplication.createdAt)}</div>
                                  {selectedApplication.processedAt && <div>Processed: {formatDate(selectedApplication.processedAt)}</div>}
                                  {selectedApplication.membershipPaidAt && <div>Payment: {formatDate(selectedApplication.membershipPaidAt)}</div>}
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Mentors Sub-Tab - Complete Management */}
                  {hrSubTab === 'mentors' && (
                    <div className="space-y-4">
                      {/* Filters Bar */}
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex flex-wrap gap-4 items-center">
                            <div className="flex-1 min-w-[200px]">
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                  placeholder="Search mentors by name, email, or code..."
                                  value={mentorSearchQuery}
                                  onChange={(e) => setMentorSearchQuery(e.target.value)}
                                  className="pl-10"
                                  data-testid="input-mentor-search"
                                />
                              </div>
                            </div>
                            <Select value={mentorStatusFilter} onValueChange={setMentorStatusFilter}>
                              <SelectTrigger className="w-[180px]" data-testid="select-mentor-status-filter">
                                <Filter className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="Filter by status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="pending_training">Pending Training</SelectItem>
                                <SelectItem value="training">In Training</SelectItem>
                                <SelectItem value="assessment">Assessment</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="warning">Warning</SelectItem>
                                <SelectItem value="suspended">Suspended</SelectItem>
                                <SelectItem value="deactivated">Deactivated</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button variant="outline" onClick={() => refetchMentors()} data-testid="button-refresh-mentors-hr">
                              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
                            </Button>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Stats Summary */}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {[
                          { label: 'Total Mentors', value: mentors.length, color: BRAND.primary },
                          { label: 'Active', value: mentors.filter((m: any) => m.status === 'active').length, color: '#22c55e' },
                          { label: 'In Training', value: mentors.filter((m: any) => ['pending_training', 'training', 'assessment'].includes(m.status)).length, color: '#3b82f6' },
                          { label: 'At Risk (PHI < 60)', value: mentors.filter((m: any) => m.performanceHealthIndex !== null && m.performanceHealthIndex < 60).length, color: '#f59e0b' },
                          { label: 'Suspended', value: mentors.filter((m: any) => m.status === 'suspended').length, color: '#ef4444' }
                        ].map((stat, i) => (
                          <Card key={i}>
                            <CardContent className="p-4 text-center">
                              <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
                              <p className="text-xs text-gray-500">{stat.label}</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>

                      {/* Mentors List with Detail Panel */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Mentors List */}
                        <div className={selectedMentor ? 'lg:col-span-1' : 'lg:col-span-3'}>
                          <Card>
                            <CardHeader className="border-b py-3">
                              <CardTitle className="text-base">Mentors</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0 max-h-[600px] overflow-y-auto">
                              <div className="divide-y">
                                {mentors
                                  .filter((m: any) => {
                                    const matchesSearch = !mentorSearchQuery || 
                                      m.fullName?.toLowerCase().includes(mentorSearchQuery.toLowerCase()) ||
                                      m.email?.toLowerCase().includes(mentorSearchQuery.toLowerCase()) ||
                                      m.mentorCode?.toLowerCase().includes(mentorSearchQuery.toLowerCase());
                                    const matchesStatus = mentorStatusFilter === 'all' || m.status === mentorStatusFilter;
                                    return matchesSearch && matchesStatus;
                                  })
                                  .map((mentor: any) => {
                                    const phi = mentor.performanceHealthIndex ?? 100;
                                    const phiColor = phi >= 80 ? '#22c55e' : phi >= 60 ? '#f59e0b' : '#ef4444';
                                    const isSelected = selectedMentor?.id === mentor.id;
                                    return (
                                      <div 
                                        key={mentor.id} 
                                        className={`p-4 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 border-l-4' : 'hover:bg-gray-50'}`}
                                        style={{ borderLeftColor: isSelected ? BRAND.primary : 'transparent' }}
                                        onClick={() => {
                                          setSelectedMentor(mentor);
                                          setMentorDetailTab('overview');
                                        }}
                                        data-testid={`mentor-row-hr-${mentor.id}`}
                                      >
                                        <div className="flex items-center gap-3">
                                          <div className="relative">
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${phiColor}20` }}>
                                              <GraduationCap className="h-5 w-5" style={{ color: phiColor }} />
                                            </div>
                                            {mentor.status === 'warning' && (
                                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                                                <AlertTriangle className="h-3 w-3 text-white" />
                                              </div>
                                            )}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                              <p className="font-medium text-sm truncate" style={{ color: BRAND.primary }}>{mentor.fullName}</p>
                                              {getStatusBadge(mentor.status)}
                                            </div>
                                            <p className="text-xs text-gray-500 truncate">{mentor.mentorCode}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                              <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                <div className="h-full rounded-full" style={{ width: `${phi}%`, backgroundColor: phiColor }} />
                                              </div>
                                              <span className="text-xs font-medium" style={{ color: phiColor }}>{phi}%</span>
                                            </div>
                                          </div>
                                          <ChevronRight className="h-4 w-4 text-gray-400" />
                                        </div>
                                      </div>
                                    );
                                  })}
                                {mentors.length === 0 && (
                                  <div className="p-8 text-center text-gray-500">No mentors found.</div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Mentor Detail Panel */}
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
                                      <CardTitle>{selectedMentor.fullName}</CardTitle>
                                      <div className="flex items-center gap-2 mt-1">
                                        {selectedMentor.mentorCode && (
                                          <code className="text-xs px-2 py-0.5 rounded bg-gray-100 font-mono">{selectedMentor.mentorCode}</code>
                                        )}
                                        {getStatusBadge(selectedMentor.status)}
                                        {selectedMentor.agreementStatus && (
                                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                                            selectedMentor.agreementStatus === 'completed' ? 'bg-green-50 text-green-700 border-green-200' :
                                            selectedMentor.agreementStatus === 'acknowledged' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                            selectedMentor.agreementStatus === 'sent' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                            'bg-gray-50 text-gray-600 border-gray-200'
                                          }`}>
                                            Agreement: {selectedMentor.agreementStatus?.replace('_', ' ')}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <Button variant="ghost" size="sm" onClick={() => setSelectedMentor(null)}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                                {/* Action Buttons */}
                                <div className="flex flex-wrap gap-2 mt-4">
                                  {['pending_training', 'training', 'assessment', 'pending_agreement'].includes(selectedMentor.status) && (
                                    <Button size="sm" onClick={() => activateMentorMutation.mutate(selectedMentor.id)} style={{ backgroundColor: BRAND.accent }} data-testid="button-activate-detail">
                                      <UserCheck className="h-4 w-4 mr-1" /> Activate
                                    </Button>
                                  )}
                                  {selectedMentor.mentorCode && selectedMentor.agreementStatus !== 'completed' && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      data-testid="button-resend-agreement"
                                      onClick={async () => {
                                        try {
                                          const res = await fetch(`/api/admin/mentors/${selectedMentor.mentorCode}/resend-agreement`, {
                                            method: 'POST',
                                            credentials: 'include',
                                          });
                                          const data = await res.json();
                                          if (res.ok) alert('Agreement email resent successfully.');
                                          else alert(data.message || 'Failed to resend agreement email.');
                                        } catch { alert('Network error. Please try again.'); }
                                      }}
                                    >
                                      <Mail className="h-4 w-4 mr-1" /> Resend Agreement
                                    </Button>
                                  )}
                                  {selectedMentor.status === 'active' && (
                                    <>
                                      <Button size="sm" variant="outline" onClick={() => setMentorDialog({ open: true, type: 'warn', mentor: selectedMentor })} data-testid="button-warn-mentor">
                                        <AlertCircle className="h-4 w-4 mr-1" /> Issue Warning
                                      </Button>
                                      <Button size="sm" variant="destructive" onClick={() => setActionDialog({ open: true, type: 'suspend', item: selectedMentor })} data-testid="button-suspend-detail">
                                        <Ban className="h-4 w-4 mr-1" /> Suspend
                                      </Button>
                                    </>
                                  )}
                                  {selectedMentor.status === 'warning' && (
                                    <Button size="sm" variant="destructive" onClick={() => setActionDialog({ open: true, type: 'suspend', item: selectedMentor })} data-testid="button-suspend-warning">
                                      <Ban className="h-4 w-4 mr-1" /> Suspend
                                    </Button>
                                  )}
                                  {['suspended', 'warning'].includes(selectedMentor.status) && (
                                    <Button size="sm" onClick={() => setMentorDialog({ open: true, type: 'reactivate', mentor: selectedMentor })} style={{ backgroundColor: '#22c55e' }} data-testid="button-reactivate-mentor">
                                      <CheckCircle className="h-4 w-4 mr-1" /> Reactivate
                                    </Button>
                                  )}
                                  <Button size="sm" variant="outline" onClick={() => setMentorDialog({ open: true, type: 'assign-task', mentor: selectedMentor })} data-testid="button-assign-task">
                                    <ClipboardList className="h-4 w-4 mr-1" /> Assign Task
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => setMentorDialog({ open: true, type: 'report-violation', mentor: selectedMentor })} className="text-red-600 border-red-200 hover:bg-red-50" data-testid="button-report-violation">
                                    <AlertTriangle className="h-4 w-4 mr-1" /> Report Violation
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => setMentorDialog({ open: true, type: 'update-phi', mentor: selectedMentor })} data-testid="button-update-phi">
                                    <TrendingUp className="h-4 w-4 mr-1" /> Update PHI
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    style={{ borderColor: BRAND.accent, color: BRAND.accent }}
                                    onClick={() => { setActiveTab('mentors'); setMentorProfileSubTab('profile'); }}
                                    data-testid="button-view-mentor-profile"
                                  >
                                    <GraduationCap className="h-4 w-4 mr-1" /> View Profile
                                  </Button>
                                </div>
                              </CardHeader>
                              
                              {/* Detail Tabs */}
                              <div className="border-b px-4">
                                <div className="flex gap-4">
                                  {(['overview', 'kpis', 'tasks', 'payouts', 'violations'] as const).map(tab => (
                                    <button
                                      key={tab}
                                      className={`py-3 px-2 text-sm font-medium border-b-2 transition-colors ${mentorDetailTab === tab ? 'border-current' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                      style={{ color: mentorDetailTab === tab ? BRAND.primary : undefined }}
                                      onClick={() => setMentorDetailTab(tab)}
                                      data-testid={`tab-mentor-${tab}`}
                                    >
                                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <CardContent className="p-4 max-h-[400px] overflow-y-auto">
                                {/* Overview Tab */}
                                {mentorDetailTab === 'overview' && (
                                  <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-1">
                                        <p className="text-xs text-gray-500">Email</p>
                                        <p className="text-sm font-medium">{selectedMentor.email}</p>
                                      </div>
                                      <div className="space-y-1">
                                        <p className="text-xs text-gray-500">Phone</p>
                                        <p className="text-sm font-medium">{selectedMentor.phone || 'N/A'}</p>
                                      </div>
                                      <div className="space-y-1">
                                        <p className="text-xs text-gray-500">Specialization</p>
                                        <p className="text-sm font-medium">{selectedMentor.specialization || 'N/A'}</p>
                                      </div>
                                      <div className="space-y-1">
                                        <p className="text-xs text-gray-500">Qualifications</p>
                                        <p className="text-sm font-medium">{selectedMentor.qualifications || 'N/A'}</p>
                                      </div>
                                      <div className="space-y-1">
                                        <p className="text-xs text-gray-500">Activated At</p>
                                        <p className="text-sm font-medium">{selectedMentor.activatedAt ? new Date(selectedMentor.activatedAt).toLocaleDateString() : 'Not yet'}</p>
                                      </div>
                                      <div className="space-y-1">
                                        <p className="text-xs text-gray-500">Performance Health Index</p>
                                        <div className="flex items-center gap-2">
                                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                            <div 
                                              className="h-full rounded-full transition-all" 
                                              style={{ 
                                                width: `${selectedMentor.performanceHealthIndex ?? 100}%`,
                                                backgroundColor: (selectedMentor.performanceHealthIndex ?? 100) >= 80 ? '#22c55e' : (selectedMentor.performanceHealthIndex ?? 100) >= 60 ? '#f59e0b' : '#ef4444'
                                              }} 
                                            />
                                          </div>
                                          <span className="text-sm font-bold">{selectedMentor.performanceHealthIndex ?? 100}%</span>
                                        </div>
                                      </div>
                                    </div>
                                    {selectedMentor.warningReason && (
                                      <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                                        <p className="text-xs text-yellow-800 font-medium">Warning Issued</p>
                                        <p className="text-sm text-yellow-700 mt-1">{selectedMentor.warningReason}</p>
                                        {selectedMentor.warningIssuedAt && (
                                          <p className="text-xs text-yellow-600 mt-1">On {new Date(selectedMentor.warningIssuedAt).toLocaleDateString()}</p>
                                        )}
                                      </div>
                                    )}
                                    {selectedMentor.suspensionReason && (
                                      <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                                        <p className="text-xs text-red-800 font-medium">Suspension Reason</p>
                                        <p className="text-sm text-red-700 mt-1">{selectedMentor.suspensionReason}</p>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* KPIs Tab */}
                                {mentorDetailTab === 'kpis' && (
                                  <div className="space-y-4">
                                    {mentorKpis.length === 0 ? (
                                      <div className="text-center py-8 text-gray-500">No KPI records found</div>
                                    ) : (
                                      mentorKpis.map((kpi: any) => (
                                        <div key={kpi.id} className="p-4 border rounded-lg">
                                          <div className="flex justify-between items-center mb-3">
                                            <p className="text-sm font-medium">Period: {new Date(kpi.periodStart).toLocaleDateString()} - {new Date(kpi.periodEnd).toLocaleDateString()}</p>
                                            {kpi.alertLevel !== 'none' && (
                                              <Badge variant="destructive">Alert: {(kpi.alertLevel || '').replace('_', ' ')}</Badge>
                                            )}
                                          </div>
                                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            {[
                                              { label: 'Student Satisfaction', value: kpi.studentSatisfaction },
                                              { label: 'Session Completion', value: kpi.sessionCompletionRate },
                                              { label: 'Outcome Improvement', value: kpi.outcomeImprovement },
                                              { label: 'Compliance', value: kpi.complianceAdherence }
                                            ].map((metric, i) => (
                                              <div key={i} className="text-center">
                                                <p className="text-lg font-bold" style={{ color: (metric.value ?? 0) >= 70 ? '#22c55e' : '#f59e0b' }}>{metric.value?.toFixed(1) ?? 0}%</p>
                                                <p className="text-xs text-gray-500">{metric.label}</p>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                )}

                                {/* Tasks Tab */}
                                {mentorDetailTab === 'tasks' && (
                                  <div className="space-y-3">
                                    {mentorTasks.length === 0 ? (
                                      <div className="text-center py-8 text-gray-500">No tasks assigned</div>
                                    ) : (
                                      mentorTasks.map((task: any) => (
                                        <div key={task.id} className="p-3 border rounded-lg">
                                          <div className="flex justify-between items-start">
                                            <div>
                                              <p className="font-medium">{task.title}</p>
                                              <p className="text-sm text-gray-500">{task.taskType?.replace('_', ' ')}</p>
                                              {task.scheduledDate && (
                                                <p className="text-xs text-gray-400 mt-1">Scheduled: {new Date(task.scheduledDate).toLocaleDateString()}</p>
                                              )}
                                            </div>
                                            {getStatusBadge(task.status)}
                                          </div>
                                          {task.description && <p className="text-sm text-gray-600 mt-2">{task.description}</p>}
                                        </div>
                                      ))
                                    )}
                                  </div>
                                )}

                                {/* Payouts Tab */}
                                {mentorDetailTab === 'payouts' && (
                                  <div className="space-y-3">
                                    {mentorPayouts.length === 0 ? (
                                      <div className="text-center py-8 text-gray-500">No payout records</div>
                                    ) : (
                                      mentorPayouts.map((payout: any) => (
                                        <div key={payout.id} className="p-3 border rounded-lg">
                                          <div className="flex justify-between items-center">
                                            <div>
                                              <p className="font-medium">₹{payout.netPayout?.toLocaleString()}</p>
                                              <p className="text-xs text-gray-500">{new Date(payout.periodStart).toLocaleDateString()} - {new Date(payout.periodEnd).toLocaleDateString()}</p>
                                            </div>
                                            {getStatusBadge(payout.status)}
                                          </div>
                                          <div className="grid grid-cols-3 gap-2 mt-2 text-xs text-gray-500">
                                            <div>Gross: ₹{payout.grossRevenue?.toLocaleString()}</div>
                                            <div>Commission: {(payout.commissionRate * 100).toFixed(0)}%</div>
                                            <div>Deductions: ₹{payout.deductions?.toLocaleString()}</div>
                                          </div>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                )}

                                {/* Violations Tab */}
                                {mentorDetailTab === 'violations' && (
                                  <div className="space-y-3">
                                    {mentorViolations.length === 0 ? (
                                      <div className="text-center py-8 text-gray-500">No violations reported</div>
                                    ) : (
                                      mentorViolations.map((violation: any) => (
                                        <div key={violation.id} className="p-3 border rounded-lg border-l-4" style={{ borderLeftColor: violation.severity === 'critical' ? '#ef4444' : violation.severity === 'major' ? '#f59e0b' : '#3b82f6' }}>
                                          <div className="flex justify-between items-start">
                                            <div>
                                              <div className="flex items-center gap-2">
                                                <p className="font-medium">{violation.violationType?.replace('_', ' ')}</p>
                                                <Badge variant={violation.severity === 'critical' || violation.severity === 'major' ? 'destructive' : 'secondary'}>
                                                  {violation.severity}
                                                </Badge>
                                              </div>
                                              <p className="text-sm text-gray-600 mt-1">{violation.description}</p>
                                            </div>
                                            {getStatusBadge(violation.status)}
                                          </div>
                                          {violation.resolution && (
                                            <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                                              <p className="text-xs text-gray-500">Resolution:</p>
                                              <p>{violation.resolution}</p>
                                            </div>
                                          )}
                                        </div>
                                      ))
                                    )}
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
  );
}
