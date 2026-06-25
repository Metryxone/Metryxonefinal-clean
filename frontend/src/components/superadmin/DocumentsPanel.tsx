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

export default function DocumentsPanel() {
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

                const totalDocs = documentsData.length;
                const pendingDocs = documentsData.filter((d: any) => d.status === 'pending');
                const makerVerifiedDocs = documentsData.filter((d: any) => d.status === 'maker_verified');
                const approvedDocs = documentsData.filter((d: any) => d.status === 'checker_approved');
                const rejectedDocs = documentsData.filter((d: any) => d.status === 'rejected');
                const pendingCount = pendingDocs.length + makerVerifiedDocs.length;
                const approvedCount = approvedDocs.length;
                const totalFileSize = documentsData.reduce((sum: number, d: any) => sum + (d.fileSize || 0), 0);
                const storageMB = (totalFileSize / (1024 * 1024)).toFixed(1);
                const storageDisplay = totalFileSize >= 1024 * 1024 * 1024
                  ? `${(totalFileSize / (1024 * 1024 * 1024)).toFixed(1)} GB`
                  : `${storageMB} MB`;

                const entityGroups: Record<string, { count: number; icon: any; color: string; label: string }> = {
                  institution: { count: 0, icon: Building2, color: BRAND.primary, label: 'Institutions' },
                  parent: { count: 0, icon: Users, color: BRAND.accent, label: 'Parents' },
                  student: { count: 0, icon: GraduationCap, color: '#f59e0b', label: 'Students' },
                  ngo: { count: 0, icon: Heart, color: '#ef4444', label: 'NGOs' },
                  mentor: { count: 0, icon: UserCheck, color: '#8b5cf6', label: 'Mentors' },
                };
                documentsData.forEach((d: any) => {
                  const et = d.entityType?.toLowerCase();
                  if (entityGroups[et]) entityGroups[et].count++;
                });
                const folders = Object.entries(entityGroups).filter(([, v]) => v.count > 0 || ['institution', 'parent', 'student', 'ngo'].includes(Object.keys(entityGroups).find(k => entityGroups[k] === v) || ''));

                const handleDocumentAction = async (docId: string, action: 'maker-verify' | 'checker-approve' | 'reject', body?: any) => {
                  try {
                    const res = await fetch(`/api/admin/documents/${docId}/${action}`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify(body || {}),
                    });
                    if (!res.ok) {
                      const err = await res.json().catch(() => ({ error: 'Action failed' }));
                      throw new Error(err.error || 'Action failed');
                    }
                    queryClient.invalidateQueries({ queryKey: ['/api/admin/documents'] });
                    const labels: Record<string, string> = { 'maker-verify': 'Verified', 'checker-approve': 'Approved', 'reject': 'Rejected' };
                    toast({ title: `Document ${labels[action]}`, description: `Document has been ${labels[action].toLowerCase()} successfully.` });
                  } catch (error: any) {
                    toast({ title: 'Error', description: error.message, variant: 'destructive' });
                  }
                };

                const pendingApprovalDocs = documentsData.filter((d: any) => d.status === 'pending' || d.status === 'maker_verified');

                return (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Document Management</h3>
                      <p className="text-sm text-gray-500">SOC2/ISO compliant document storage with maker-checker workflow</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="gap-2" data-testid="button-refresh-documents" onClick={() => refetchDocuments()}>
                        <RefreshCw className="h-4 w-4" />
                        Refresh
                      </Button>
                      <Button style={{ backgroundColor: BRAND.primary }} className="gap-2 text-white" data-testid="button-upload-document">
                        <Upload className="h-4 w-4" />
                        Upload Document
                      </Button>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-4 gap-4">
                    <Card data-testid="card-total-documents">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">Total Documents</p>
                            <p className="text-2xl font-bold" data-testid="text-total-documents-count">{documentsLoading ? '...' : totalDocs.toLocaleString()}</p>
                          </div>
                          <FileCheck className="h-8 w-8" style={{ color: BRAND.primary }} />
                        </div>
                      </CardContent>
                    </Card>
                    <Card data-testid="card-pending-documents">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">Pending Verification</p>
                            <p className="text-2xl font-bold text-orange-600" data-testid="text-pending-documents-count">{documentsLoading ? '...' : pendingCount.toLocaleString()}</p>
                          </div>
                          <Clock className="h-8 w-8 text-orange-500" />
                        </div>
                      </CardContent>
                    </Card>
                    <Card data-testid="card-approved-documents">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">Approved</p>
                            <p className="text-2xl font-bold text-green-600" data-testid="text-approved-documents-count">{documentsLoading ? '...' : approvedCount.toLocaleString()}</p>
                          </div>
                          <CheckCircle className="h-8 w-8 text-green-500" />
                        </div>
                      </CardContent>
                    </Card>
                    <Card data-testid="card-storage-used">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">Storage Used</p>
                            <p className="text-2xl font-bold" style={{ color: BRAND.accent }} data-testid="text-storage-used">{documentsLoading ? '...' : storageDisplay}</p>
                          </div>
                          <Database className="h-8 w-8" style={{ color: BRAND.accent }} />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-1">
                      <CardHeader className="border-b">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          Folder Structure
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="divide-y">
                          {folders.map(([key, folder]) => (
                            <button
                              key={key}
                              className={`w-full p-4 flex items-center justify-between hover:bg-gray-50 text-left ${documentEntityFilter === key ? 'bg-gray-50 border-l-2' : ''}`}
                              style={documentEntityFilter === key ? { borderLeftColor: folder.color } : {}}
                              onClick={() => setDocumentEntityFilter(documentEntityFilter === key ? 'all' : key)}
                              data-testid={`button-folder-${key}`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${folder.color}15` }}>
                                  <folder.icon className="h-5 w-5" style={{ color: folder.color }} />
                                </div>
                                <span className="font-medium">{folder.label}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-500" data-testid={`text-folder-count-${key}`}>{folder.count}</span>
                                <ChevronRight className="h-4 w-4 text-gray-400" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="lg:col-span-2">
                      <CardHeader className="border-b">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">Recent Documents</CardTitle>
                          <div className="flex gap-2">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                              <Input
                                placeholder="Search documents..."
                                className="pl-10 w-48"
                                data-testid="input-search-documents"
                                value={documentSearch}
                                onChange={(e) => setDocumentSearch(e.target.value)}
                              />
                            </div>
                            <Select value={documentStatusFilter} onValueChange={setDocumentStatusFilter}>
                              <SelectTrigger className="w-32" data-testid="select-document-status">
                                <SelectValue placeholder="Status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="maker_verified">Maker Verified</SelectItem>
                                <SelectItem value="checker_approved">Approved</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="divide-y">
                          {documentsLoading ? (
                            <div className="p-8 text-center text-gray-500">
                              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                              Loading documents...
                            </div>
                          ) : documentsData.length === 0 ? (
                            <div className="p-8 text-center text-gray-500" data-testid="text-no-documents">
                              <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                              No documents found
                            </div>
                          ) : (
                            documentsData.slice(0, 10).map((doc: any) => (
                              <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-gray-50" data-testid={`row-document-${doc.id}`}>
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-100">
                                    <FileText className="h-5 w-5 text-gray-600" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-sm" data-testid={`text-document-name-${doc.id}`}>{doc.documentName}</p>
                                    <p className="text-xs text-gray-500">{doc.documentCategory} • {doc.entityType}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <Badge variant={
                                    doc.status === 'checker_approved' ? 'default' :
                                    doc.status === 'maker_verified' ? 'secondary' :
                                    doc.status === 'rejected' ? 'destructive' : 'outline'
                                  } data-testid={`badge-status-${doc.id}`}>
                                    {(doc.status || '').replace(/_/g, ' ')}
                                  </Badge>
                                  <span className="text-xs text-gray-500">{doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : ''}</span>
                                  <Button size="sm" variant="ghost" data-testid={`button-view-document-${doc.id}`}><Eye className="h-4 w-4" /></Button>
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
                        <ClipboardList className="h-5 w-5" style={{ color: BRAND.primary }} />
                        Documents Pending Approval (Maker-Checker Workflow)
                        {pendingApprovalDocs.length > 0 && (
                          <Badge variant="outline" className="ml-2" data-testid="badge-pending-approval-count">{pendingApprovalDocs.length}</Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      {pendingApprovalDocs.length === 0 ? (
                        <div className="p-8 text-center text-gray-500" data-testid="text-no-pending-approvals">
                          <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-300" />
                          All documents are up to date — no pending approvals
                        </div>
                      ) : (
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Document</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Entity</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Category</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {pendingApprovalDocs.map((item: any) => (
                            <tr key={item.id} className="hover:bg-gray-50" data-testid={`row-pending-document-${item.id}`}>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <FileCheck className="h-5 w-5 text-gray-400" />
                                  <span className="font-medium" data-testid={`text-pending-doc-name-${item.id}`}>{item.documentName}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">{item.entityType} - {item.entityId}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{item.documentCategory}</td>
                              <td className="px-4 py-3">
                                <Badge variant={item.status === 'maker_verified' ? 'secondary' : 'outline'} data-testid={`badge-pending-status-${item.id}`}>
                                  {(item.status || '').replace(/_/g, ' ')}
                                </Badge>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex gap-2">
                                  {item.status === 'pending' && (
                                    <Button
                                      size="sm"
                                      style={{ backgroundColor: BRAND.accent }}
                                      className="text-white gap-1"
                                      data-testid={`button-verify-document-${item.id}`}
                                      onClick={() => handleDocumentAction(item.id, 'maker-verify')}
                                    >
                                      <Check className="h-3 w-3" /> Verify
                                    </Button>
                                  )}
                                  {item.status === 'maker_verified' && (
                                    <Button
                                      size="sm"
                                      style={{ backgroundColor: BRAND.primary }}
                                      className="text-white gap-1"
                                      data-testid={`button-approve-document-${item.id}`}
                                      onClick={() => handleDocumentAction(item.id, 'checker-approve')}
                                    >
                                      <CheckCircle className="h-3 w-3" /> Approve
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1"
                                    data-testid={`button-reject-document-${item.id}`}
                                    onClick={() => {
                                      const reason = prompt('Enter rejection reason:');
                                      if (reason) handleDocumentAction(item.id, 'reject', { reason });
                                    }}
                                  >
                                    <X className="h-3 w-3" /> Reject
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      )}
                    </CardContent>
                  </Card>
                </div>
                );
}
