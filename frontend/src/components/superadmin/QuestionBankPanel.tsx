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

export default function QuestionBankPanel() {
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
    seedingPackages, setSeedingPackages, seedingEducation, setSeedingEducation, scoringSubTab, setScoringSubTab,
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
    qbSubTab, setQbSubTab, qbBoardFilter, setQbBoardFilter, qbClassFilter, setQbClassFilter,
    qbSubjectFilter, setQbSubjectFilter, blueprintData, setBlueprintData,
    generatingPaper, setGeneratingPaper, generatedPaper, setGeneratedPaper,
    questionBankQuestions, refetchQuestions,
    setBlueprintDialog, setAiGenerateDialog, setCurriculumImportDialog, setQbUploadDialog,
  } = p;

  return (
                <div className="space-y-6">
                  {/* Page Header */}
                  <div className="border-b pb-4">
                    <h2 className="text-2xl font-bold text-gray-900">Question Bank</h2>
                    <p className="text-gray-500 mt-1">Manage your platform's curriculum, questions, and assessment blueprints</p>
                  </div>

                  {/* Main Content Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Left Sidebar - Quick Actions & Curriculum Tools */}
                    <div className="lg:col-span-1 space-y-4">
                      {/* Curriculum Tools Card */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <GraduationCap className="h-4 w-4" style={{ color: BRAND.primary }} />
                            Curriculum Tools
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full justify-start"
                            disabled={seedingEducation}
                            onClick={async () => {
                              setSeedingEducation(true);
                              try {
                                const res = await fetch('/api/admin/seed-education-data', { method: 'POST', credentials: 'include' });
                                if (res.ok) {
                                  const result = await res.json();
                                  toast({ title: 'Data Seeded', description: `${result.boards} boards, ${result.classes} classes, ${result.subjects} subjects` });
                                  refetchQuestions();
                                } else throw new Error((await res.json()).message || 'Seed failed');
                              } catch (e: any) {
                                toast({ title: 'Error', description: e.message, variant: 'destructive' });
                              } finally { setSeedingEducation(false); }
                            }}
                            data-testid="btn-seed-education"
                          >
                            {seedingEducation ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Database className="h-4 w-4 mr-2" />}
                            {seedingEducation ? 'Seeding...' : 'Seed Boards/Classes'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full justify-start"
                            onClick={() => { window.location.href = '/api/admin/curriculum/template'; }}
                            data-testid="btn-download-curriculum-template"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download CSV Template
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full justify-start"
                            onClick={() => setCurriculumImportDialog(true)}
                            data-testid="btn-import-curriculum"
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Import Curriculum CSV
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full justify-start"
                            style={{ borderColor: BRAND.accent, color: BRAND.accent }}
                            onClick={() => setAiGenerateDialog(true)}
                            data-testid="btn-ai-generate-curriculum"
                          >
                            <Sparkles className="h-4 w-4 mr-2" />
                            AI Generate Curriculum
                          </Button>
                        </CardContent>
                      </Card>

                      {/* Question Tools Card */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Database className="h-4 w-4" style={{ color: BRAND.primary }} />
                            Question Tools
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full justify-start"
                            onClick={() => { window.location.href = '/api/admin/question-bank/template'; }}
                            data-testid="btn-download-template"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download Q Template
                          </Button>
                          <Button
                            size="sm"
                            className="w-full justify-start text-white"
                            style={{ backgroundColor: BRAND.primary }}
                            onClick={() => setQbUploadDialog(true)}
                            data-testid="btn-upload-questions"
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Upload Questions
                          </Button>
                        </CardContent>
                      </Card>

                      {/* Blueprint Tools Card */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <FileText className="h-4 w-4" style={{ color: BRAND.primary }} />
                            Blueprint Tools
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <Button
                            size="sm"
                            className="w-full justify-start text-white"
                            style={{ backgroundColor: BRAND.primary }}
                            onClick={() => {
                              setBlueprintData({
                                blueprintName: '', boardId: '', classId: '', subjectId: '',
                                assessmentType: 'SamplePaper', totalMarks: 100, duration: 180,
                                sections: [{ sectionName: 'Section A', questionType: 'MCQ', questionsCount: 20, marksPerQuestion: 1, difficultyMix: '30:50:20' }]
                              });
                              setBlueprintDialog(true);
                            }}
                            data-testid="btn-create-blueprint"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Create Blueprint
                          </Button>
                        </CardContent>
                      </Card>

                      {/* Quick Stats */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-semibold">Quick Stats</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Total Questions</span>
                            <span className="font-bold" style={{ color: BRAND.primary }}>{questionBankQuestions.length}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Blueprints</span>
                            <span className="font-bold" style={{ color: BRAND.primary }}>{blueprints.length}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Boards</span>
                            <span className="font-bold" style={{ color: BRAND.primary }}>{boards.length}</span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Right Content Area */}
                    <div className="lg:col-span-3 space-y-4">
                      {/* Sub Navigation Tabs */}
                      <div className="bg-gray-100 p-1 rounded-lg inline-flex gap-1">
                        <button
                          onClick={() => setQbSubTab('questions')}
                          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${qbSubTab === 'questions' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
                          data-testid="tab-questions"
                        >
                          <Database className="h-4 w-4 inline mr-2" />
                          Questions ({questionBankQuestions.length})
                        </button>
                        <button
                          onClick={() => setQbSubTab('blueprints')}
                          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${qbSubTab === 'blueprints' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
                          data-testid="tab-blueprints"
                        >
                          <FileText className="h-4 w-4 inline mr-2" />
                          Blueprints ({blueprints.length})
                        </button>
                      </div>

                      {qbSubTab === 'questions' && (
                        <div className="space-y-4">
                          {/* Filters Row */}
                          <Card>
                            <CardContent className="p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <Filter className="h-4 w-4 text-gray-400" />
                                <span className="text-sm font-medium text-gray-700">Filter Questions</span>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Select value={qbBoardFilter} onValueChange={(v) => { setQbBoardFilter(v); setQbClassFilter('all'); setQbSubjectFilter('all'); }}>
                                  <SelectTrigger data-testid="select-qb-board">
                                    <SelectValue placeholder="All Boards" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">All Boards</SelectItem>
                                    {boards.map((board: any) => (
                                      <SelectItem key={board.id} value={board.id}>{board.boardName}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Select value={qbClassFilter} onValueChange={(v) => { setQbClassFilter(v); setQbSubjectFilter('all'); }} disabled={qbBoardFilter === 'all'}>
                                  <SelectTrigger data-testid="select-qb-class">
                                    <SelectValue placeholder="All Classes" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">All Classes</SelectItem>
                                    {classes.map((cls: any) => (
                                      <SelectItem key={cls.id} value={cls.id}>{cls.className}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Select value={qbSubjectFilter} onValueChange={setQbSubjectFilter} disabled={qbClassFilter === 'all'}>
                                  <SelectTrigger data-testid="select-qb-subject">
                                    <SelectValue placeholder="All Subjects" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">All Subjects</SelectItem>
                                    {subjects.map((sub: any) => (
                                      <SelectItem key={sub.id} value={sub.id}>{sub.subjectName}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </CardContent>
                          </Card>

                          {/* Difficulty Distribution */}
                          <div className="grid grid-cols-3 gap-3">
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                              <p className="text-2xl font-bold text-green-700">{questionBankQuestions.filter((q: any) => q.difficulty === 'Easy').length}</p>
                              <p className="text-xs text-green-600 font-medium">Easy</p>
                            </div>
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                              <p className="text-2xl font-bold text-amber-700">{questionBankQuestions.filter((q: any) => q.difficulty === 'Medium').length}</p>
                              <p className="text-xs text-amber-600 font-medium">Medium</p>
                            </div>
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                              <p className="text-2xl font-bold text-red-700">{questionBankQuestions.filter((q: any) => q.difficulty === 'Hard').length}</p>
                              <p className="text-xs text-red-600 font-medium">Hard</p>
                            </div>
                          </div>

                          {/* Questions List */}
                          <Card>
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-base">Questions</CardTitle>
                                <Badge variant="outline">{questionBankQuestions.length} total</Badge>
                              </div>
                            </CardHeader>
                            <CardContent>
                              {questionBankQuestions.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                  <Database className="h-12 w-12 mx-auto mb-4 opacity-30" />
                                  <p className="font-medium">No questions found</p>
                                  <p className="text-sm">Use the tools on the left to upload questions</p>
                                </div>
                              ) : (
                                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                                  {questionBankQuestions.slice(0, 50).map((q: any, idx: number) => (
                                    <div key={q.id || idx} className="p-4 rounded-lg bg-gray-50 border hover:border-gray-300 transition-colors" data-testid={`question-${idx}`}>
                                      <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                          <p className="font-medium text-gray-900 mb-2">{idx + 1}. {q.questionText}</p>
                                          <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div className={q.correctOption === 'A' ? 'text-green-700 font-medium' : 'text-gray-600'}>A: {q.optionA}</div>
                                            <div className={q.correctOption === 'B' ? 'text-green-700 font-medium' : 'text-gray-600'}>B: {q.optionB}</div>
                                            <div className={q.correctOption === 'C' ? 'text-green-700 font-medium' : 'text-gray-600'}>C: {q.optionC}</div>
                                            <div className={q.correctOption === 'D' ? 'text-green-700 font-medium' : 'text-gray-600'}>D: {q.optionD}</div>
                                          </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                          <Badge variant="outline" className={
                                            q.difficulty === 'Easy' ? 'bg-green-50 text-green-700 border-green-200' :
                                            q.difficulty === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                            'bg-red-50 text-red-700 border-red-200'
                                          }>
                                            {q.difficulty || 'Medium'}
                                          </Badge>
                                          <span className="text-xs text-gray-500">{q.marks} marks</span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                  {questionBankQuestions.length > 50 && (
                                    <p className="text-center text-sm text-gray-500 py-2">Showing 50 of {questionBankQuestions.length} questions</p>
                                  )}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </div>
                      )}

                      {/* Blueprints Sub-Tab */}
                      {qbSubTab === 'blueprints' && (
                        <div className="space-y-4">
                          {/* Blueprint Stats Row */}
                          <div className="grid grid-cols-4 gap-3">
                            <div className="border rounded-lg p-3 text-center" style={{ borderColor: BRAND.primary + '30' }}>
                              <p className="text-2xl font-bold" style={{ color: BRAND.primary }}>{blueprints.length}</p>
                              <p className="text-xs text-gray-500">Total</p>
                            </div>
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                              <p className="text-2xl font-bold text-green-700">{blueprints.filter((b: any) => b.status === 'Active').length}</p>
                              <p className="text-xs text-green-600">Active</p>
                            </div>
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                              <p className="text-2xl font-bold text-amber-700">{blueprints.filter((b: any) => b.assessmentType === 'SamplePaper').length}</p>
                              <p className="text-xs text-amber-600">Sample Papers</p>
                            </div>
                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
                              <p className="text-2xl font-bold text-purple-700">{blueprints.filter((b: any) => b.assessmentType === 'MockTest').length}</p>
                              <p className="text-xs text-purple-600">Mock Tests</p>
                            </div>
                          </div>

                          {/* Blueprints List */}
                          <Card>
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-base">Assessment Blueprints</CardTitle>
                                <Badge variant="outline">{blueprints.length} total</Badge>
                              </div>
                              <CardDescription>Define paper structure and auto-generate tests from question bank</CardDescription>
                            </CardHeader>
                            <CardContent>
                              {blueprints.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                                  <p className="font-medium">No blueprints created yet</p>
                                  <p className="text-sm">Use the "Create Blueprint" button in the left panel</p>
                                </div>
                              ) : (
                                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                                  {blueprints.map((bp: any, idx: number) => (
                                    <div key={bp.id || idx} className="p-4 rounded-lg border bg-gray-50 hover:border-gray-300 transition-colors" data-testid={`blueprint-${idx}`}>
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-2">
                                            <h4 className="font-semibold text-gray-900">{bp.blueprintName}</h4>
                                            <Badge variant="outline" className="text-xs">{bp.assessmentType}</Badge>
                                            <Badge variant="outline" className={bp.status === 'Active' ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-600'}>{bp.status}</Badge>
                                          </div>
                                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                                            <div><span className="text-gray-400">Marks:</span> <strong>{bp.totalMarks}</strong></div>
                                            <div><span className="text-gray-400">Duration:</span> <strong>{bp.duration}m</strong></div>
                                            <div><span className="text-gray-400">Board:</span> <strong>{bp.boardId || 'Any'}</strong></div>
                                            <div><span className="text-gray-400">Class:</span> <strong>{bp.classId || 'Any'}</strong></div>
                                          </div>
                                        </div>
                                        <div className="flex gap-2">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={async () => {
                                              setGeneratingPaper(true);
                                              try {
                                                const res = await fetch(`/api/admin/generate-paper/${bp.id}`, {
                                                  method: 'POST',
                                                  headers: { 'Content-Type': 'application/json' },
                                                  credentials: 'include',
                                                  body: JSON.stringify({ seed: Date.now() })
                                                });
                                                if (res.ok) {
                                                  const paper = await res.json();
                                                  setGeneratedPaper(paper);
                                                  toast({ title: 'Paper Generated', description: `Generated ${paper.totalMarks} marks paper` });
                                                } else {
                                                  toast({ title: 'Error', description: 'Failed to generate paper', variant: 'destructive' });
                                                }
                                              } catch (e) {
                                                toast({ title: 'Error', description: 'Generation failed', variant: 'destructive' });
                                              } finally { setGeneratingPaper(false); }
                                            }}
                                            disabled={generatingPaper}
                                            data-testid={`btn-generate-paper-${idx}`}
                                          >
                                            {generatingPaper ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
                                            Generate
                                          </Button>
                                          <Button size="sm" variant="ghost" className="text-red-600" data-testid={`btn-delete-blueprint-${idx}`}>
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                          </Card>

                          {/* Generated Paper Preview */}
                          {generatedPaper && (
                            <Card>
                              <CardHeader>
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-base flex items-center gap-2">
                                    <Check className="h-5 w-5 text-green-600" />
                                    Generated Paper Preview
                                  </CardTitle>
                                  <Button size="sm" variant="ghost" onClick={() => setGeneratedPaper(null)}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                                <CardDescription>Total Marks: {generatedPaper.totalMarks} | Sections: {generatedPaper.sections.length}</CardDescription>
                              </CardHeader>
                              <CardContent>
                                <div className="space-y-6">
                                  {generatedPaper.sections.map((section: any, sIdx: number) => (
                                    <div key={sIdx} className="border rounded-lg p-4">
                                      <h4 className="font-semibold mb-3" style={{ color: BRAND.primary }}>
                                        {section.sectionName} ({section.questions.length} questions)
                                      </h4>
                                      <div className="space-y-3 max-h-64 overflow-y-auto">
                                        {section.questions.map((q: any, qIdx: number) => (
                                          <div key={qIdx} className="p-3 bg-gray-50 rounded text-sm">
                                            <p className="font-medium">{qIdx + 1}. {q.questionText}</p>
                                            {q.optionA && (
                                              <div className="grid grid-cols-2 gap-1 mt-2 text-xs text-gray-600">
                                                <span>A: {q.optionA}</span>
                                                <span>B: {q.optionB}</span>
                                                <span>C: {q.optionC}</span>
                                                <span>D: {q.optionD}</span>
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
  );
}
