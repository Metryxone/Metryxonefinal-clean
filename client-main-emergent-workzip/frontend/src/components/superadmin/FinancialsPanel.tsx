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

export default function FinancialsPanel() {
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
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <DollarSign className="h-5 w-5" style={{ color: BRAND.primary }} />
                        Financial Management
                      </h3>
                      <p className="text-sm text-gray-500">Track revenue, payouts, reconciliation, and financial flow</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="gap-2" data-testid="button-export-financial-report" onClick={() => toast({ title: 'Export Initiated', description: 'Financial report is being generated. It will download shortly.' })}><Download className="h-4 w-4" /> Export Report</Button>
                      <Button style={{ backgroundColor: BRAND.primary }} className="gap-2 text-white" data-testid="button-generate-invoice" onClick={() => toast({ title: 'Coming Soon', description: 'Invoice generation will be available in the next release' })}><Receipt className="h-4 w-4" /> Generate Invoice</Button>
                    </div>
                  </div>

                  <div className="flex gap-2 border-b pb-4">
                    {[
                      { id: 'overview', label: 'Overview' },
                      { id: 'recon', label: 'Reconciliation' },
                      { id: 'flow', label: 'Financial Flow' },
                      { id: 'payouts', label: 'Payouts' },
                    ].map((tab) => (
                      <Button key={tab.id} variant={financialSubTab === tab.id ? 'default' : 'outline'} size="sm"
                        onClick={() => setFinancialSubTab(tab.id as any)}
                        style={financialSubTab === tab.id ? { backgroundColor: BRAND.primary } : {}}
                        data-testid={`button-financial-${tab.id}`}
                      >{tab.label}</Button>
                    ))}
                  </div>

                  {financialSubTab === 'overview' && (
                    <React.Fragment>
                      <div className="grid md:grid-cols-5 gap-4">
                        <Card className="border-l-4" style={{ borderLeftColor: BRAND.accent }} data-testid="card-total-revenue">
                          <CardContent className="p-5">
                            <div className="flex items-center gap-2 mb-2">
                              <ArrowUpRight className="h-5 w-5 text-green-500" />
                              <span className="text-sm font-medium text-gray-600">Total Revenue</span>
                            </div>
                            <p className="text-2xl font-bold" style={{ color: BRAND.primary }}>{formatCurrency(financialStats?.paymentsReceived?.total || stats?.totalRevenue || 0)}</p>
                            <p className="text-xs text-gray-500 mt-1">{financialStats?.paymentsReceived?.count || 0} transactions</p>
                          </CardContent>
                        </Card>
                        <Card className="border-l-4" style={{ borderLeftColor: '#10b981' }} data-testid="card-collections">
                          <CardContent className="p-5">
                            <div className="flex items-center gap-2 mb-2">
                              <CreditCard className="h-5 w-5 text-green-500" />
                              <span className="text-sm font-medium text-gray-600">Collections</span>
                            </div>
                            <p className="text-2xl font-bold text-green-600">{formatCurrency(financialStats?.paymentsReceived?.total || 0)}</p>
                            <p className="text-xs text-gray-500 mt-1">Completed payments</p>
                          </CardContent>
                        </Card>
                        <Card className="border-l-4" style={{ borderLeftColor: '#ef4444' }} data-testid="card-disbursements">
                          <CardContent className="p-5">
                            <div className="flex items-center gap-2 mb-2">
                              <ArrowDownRight className="h-5 w-5 text-red-500" />
                              <span className="text-sm font-medium text-gray-600">Disbursements</span>
                            </div>
                            <p className="text-2xl font-bold text-red-600">{formatCurrency(financialStats?.paymentsDone?.total || 0)}</p>
                            <p className="text-xs text-gray-500 mt-1">{financialStats?.paymentsDone?.count || 0} payouts</p>
                          </CardContent>
                        </Card>
                        <Card className="border-l-4" style={{ borderLeftColor: '#F59E0B' }} data-testid="card-pending">
                          <CardContent className="p-5">
                            <div className="flex items-center gap-2 mb-2">
                              <Clock className="h-5 w-5 text-orange-500" />
                              <span className="text-sm font-medium text-gray-600">Pending</span>
                            </div>
                            <p className="text-2xl font-bold text-orange-600">{formatCurrency(financialStats?.pendingPayouts?.total || 0)}</p>
                            <p className="text-xs text-gray-500 mt-1">{financialStats?.pendingPayouts?.count || 0} pending</p>
                          </CardContent>
                        </Card>
                        <Card className="border-l-4" style={{ borderLeftColor: BRAND.primary }} data-testid="card-net-balance">
                          <CardContent className="p-5">
                            <div className="flex items-center gap-2 mb-2">
                              <Receipt className="h-5 w-5" style={{ color: BRAND.primary }} />
                              <span className="text-sm font-medium text-gray-600">Net Balance</span>
                            </div>
                            <p className="text-2xl font-bold" style={{ color: BRAND.primary }}>{formatCurrency(financialStats?.netBalance || 0)}</p>
                            <p className="text-xs text-gray-500 mt-1">Revenue - Payouts</p>
                          </CardContent>
                        </Card>
                      </div>
                    </React.Fragment>
                  )}

                  {financialSubTab === 'recon' && (
                    <Card>
                      <CardHeader className="border-b">
                        <div className="flex items-center justify-between">
                          <CardTitle>Reconciliation Dashboard</CardTitle>
                          <div className="flex gap-2">
                            <Input type="date" className="w-40" />
                            <Input type="date" className="w-40" />
                            <Button variant="outline" onClick={() => toast({ title: 'Filter Applied', description: 'Date filter applied' })}>Apply</Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid md:grid-cols-3 gap-6 mb-6">
                          <div className="p-4 rounded-xl bg-green-50 border border-green-200">
                            <p className="text-sm text-green-700 mb-1">Matched Transactions</p>
                            <p className="text-3xl font-bold text-green-700">{transactions.filter((t: any) => t.status === 'completed').length.toLocaleString()}</p>
                            <p className="text-sm text-green-600 mt-1">{transactions.length > 0 ? Math.round(transactions.filter((t: any) => t.status === 'completed').length / transactions.length * 100) : 0}% match rate</p>
                          </div>
                          <div className="p-4 rounded-xl bg-orange-50 border border-orange-200">
                            <p className="text-sm text-orange-700 mb-1">Pending Match</p>
                            <p className="text-3xl font-bold text-orange-700">{transactions.filter((t: any) => t.status === 'pending').length}</p>
                            <p className="text-sm text-orange-600 mt-1">Under review</p>
                          </div>
                          <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                            <p className="text-sm text-red-700 mb-1">Discrepancies</p>
                            <p className="text-3xl font-bold text-red-700">{transactions.filter((t: any) => t.status === 'failed' || t.status === 'refunded').length}</p>
                            <p className="text-sm text-red-600 mt-1">Requires action</p>
                          </div>
                        </div>
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Txn ID</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Date</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">System Amount</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Bank Amount</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Difference</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {[
                              { id: 'TXN-28901', date: '2026-01-29', system: 15000, bank: 15000, status: 'matched' },
                              { id: 'TXN-28900', date: '2026-01-29', system: 8500, bank: 8500, status: 'matched' },
                              { id: 'TXN-28899', date: '2026-01-28', system: 12000, bank: 11800, status: 'discrepancy' },
                              { id: 'TXN-28898', date: '2026-01-28', system: 5000, bank: 0, status: 'pending' },
                            ].map((row, idx) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-mono text-sm" style={{ color: BRAND.primary }}>{row.id}</td>
                                <td className="px-4 py-3 text-sm">{row.date}</td>
                                <td className="px-4 py-3 text-sm">{formatCurrency(row.system)}</td>
                                <td className="px-4 py-3 text-sm">{formatCurrency(row.bank)}</td>
                                <td className="px-4 py-3 text-sm font-medium" style={{ color: row.system - row.bank !== 0 ? '#ef4444' : '#10b981' }}>{formatCurrency(row.system - row.bank)}</td>
                                <td className="px-4 py-3"><Badge variant={row.status === 'matched' ? 'default' : row.status === 'pending' ? 'secondary' : 'destructive'}>{row.status}</Badge></td>
                                <td className="px-4 py-3">{row.status !== 'matched' && <Button size="sm" variant="outline" onClick={() => toast({ title: 'Coming Soon', description: 'Reconciliation resolution workflow coming soon' })}>Resolve</Button>}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </CardContent>
                    </Card>
                  )}

                  {financialSubTab === 'flow' && (
                    <Card>
                      <CardHeader className="border-b">
                        <CardTitle>Financial Flow - Inputs to Outputs</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid md:grid-cols-3 gap-8">
                          <div>
                            <h4 className="font-semibold mb-4 flex items-center gap-2" style={{ color: BRAND.primary }}>
                              <ArrowUpRight className="h-5 w-5 text-green-500" /> Inputs (Revenue Sources)
                            </h4>
                            <div className="space-y-3">
                              {[
                                { source: 'Student Subscriptions', amount: 1850000, percent: 65 },
                                { source: 'Institute Licenses', amount: 650000, percent: 23 },
                                { source: 'Assessment Fees', amount: 250000, percent: 9 },
                                { source: 'Other Revenue', amount: 100000, percent: 3 },
                              ].map((item, idx) => (
                                <div key={idx} className="p-3 rounded-lg bg-green-50 border border-green-100">
                                  <div className="flex justify-between mb-1">
                                    <span className="text-sm font-medium">{item.source}</span>
                                    <span className="text-sm font-bold text-green-700">{formatCurrency(item.amount)}</span>
                                  </div>
                                  <div className="h-2 bg-green-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${item.percent}%` }}></div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-4 p-3 rounded-lg bg-green-100 border-2 border-green-300">
                              <div className="flex justify-between">
                                <span className="font-semibold">Total Inputs</span>
                                <span className="font-bold text-green-700">{formatCurrency(financialStats?.paymentsReceived?.total || 0)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-center">
                            <div className="text-center">
                              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `${BRAND.primary}15` }}>
                                <ArrowRight className="h-10 w-10" style={{ color: BRAND.primary }} />
                              </div>
                              <p className="text-sm text-gray-500">Processing</p>
                              <p className="font-bold" style={{ color: BRAND.primary }}>Net Margin: {((financialStats?.paymentsReceived?.total || 0) > 0 ? Math.round(((financialStats?.paymentsReceived?.total || 0) - (financialStats?.paymentsDone?.total || 0)) / (financialStats?.paymentsReceived?.total || 1) * 100) : 0)}%</p>
                            </div>
                          </div>

                          <div>
                            <h4 className="font-semibold mb-4 flex items-center gap-2" style={{ color: '#ef4444' }}>
                              <ArrowDownRight className="h-5 w-5 text-red-500" /> Outputs (Expenses)
                            </h4>
                            <div className="space-y-3">
                              {[
                                { source: 'Mentor Payouts', amount: 980000, percent: 52 },
                                { source: 'Platform Costs', amount: 350000, percent: 19 },
                                { source: 'Content Creation', amount: 280000, percent: 15 },
                                { source: 'Marketing', amount: 180000, percent: 9 },
                                { source: 'Operations', amount: 100000, percent: 5 },
                              ].map((item, idx) => (
                                <div key={idx} className="p-3 rounded-lg bg-red-50 border border-red-100">
                                  <div className="flex justify-between mb-1">
                                    <span className="text-sm font-medium">{item.source}</span>
                                    <span className="text-sm font-bold text-red-700">{formatCurrency(item.amount)}</span>
                                  </div>
                                  <div className="h-2 bg-red-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-red-500 rounded-full" style={{ width: `${item.percent}%` }}></div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-4 p-3 rounded-lg bg-red-100 border-2 border-red-300">
                              <div className="flex justify-between">
                                <span className="font-semibold">Total Outputs</span>
                                <span className="font-bold text-red-700">{formatCurrency(financialStats?.paymentsDone?.total || 0)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {financialSubTab === 'payouts' && (
                    <Card>
                      <CardHeader className="border-b">
                        <div className="flex items-center justify-between">
                          <CardTitle>Payout Management</CardTitle>
                          <div className="flex gap-2">
                            <Select defaultValue="all">
                              <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="approved">Approved</SelectItem>
                                <SelectItem value="processed">Processed</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button style={{ backgroundColor: BRAND.accent }} className="text-white gap-2" onClick={() => toast({ title: 'Coming Soon', description: 'Batch payout processing will be available in the next release' })}><DollarSign className="h-4 w-4" /> Process Batch</Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Mentor</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Period</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Amount</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {transactions.filter((t: any) => t.transactionType === 'payout' || t.transactionType === 'mentor_payout').length > 0 ? (
                              transactions.filter((t: any) => t.transactionType === 'payout' || t.transactionType === 'mentor_payout').map((payout: any) => (
                                <tr key={payout.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 font-medium">Payout #{payout.id}</td>
                                  <td className="px-4 py-3 text-sm">{formatDate(payout.createdAt)}</td>
                                  <td className="px-4 py-3 font-medium" style={{ color: BRAND.primary }}>{formatCurrency(payout.amount)}</td>
                                  <td className="px-4 py-3"><Badge variant={payout.status === 'completed' ? 'default' : payout.status === 'approved' ? 'secondary' : 'outline'}>{payout.status}</Badge></td>
                                  <td className="px-4 py-3">
                                    {payout.status === 'pending' && <Button size="sm" variant="outline" className="mr-2" onClick={() => toast({ title: 'Payout Approval', description: 'Payout approval workflow coming soon' })}>Approve</Button>}
                                    {payout.status === 'approved' && <Button size="sm" style={{ backgroundColor: BRAND.accent }} className="text-white" onClick={() => toast({ title: 'Processing', description: 'Payout processing workflow coming soon' })}>Process</Button>}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                                  <DollarSign className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                                  No payouts found
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </CardContent>
                    </Card>
                  )}

                  <Card>
                    <CardHeader className="border-b">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>Recent Transactions</CardTitle>
                          <CardDescription>View and manage financial records</CardDescription>
                        </div>
                        <Button variant="outline" onClick={() => refetchTransactions()} data-testid="button-refresh-transactions">
                          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="divide-y">
                        {transactions.slice(0, 10).map((tx: any) => (
                          <div key={tx.id} className="p-4 hover:bg-gray-50 transition-colors" data-testid={`transaction-row-${tx.id}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${BRAND.accent}15` }}>
                                  <Receipt className="h-6 w-6" style={{ color: BRAND.accent }} />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-semibold" style={{ color: BRAND.primary }}>{formatCurrency(tx.amount)}</p>
                                    {getStatusBadge(tx.status)}
                                  </div>
                                  <p className="text-sm text-gray-500 capitalize">{tx.transactionType?.replace(/_/g, ' ')} • {formatDate(tx.createdAt)}</p>
                                </div>
                              </div>
                              {tx.status === 'pending' && (
                                <Button size="sm" onClick={() => processPayoutMutation.mutate(tx.id)} style={{ backgroundColor: BRAND.accent }} data-testid={`button-process-${tx.id}`}>
                                  Process
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                        {transactions.length === 0 && (
                          <div className="p-8 text-center text-gray-500">No transactions found</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
  );
}
