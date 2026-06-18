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

export default function StudentsLegacyPanel() {
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
                        <GraduationCap className="h-5 w-5" style={{ color: BRAND.primary }} />
                        Student Management
                      </h3>
                      <p className="text-sm text-gray-500">Manage student enrollments and bulk imports by institute</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="gap-2" data-testid="button-download-template" onClick={() => {
                        const csv = 'Name,Email,Class,Section,Institute,Board,ParentEmail,ParentPhone\n';
                        const blob = new Blob([csv], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'student_import_template.csv';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        toast({ title: 'Template Downloaded', description: 'CSV template has been downloaded. Fill in student details and use Bulk Import.' });
                      }}>
                        <Download className="h-4 w-4" />
                        Download Template
                      </Button>
                      <Button variant="outline" className="gap-2" data-testid="button-add-student" onClick={() => toast({ title: 'Coming Soon', description: 'Individual student registration will be available in the next release' })}>
                        <UserPlus className="h-4 w-4" />
                        Add Student
                      </Button>
                      <Button style={{ backgroundColor: BRAND.primary }} className="gap-2 text-white" data-testid="button-bulk-import" onClick={() => toast({ title: 'Coming Soon', description: 'CSV bulk import will be available in the next release' })}>
                        <Upload className="h-4 w-4" />
                        Bulk Import CSV
                      </Button>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">Total Students</p>
                            <p className="text-2xl font-bold">{stats?.totalStudents || 0}</p>
                          </div>
                          <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: `${BRAND.primary}20` }}>
                            <GraduationCap className="h-6 w-6" style={{ color: BRAND.primary }} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">Active</p>
                            <p className="text-2xl font-bold text-green-600">0</p>
                          </div>
                          <CheckCircle className="h-8 w-8 text-green-500" />
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">Pending Approval</p>
                            <p className="text-2xl font-bold text-orange-600">0</p>
                          </div>
                          <Clock className="h-8 w-8 text-orange-500" />
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">Imports Today</p>
                            <p className="text-2xl font-bold" style={{ color: BRAND.accent }}>0</p>
                          </div>
                          <Upload className="h-8 w-8" style={{ color: BRAND.accent }} />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-1">
                      <CardHeader className="border-b">
                        <CardTitle className="text-base">Institutes</CardTitle>
                      </CardHeader>
                      <CardContent className="p-0 max-h-[400px] overflow-y-auto">
                        <div className="divide-y">
                          {[
                            { id: 'all', name: 'All Institutes', count: stats?.totalStudents || 0 },
                            ...institutes.map((inst: any) => ({
                              id: String(inst.id),
                              name: inst.name || inst.instituteName || `Institute #${inst.id}`,
                              count: inst.studentCount || 0,
                            })),
                          ].map((inst) => (
                            <button
                              key={inst.id}
                              onClick={() => setInstituteFilter(inst.id)}
                              className={`w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors ${instituteFilter === inst.id ? 'bg-blue-50 border-r-4' : ''}`}
                              style={instituteFilter === inst.id ? { borderRightColor: BRAND.primary } : {}}
                              data-testid={`button-institute-filter-${inst.id}`}
                            >
                              <div className="flex items-center gap-3">
                                <Building2 className="h-5 w-5" style={{ color: instituteFilter === inst.id ? BRAND.primary : '#9ca3af' }} />
                                <span className="font-medium text-sm">{inst.name}</span>
                              </div>
                              <span className="text-sm font-semibold" style={{ color: instituteFilter === inst.id ? BRAND.primary : '#6b7280' }}>{inst.count}</span>
                            </button>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="lg:col-span-2">
                      <CardHeader className="border-b">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">Student Enrollment</CardTitle>
                          <div className="flex gap-2">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                              <Input
                                placeholder="Search students..."
                                value={studentSearch}
                                onChange={(e) => setStudentSearch(e.target.value)}
                                className="pl-10 w-56"
                                data-testid="input-student-search"
                              />
                            </div>
                            {selectedStudents.length > 0 && (
                              <Button variant="outline" size="sm" className="gap-1">
                                <Check className="h-4 w-4" /> {selectedStudents.length} Selected
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0 max-h-[400px] overflow-y-auto">
                        {studentsLoading ? (
                          <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                            <span className="ml-2 text-gray-500">Loading students...</span>
                          </div>
                        ) : (
                        <table className="w-full">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-4 py-3 text-left">
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 accent-blue-600"
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedStudents(studentsLegacyList.map((s: any) => s.id));
                                    } else {
                                      setSelectedStudents([]);
                                    }
                                  }}
                                  checked={selectedStudents.length === studentsLegacyList.length && studentsLegacyList.length > 0}
                                  data-testid="checkbox-select-all-students"
                                />
                              </th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Student</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Email</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Joined</th>
                              <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {studentsLegacyList.length === 0 && (
                              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">No students found</td></tr>
                            )}
                            {studentsLegacyList.map((student: any) => (
                              <tr key={student.id} className={`hover:bg-gray-50 ${selectedStudents.includes(student.id) ? 'bg-blue-50' : ''}`} data-testid={`row-student-${student.id}`}>
                                <td className="px-4 py-3">
                                  <input
                                    type="checkbox"
                                    className="w-4 h-4 accent-blue-600"
                                    checked={selectedStudents.includes(student.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedStudents([...selectedStudents, student.id]);
                                      } else {
                                        setSelectedStudents(selectedStudents.filter((id: string) => id !== student.id));
                                      }
                                    }}
                                    data-testid={`checkbox-student-${student.id}`}
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: BRAND.primary }}>
                                      {(student.full_name || student.username || 'S').charAt(0).toUpperCase()}
                                    </div>
                                    <span className="font-medium">{student.full_name || student.username || 'Unnamed'}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">{student.email || student.mobile || '—'}</td>
                                <td className="px-4 py-3">
                                  <Badge variant={student.is_active ? 'default' : 'outline'}>{student.is_active ? 'Active' : 'Inactive'}</Badge>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500">{student.created_at ? new Date(student.created_at).toLocaleDateString() : '—'}</td>
                                <td className="px-4 py-3">
                                  <div className="flex gap-1">
                                    <Button size="sm" variant="ghost" onClick={() => {
                                      setEditUserDialog({ open: true, user: student });
                                      setEditUserData({ full_name: student.full_name, email: student.email, mobile: student.mobile, role: student.role, is_active: student.is_active });
                                    }}><Edit className="h-4 w-4" /></Button>
                                    <Button size="sm" variant="ghost" onClick={async () => {
                                      try {
                                        const res = await fetch(`/api/admin/users/${student.id}/status`, {
                                          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
                                          body: JSON.stringify({ is_active: !student.is_active }),
                                        });
                                        if (res.ok) {
                                          refetchStudents();
                                          toast({ title: student.is_active ? 'Deactivated' : 'Activated', description: `${student.full_name || 'Student'} has been ${student.is_active ? 'deactivated' : 'activated'}.` });
                                        }
                                      } catch {}
                                    }}>
                                      {student.is_active ? <Ban className="h-4 w-4 text-red-500" /> : <CheckCircle className="h-4 w-4 text-green-500" />}
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        )}
                      </CardContent>
                      {/* Pagination */}
                      {studentsTotalPages > 1 && (
                        <div className="p-4 border-t flex items-center justify-between">
                          <span className="text-sm text-gray-500">Page {studentsPage} of {studentsTotalPages} ({studentsData?.total || 0} total)</span>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" disabled={studentsPage <= 1} onClick={() => setStudentsPage(p => p - 1)}>Previous</Button>
                            <Button size="sm" variant="outline" disabled={studentsPage >= studentsTotalPages} onClick={() => setStudentsPage(p => p + 1)}>Next</Button>
                          </div>
                        </div>
                      )}
                      {selectedStudents.length > 0 && (
                        <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
                          <span className="text-sm text-gray-600">{selectedStudents.length} students selected</span>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="gap-1" data-testid="button-export-students" onClick={() => toast({ title: 'Coming Soon', description: 'Export functionality coming soon' })}><Download className="h-4 w-4" /> Export</Button>
                            <Button variant="outline" size="sm" className="gap-1" data-testid="button-assign-plan" onClick={() => toast({ title: 'Coming Soon', description: 'Plan assignment will be available in the next release' })}><BookOpen className="h-4 w-4" /> Assign Plan</Button>
                            <Button size="sm" style={{ backgroundColor: BRAND.accent }} className="text-white gap-1" data-testid="button-approve-students" onClick={() => toast({ title: 'Approval', description: `${selectedStudents.length} students approval will be processed` })}><Check className="h-4 w-4" /> Approve</Button>
                          </div>
                        </div>
                      )}
                    </Card>
                  </div>

                  <Card>
                    <CardHeader className="border-b">
                      <div className="flex items-center justify-between">
                        <CardTitle>Recent Bulk Imports</CardTitle>
                        <Select defaultValue="all">
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="processing">Processing</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="failed">Failed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="divide-y">
                        {[
                          { id: 'IMP-001', institute: 'Delhi Public School', file: 'students_batch_1.csv', rows: 245, status: 'completed', date: '2026-01-29' },
                          { id: 'IMP-002', institute: 'St. Xavier\'s College', file: 'new_admissions.csv', rows: 128, status: 'pending_approval', date: '2026-01-29' },
                          { id: 'IMP-003', institute: 'Kendriya Vidyalaya', file: 'class_10_batch.csv', rows: 89, status: 'processing', date: '2026-01-28' },
                        ].map((importItem, index) => (
                          <div key={index} className="p-4 flex items-center justify-between hover:bg-gray-50">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${BRAND.primary}10` }}>
                                <FileText className="h-5 w-5" style={{ color: BRAND.primary }} />
                              </div>
                              <div>
                                <p className="font-medium">{importItem.file}</p>
                                <p className="text-sm text-gray-500">{importItem.institute} • {importItem.rows} students</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge variant={importItem.status === 'completed' ? 'default' : importItem.status === 'pending_approval' ? 'secondary' : 'outline'}>
                                {(importItem.status || '').replace('_', ' ')}
                              </Badge>
                              <span className="text-sm text-gray-500">{importItem.date}</span>
                              {importItem.status === 'pending_approval' && (
                                <div className="flex gap-1">
                                  <Button size="sm" style={{ backgroundColor: BRAND.accent }} className="text-white" onClick={() => toast({ title: 'Import Approved', description: `Bulk import ${importItem.id} has been approved for processing` })}>Approve</Button>
                                  <Button size="sm" variant="outline" onClick={() => toast({ title: 'Import Rejected', description: `Bulk import ${importItem.id} has been rejected` })}>Reject</Button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="border-b">
                      <div className="flex items-center justify-between">
                        <CardTitle>All Students</CardTitle>
                        <div className="flex gap-2">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input placeholder="Search students..." className="pl-10 w-64" data-testid="input-search-students" />
                          </div>
                          <Select defaultValue="all">
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="Institute" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Institutes</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Student</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Institute</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Class</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">KYC</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {[
                            { name: 'Aarav Sharma', institute: 'Delhi Public School', class: '10-A', status: 'active', kyc: 'verified' },
                            { name: 'Priya Patel', institute: 'St. Xavier\'s', class: '9-B', status: 'pending', kyc: 'pending' },
                            { name: 'Rahul Kumar', institute: 'Kendriya Vidyalaya', class: '12-Science', status: 'active', kyc: 'verified' },
                          ].map((student, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${BRAND.accent}20` }}>
                                    <span style={{ color: BRAND.accent }} className="text-sm font-medium">{student.name[0]}</span>
                                  </div>
                                  <span className="font-medium">{student.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">{student.institute}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{student.class}</td>
                              <td className="px-4 py-3">
                                <Badge variant={student.status === 'active' ? 'default' : 'secondary'}>{student.status}</Badge>
                              </td>
                              <td className="px-4 py-3">
                                <Badge variant={student.kyc === 'verified' ? 'default' : 'outline'}>{student.kyc}</Badge>
                              </td>
                              <td className="px-4 py-3">
                                <Button size="sm" variant="ghost"><Eye className="h-4 w-4" /></Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                </div>
  );
}
