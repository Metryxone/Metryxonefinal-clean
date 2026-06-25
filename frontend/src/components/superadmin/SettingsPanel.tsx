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

export default function SettingsPanel() {
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
                  {platformSettingsData.length === 0 && (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <Settings className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No Settings Configured</h3>
                        <p className="text-gray-500 mb-4">Initialize default platform settings to get started.</p>
                        <Button onClick={seedDefaultSettings} style={{ backgroundColor: BRAND.primary }} className="text-white" data-testid="btn-seed-settings">
                          <Zap className="h-4 w-4 mr-2" /> Initialize Default Settings
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                  {platformSettingsData.length > 0 && (
                    <>
                      <div className="flex gap-2 flex-wrap">
                        {[
                          { key: 'general' as const, label: 'General', icon: Settings },
                          { key: 'security' as const, label: 'Security', icon: Shield },
                          { key: 'notifications' as const, label: 'Notifications', icon: Bell },
                          { key: 'integrations' as const, label: 'Integrations', icon: Zap },
                          { key: 'compliance' as const, label: 'Compliance', icon: Scale },
                        ].map(tab => (
                          <Button
                            key={tab.key}
                            variant={settingsSubTab === tab.key ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSettingsSubTab(tab.key)}
                            style={settingsSubTab === tab.key ? { backgroundColor: BRAND.primary } : {}}
                            className={settingsSubTab === tab.key ? 'text-white' : ''}
                            data-testid={`btn-settings-tab-${tab.key}`}
                          >
                            <tab.icon className="h-4 w-4 mr-1.5" /> {tab.label}
                          </Button>
                        ))}
                      </div>

                      {settingsSubTab === 'general' && (
                        <div className="space-y-6">
                        <div className="grid lg:grid-cols-2 gap-6">
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base flex items-center gap-2">
                                <ToggleLeft className="h-5 w-5" style={{ color: BRAND.primary }} />
                                Platform Controls
                              </CardTitle>
                              <CardDescription>Core platform behavior settings</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5">
                              <div className="flex items-center justify-between" data-testid="setting-maintenance-mode">
                                <div className="space-y-0.5">
                                  <Label className="text-sm font-medium">Maintenance Mode</Label>
                                  <p className="text-xs text-gray-500">Restrict access for non-admin users</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {settingsSaving === 'maintenance_mode' && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
                                  <Switch
                                    checked={getSettingBool('maintenance_mode')}
                                    onCheckedChange={(checked) => updateSetting('maintenance_mode', String(checked), 'boolean', 'general')}
                                    data-testid="switch-maintenance-mode"
                                  />
                                </div>
                              </div>
                              <div className="flex items-center justify-between" data-testid="setting-registration-enabled">
                                <div className="space-y-0.5">
                                  <Label className="text-sm font-medium">Registration Enabled</Label>
                                  <p className="text-xs text-gray-500">Allow new user sign-ups</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {settingsSaving === 'registration_enabled' && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
                                  <Switch
                                    checked={getSettingBool('registration_enabled', true)}
                                    onCheckedChange={(checked) => updateSetting('registration_enabled', String(checked), 'boolean', 'general')}
                                    data-testid="switch-registration-enabled"
                                  />
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base flex items-center gap-2">
                                <Globe className="h-5 w-5" style={{ color: BRAND.primary }} />
                                Platform Information
                              </CardTitle>
                              <CardDescription>General platform configuration</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div data-testid="setting-platform-name">
                                <Label className="text-sm font-medium">Platform Name</Label>
                                <div className="flex gap-2 mt-1">
                                  <Input
                                    defaultValue={getSettingValue('platform_name', 'MetryxOne')}
                                    onBlur={(e) => {
                                      if (e.target.value !== getSettingValue('platform_name', 'MetryxOne')) {
                                        updateSetting('platform_name', e.target.value, 'string', 'general');
                                      }
                                    }}
                                    data-testid="input-platform-name"
                                  />
                                </div>
                              </div>
                              <div data-testid="setting-support-email">
                                <Label className="text-sm font-medium">Support Email</Label>
                                <div className="flex gap-2 mt-1">
                                  <Input
                                    defaultValue={getSettingValue('support_email', 'support@metryxone.com')}
                                    onBlur={(e) => {
                                      if (e.target.value !== getSettingValue('support_email', 'support@metryxone.com')) {
                                        updateSetting('support_email', e.target.value, 'string', 'general');
                                      }
                                    }}
                                    data-testid="input-support-email"
                                  />
                                </div>
                              </div>
                              <div data-testid="setting-max-upload">
                                <Label className="text-sm font-medium">Max File Upload (MB)</Label>
                                <div className="flex gap-2 mt-1">
                                  <Input
                                    type="number"
                                    defaultValue={getSettingValue('max_file_upload_mb', '10')}
                                    onBlur={(e) => {
                                      if (e.target.value !== getSettingValue('max_file_upload_mb', '10')) {
                                        updateSetting('max_file_upload_mb', e.target.value, 'number', 'general');
                                      }
                                    }}
                                    data-testid="input-max-upload"
                                  />
                                </div>
                              </div>
                              <div data-testid="setting-default-language">
                                <Label className="text-sm font-medium">Default Language</Label>
                                <Select
                                  value={getSettingValue('default_language', 'en')}
                                  onValueChange={(val) => updateSetting('default_language', val, 'string', 'general')}
                                >
                                  <SelectTrigger className="mt-1" data-testid="select-default-language">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="en">English</SelectItem>
                                    <SelectItem value="hi">Hindi</SelectItem>
                                    <SelectItem value="ta">Tamil</SelectItem>
                                    <SelectItem value="te">Telugu</SelectItem>
                                    <SelectItem value="kn">Kannada</SelectItem>
                                    <SelectItem value="ml">Malayalam</SelectItem>
                                    <SelectItem value="mr">Marathi</SelectItem>
                                    <SelectItem value="bn">Bengali</SelectItem>
                                    <SelectItem value="gu">Gujarati</SelectItem>
                                    <SelectItem value="pa">Punjabi</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        {/* Counsellor Contact */}
                        <Card data-testid="setting-counsellor-whatsapp">
                          <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                              <Phone className="h-5 w-5" style={{ color: BRAND.primary }} />
                              Counsellor Contact
                            </CardTitle>
                            <CardDescription>
                              WhatsApp number shown on the escalation CTA when a user's assessment signals indicate they need human support. Include country code, no spaces or dashes (e.g. 919876543210).
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="flex gap-2 items-end max-w-sm">
                              <div className="flex-1">
                                <Label className="text-sm font-medium">WhatsApp Number</Label>
                                <Input
                                  key={getSettingValue('counsellor_whatsapp_number', '919999999999')}
                                  defaultValue={getSettingValue('counsellor_whatsapp_number', '919999999999')}
                                  placeholder="e.g. 919876543210"
                                  className="mt-1 font-mono"
                                  onBlur={async (e) => {
                                    const val = e.target.value.trim();
                                    if (!val || val === getSettingValue('counsellor_whatsapp_number', '919999999999')) return;
                                    if (!/^\d{10,15}$/.test(val)) {
                                      toast({ title: 'Invalid number', description: 'Enter digits only with country code, 10–15 digits (e.g. 919876543210).', variant: 'destructive' });
                                      return;
                                    }
                                    setSettingsSaving('counsellor_whatsapp_number');
                                    try {
                                      const res = await fetch('/api/admin/platform-settings', {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        credentials: 'include',
                                        body: JSON.stringify({ settingKey: 'counsellor_whatsapp_number', settingValue: val, settingType: 'string', category: 'general', description: 'Global WhatsApp number for the counsellor escalation CTA' }),
                                      });
                                      if (!res.ok) throw new Error('Server error');
                                      queryClient.invalidateQueries({ queryKey: ['/api/admin/platform-settings'] });
                                      toast({ title: 'Counsellor number updated' });
                                    } catch { toast({ title: 'Failed to save', variant: 'destructive' }); }
                                    finally { setSettingsSaving(null); }
                                  }}
                                  data-testid="input-counsellor-whatsapp"
                                />
                              </div>
                              {settingsSaving === 'counsellor_whatsapp_number'
                                ? <Loader2 className="h-4 w-4 animate-spin text-gray-400 mb-2" />
                                : getSettingValue('counsellor_whatsapp_number') && (
                                    <a
                                      href={`https://wa.me/${getSettingValue('counsellor_whatsapp_number', '919999999999')}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="mb-1 text-green-600 hover:text-green-700 text-xs font-medium flex items-center gap-1 whitespace-nowrap"
                                    >
                                      <Phone className="h-3.5 w-3.5" /> Test link
                                    </a>
                                  )
                              }
                            </div>
                          </CardContent>
                        </Card>
                        </div>
                      )}

                      {settingsSubTab === 'security' && (
                        <div className="grid lg:grid-cols-2 gap-6">
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base flex items-center gap-2">
                                <Lock className="h-5 w-5" style={{ color: BRAND.primary }} />
                                Authentication
                              </CardTitle>
                              <CardDescription>Login and session security</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5">
                              <div className="flex items-center justify-between" data-testid="setting-2fa">
                                <div className="space-y-0.5">
                                  <Label className="text-sm font-medium">Require Two-Factor Auth</Label>
                                  <p className="text-xs text-gray-500">All users must enable 2FA</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {settingsSaving === 'two_factor_required' && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
                                  <Switch
                                    checked={getSettingBool('two_factor_required')}
                                    onCheckedChange={(checked) => updateSetting('two_factor_required', String(checked), 'boolean', 'security')}
                                    data-testid="switch-2fa"
                                  />
                                </div>
                              </div>
                              <div data-testid="setting-session-timeout">
                                <Label className="text-sm font-medium">Session Timeout (minutes)</Label>
                                <Input
                                  type="number"
                                  className="mt-1"
                                  defaultValue={getSettingValue('session_timeout_minutes', '60')}
                                  onBlur={(e) => {
                                    if (e.target.value !== getSettingValue('session_timeout_minutes', '60')) {
                                      updateSetting('session_timeout_minutes', e.target.value, 'number', 'security');
                                    }
                                  }}
                                  data-testid="input-session-timeout"
                                />
                              </div>
                              <div data-testid="setting-max-login-attempts">
                                <Label className="text-sm font-medium">Max Login Attempts</Label>
                                <Input
                                  type="number"
                                  className="mt-1"
                                  defaultValue={getSettingValue('max_login_attempts', '5')}
                                  onBlur={(e) => {
                                    if (e.target.value !== getSettingValue('max_login_attempts', '5')) {
                                      updateSetting('max_login_attempts', e.target.value, 'number', 'security');
                                    }
                                  }}
                                  data-testid="input-max-login-attempts"
                                />
                              </div>
                              <div data-testid="setting-lockout-duration">
                                <Label className="text-sm font-medium">Lockout Duration (minutes)</Label>
                                <Input
                                  type="number"
                                  className="mt-1"
                                  defaultValue={getSettingValue('lockout_duration_minutes', '30')}
                                  onBlur={(e) => {
                                    if (e.target.value !== getSettingValue('lockout_duration_minutes', '30')) {
                                      updateSetting('lockout_duration_minutes', e.target.value, 'number', 'security');
                                    }
                                  }}
                                  data-testid="input-lockout-duration"
                                />
                              </div>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base flex items-center gap-2">
                                <Key className="h-5 w-5" style={{ color: BRAND.primary }} />
                                Password Policy
                              </CardTitle>
                              <CardDescription>Password requirements for users</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5">
                              <div data-testid="setting-password-min-length">
                                <Label className="text-sm font-medium">Minimum Length</Label>
                                <Input
                                  type="number"
                                  className="mt-1"
                                  defaultValue={getSettingValue('password_min_length', '8')}
                                  onBlur={(e) => {
                                    if (e.target.value !== getSettingValue('password_min_length', '8')) {
                                      updateSetting('password_min_length', e.target.value, 'number', 'security');
                                    }
                                  }}
                                  data-testid="input-password-min-length"
                                />
                              </div>
                              <div className="flex items-center justify-between" data-testid="setting-require-uppercase">
                                <div className="space-y-0.5">
                                  <Label className="text-sm font-medium">Require Uppercase</Label>
                                  <p className="text-xs text-gray-500">At least one uppercase letter</p>
                                </div>
                                <Switch
                                  checked={getSettingBool('password_require_uppercase', true)}
                                  onCheckedChange={(checked) => updateSetting('password_require_uppercase', String(checked), 'boolean', 'security')}
                                  data-testid="switch-require-uppercase"
                                />
                              </div>
                              <div className="flex items-center justify-between" data-testid="setting-require-numbers">
                                <div className="space-y-0.5">
                                  <Label className="text-sm font-medium">Require Numbers</Label>
                                  <p className="text-xs text-gray-500">At least one numeric digit</p>
                                </div>
                                <Switch
                                  checked={getSettingBool('password_require_numbers', true)}
                                  onCheckedChange={(checked) => updateSetting('password_require_numbers', String(checked), 'boolean', 'security')}
                                  data-testid="switch-require-numbers"
                                />
                              </div>
                              <div className="flex items-center justify-between" data-testid="setting-require-special">
                                <div className="space-y-0.5">
                                  <Label className="text-sm font-medium">Require Special Characters</Label>
                                  <p className="text-xs text-gray-500">At least one special character</p>
                                </div>
                                <Switch
                                  checked={getSettingBool('password_require_special', true)}
                                  onCheckedChange={(checked) => updateSetting('password_require_special', String(checked), 'boolean', 'security')}
                                  data-testid="switch-require-special"
                                />
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      )}

                      {settingsSubTab === 'notifications' && (
                        <div className="grid lg:grid-cols-2 gap-6">
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base flex items-center gap-2">
                                <Bell className="h-5 w-5" style={{ color: BRAND.primary }} />
                                Notification Channels
                              </CardTitle>
                              <CardDescription>Enable or disable notification methods</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5">
                              <div className="flex items-center justify-between" data-testid="setting-email-notifications">
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND.primary}15` }}>
                                    <Mail className="h-5 w-5" style={{ color: BRAND.primary }} />
                                  </div>
                                  <div className="space-y-0.5">
                                    <Label className="text-sm font-medium">Email Notifications</Label>
                                    <p className="text-xs text-gray-500">Send notifications via email</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {settingsSaving === 'email_notifications' && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
                                  <Switch
                                    checked={getSettingBool('email_notifications', true)}
                                    onCheckedChange={(checked) => updateSetting('email_notifications', String(checked), 'boolean', 'notifications')}
                                    data-testid="switch-email-notifications"
                                  />
                                </div>
                              </div>
                              <div className="flex items-center justify-between" data-testid="setting-sms-notifications">
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${BRAND.accent}15` }}>
                                    <Smartphone className="h-5 w-5" style={{ color: BRAND.accent }} />
                                  </div>
                                  <div className="space-y-0.5">
                                    <Label className="text-sm font-medium">SMS Notifications</Label>
                                    <p className="text-xs text-gray-500">Send notifications via SMS</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {settingsSaving === 'sms_notifications' && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
                                  <Switch
                                    checked={getSettingBool('sms_notifications')}
                                    onCheckedChange={(checked) => updateSetting('sms_notifications', String(checked), 'boolean', 'notifications')}
                                    data-testid="switch-sms-notifications"
                                  />
                                </div>
                              </div>
                              <div className="flex items-center justify-between" data-testid="setting-push-notifications">
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-orange-50">
                                    <Bell className="h-5 w-5 text-orange-500" />
                                  </div>
                                  <div className="space-y-0.5">
                                    <Label className="text-sm font-medium">Push Notifications</Label>
                                    <p className="text-xs text-gray-500">Browser/app push notifications</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {settingsSaving === 'push_notifications' && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
                                  <Switch
                                    checked={getSettingBool('push_notifications')}
                                    onCheckedChange={(checked) => updateSetting('push_notifications', String(checked), 'boolean', 'notifications')}
                                    data-testid="switch-push-notifications"
                                  />
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base flex items-center gap-2">
                                <Info className="h-5 w-5" style={{ color: BRAND.primary }} />
                                Notification Status
                              </CardTitle>
                              <CardDescription>Current notification configuration summary</CardDescription>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-3">
                                {[
                                  { label: 'Email', key: 'email_notifications', icon: Mail, defaultVal: true },
                                  { label: 'SMS', key: 'sms_notifications', icon: Smartphone, defaultVal: false },
                                  { label: 'Push', key: 'push_notifications', icon: Bell, defaultVal: false },
                                ].map(item => {
                                  const enabled = getSettingBool(item.key, item.defaultVal);
                                  return (
                                    <div key={item.key} className="flex items-center justify-between p-3 rounded-xl bg-gray-50" data-testid={`status-${item.key}`}>
                                      <div className="flex items-center gap-2">
                                        <item.icon className="h-4 w-4 text-gray-500" />
                                        <span className="font-medium text-sm">{item.label}</span>
                                      </div>
                                      <Badge variant={enabled ? 'default' : 'secondary'} className={enabled ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}>
                                        {enabled ? 'Active' : 'Disabled'}
                                      </Badge>
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="mt-4 p-3 rounded-lg bg-blue-50 text-sm text-blue-700 flex items-start gap-2">
                                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                <span>Configure email and SMS service providers in the Integrations tab to enable these channels.</span>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      )}

                      {settingsSubTab === 'integrations' && (
                        <div className="grid lg:grid-cols-2 gap-6">
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base flex items-center gap-2">
                                <CreditCard className="h-5 w-5" style={{ color: BRAND.primary }} />
                                Payment Gateway
                              </CardTitle>
                              <CardDescription>Payment processing configuration</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div data-testid="setting-payment-gateway">
                                <Label className="text-sm font-medium">Provider</Label>
                                <Select
                                  value={getSettingValue('payment_gateway', 'none')}
                                  onValueChange={(val) => updateSetting('payment_gateway', val, 'string', 'integrations')}
                                >
                                  <SelectTrigger className="mt-1" data-testid="select-payment-gateway">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">Not Configured</SelectItem>
                                    <SelectItem value="razorpay">Razorpay</SelectItem>
                                    <SelectItem value="stripe">Stripe</SelectItem>
                                    <SelectItem value="payu">PayU</SelectItem>
                                    <SelectItem value="cashfree">Cashfree</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex items-center justify-between" data-testid="setting-payment-test-mode">
                                <div className="space-y-0.5">
                                  <Label className="text-sm font-medium">Test/Sandbox Mode</Label>
                                  <p className="text-xs text-gray-500">Use test environment for payments</p>
                                </div>
                                <Switch
                                  checked={getSettingBool('payment_gateway_test_mode', true)}
                                  onCheckedChange={(checked) => updateSetting('payment_gateway_test_mode', String(checked), 'boolean', 'integrations')}
                                  data-testid="switch-payment-test-mode"
                                />
                              </div>
                              <div className="p-3 rounded-lg bg-amber-50 text-sm text-amber-700 flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                <span>{getSettingBool('payment_gateway_test_mode', true) ? 'Test mode is active. No real transactions will be processed.' : 'Live mode is active. Real transactions will be processed.'}</span>
                              </div>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base flex items-center gap-2">
                                <Mail className="h-5 w-5" style={{ color: BRAND.primary }} />
                                Communication Services
                              </CardTitle>
                              <CardDescription>Email and SMS provider settings</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div data-testid="setting-email-service">
                                <Label className="text-sm font-medium">Email Service Provider</Label>
                                <Select
                                  value={getSettingValue('email_service', 'none')}
                                  onValueChange={(val) => updateSetting('email_service', val, 'string', 'integrations')}
                                >
                                  <SelectTrigger className="mt-1" data-testid="select-email-service">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">Not Configured</SelectItem>
                                    <SelectItem value="sendgrid">SendGrid</SelectItem>
                                    <SelectItem value="ses">Amazon SES</SelectItem>
                                    <SelectItem value="mailgun">Mailgun</SelectItem>
                                    <SelectItem value="smtp">Custom SMTP</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div data-testid="setting-sms-service">
                                <Label className="text-sm font-medium">SMS Service Provider</Label>
                                <Select
                                  value={getSettingValue('sms_service', 'none')}
                                  onValueChange={(val) => updateSetting('sms_service', val, 'string', 'integrations')}
                                >
                                  <SelectTrigger className="mt-1" data-testid="select-sms-service">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">Not Configured</SelectItem>
                                    <SelectItem value="twilio">Twilio</SelectItem>
                                    <SelectItem value="msg91">MSG91</SelectItem>
                                    <SelectItem value="textlocal">Textlocal</SelectItem>
                                    <SelectItem value="kaleyra">Kaleyra</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex items-center justify-between" data-testid="setting-analytics-enabled">
                                <div className="space-y-0.5">
                                  <Label className="text-sm font-medium">Analytics Tracking</Label>
                                  <p className="text-xs text-gray-500">Enable platform usage analytics</p>
                                </div>
                                <Switch
                                  checked={getSettingBool('analytics_enabled')}
                                  onCheckedChange={(checked) => updateSetting('analytics_enabled', String(checked), 'boolean', 'integrations')}
                                  data-testid="switch-analytics-enabled"
                                />
                              </div>
                            </CardContent>
                          </Card>

                          <Card className="lg:col-span-2">
                            <CardHeader>
                              <CardTitle className="text-base flex items-center gap-2">
                                <Activity className="h-5 w-5" style={{ color: BRAND.primary }} />
                                Integration Status Overview
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {[
                                  { label: 'Payment Gateway', key: 'payment_gateway', icon: CreditCard, color: '#8B5CF6' },
                                  { label: 'Email Service', key: 'email_service', icon: Mail, color: BRAND.primary },
                                  { label: 'SMS Service', key: 'sms_service', icon: Smartphone, color: BRAND.accent },
                                  { label: 'Analytics', key: 'analytics_enabled', icon: BarChart3, color: '#F59E0B' },
                                ].map(item => {
                                  const val = getSettingValue(item.key, item.key === 'analytics_enabled' ? 'false' : 'none');
                                  const isConfigured = item.key === 'analytics_enabled' ? val === 'true' : val !== 'none' && val !== '';
                                  return (
                                    <div key={item.key} className="p-4 rounded-xl border-2" style={{ borderColor: isConfigured ? item.color : '#e5e7eb' }} data-testid={`integration-status-${item.key}`}>
                                      <div className="flex items-center gap-3 mb-2">
                                        <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${item.color}15` }}>
                                          <item.icon className="h-5 w-5" style={{ color: item.color }} />
                                        </div>
                                        <div>
                                          <p className="font-medium text-sm">{item.label}</p>
                                          <p className="text-xs text-gray-500 capitalize">
                                            {item.key === 'analytics_enabled' ? (val === 'true' ? 'Enabled' : 'Disabled') : (val === 'none' ? 'Not configured' : val)}
                                          </p>
                                        </div>
                                      </div>
                                      <Badge variant={isConfigured ? 'default' : 'secondary'} className={isConfigured ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}>
                                        {isConfigured ? 'Connected' : 'Not Configured'}
                                      </Badge>
                                    </div>
                                  );
                                })}
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      )}

                      {settingsSubTab === 'compliance' && (
                        <div className="grid lg:grid-cols-2 gap-6">
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base flex items-center gap-2">
                                <Database className="h-5 w-5" style={{ color: BRAND.primary }} />
                                Data Retention
                              </CardTitle>
                              <CardDescription>Configure data lifecycle and retention policies</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5">
                              <div data-testid="setting-data-retention">
                                <Label className="text-sm font-medium">Data Retention Period (days)</Label>
                                <Input
                                  type="number"
                                  className="mt-1"
                                  defaultValue={getSettingValue('data_retention_days', '365')}
                                  onBlur={(e) => {
                                    if (e.target.value !== getSettingValue('data_retention_days', '365')) {
                                      updateSetting('data_retention_days', e.target.value, 'number', 'compliance');
                                    }
                                  }}
                                  data-testid="input-data-retention"
                                />
                                <p className="text-xs text-gray-500 mt-1">User data will be retained for this period</p>
                              </div>
                              <div data-testid="setting-audit-retention">
                                <Label className="text-sm font-medium">Audit Log Retention (days)</Label>
                                <Input
                                  type="number"
                                  className="mt-1"
                                  defaultValue={getSettingValue('audit_log_retention_days', '730')}
                                  onBlur={(e) => {
                                    if (e.target.value !== getSettingValue('audit_log_retention_days', '730')) {
                                      updateSetting('audit_log_retention_days', e.target.value, 'number', 'compliance');
                                    }
                                  }}
                                  data-testid="input-audit-retention"
                                />
                                <p className="text-xs text-gray-500 mt-1">Audit logs kept for compliance requirements</p>
                              </div>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5" style={{ color: BRAND.primary }} />
                                Privacy & Consent
                              </CardTitle>
                              <CardDescription>DPDP Act and privacy compliance settings</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5">
                              <div className="flex items-center justify-between" data-testid="setting-dpdp-consent">
                                <div className="space-y-0.5">
                                  <Label className="text-sm font-medium">DPDP Consent Required</Label>
                                  <p className="text-xs text-gray-500">Require consent before data processing</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {settingsSaving === 'dpdp_consent_required' && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
                                  <Switch
                                    checked={getSettingBool('dpdp_consent_required', true)}
                                    onCheckedChange={(checked) => updateSetting('dpdp_consent_required', String(checked), 'boolean', 'compliance')}
                                    data-testid="switch-dpdp-consent"
                                  />
                                </div>
                              </div>
                              <div className="flex items-center justify-between" data-testid="setting-auto-delete">
                                <div className="space-y-0.5">
                                  <Label className="text-sm font-medium">Auto-Delete Inactive Accounts</Label>
                                  <p className="text-xs text-gray-500">Automatically remove inactive user accounts</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {settingsSaving === 'auto_delete_inactive_accounts' && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
                                  <Switch
                                    checked={getSettingBool('auto_delete_inactive_accounts')}
                                    onCheckedChange={(checked) => updateSetting('auto_delete_inactive_accounts', String(checked), 'boolean', 'compliance')}
                                    data-testid="switch-auto-delete"
                                  />
                                </div>
                              </div>
                              {getSettingBool('auto_delete_inactive_accounts') && (
                                <div data-testid="setting-inactive-days">
                                  <Label className="text-sm font-medium">Inactivity Threshold (days)</Label>
                                  <Input
                                    type="number"
                                    className="mt-1"
                                    defaultValue={getSettingValue('inactive_account_days', '365')}
                                    onBlur={(e) => {
                                      if (e.target.value !== getSettingValue('inactive_account_days', '365')) {
                                        updateSetting('inactive_account_days', e.target.value, 'number', 'compliance');
                                      }
                                    }}
                                    data-testid="input-inactive-days"
                                  />
                                  <p className="text-xs text-gray-500 mt-1">Accounts inactive for this many days will be auto-deleted</p>
                                </div>
                              )}
                            </CardContent>
                          </Card>

                          <Card className="lg:col-span-2">
                            <CardHeader>
                              <CardTitle className="text-base flex items-center gap-2">
                                <FileCheck className="h-5 w-5" style={{ color: BRAND.primary }} />
                                Compliance Checklist
                              </CardTitle>
                              <CardDescription>Current compliance status across standards</CardDescription>
                            </CardHeader>
                            <CardContent>
                              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {[
                                  { label: 'DPDP Act', description: 'Data Protection & Digital Privacy', status: getSettingBool('dpdp_consent_required', true) ? 'compliant' : 'review' },
                                  { label: 'SOC2 Type II', description: 'Security controls & procedures', status: 'in_progress' },
                                  { label: 'ISO 27001', description: 'Information security management', status: 'in_progress' },
                                  { label: 'Data Retention', description: `${getSettingValue('data_retention_days', '365')} days policy set`, status: 'compliant' },
                                  { label: 'Audit Logging', description: `${getSettingValue('audit_log_retention_days', '730')} days retention`, status: 'compliant' },
                                  { label: 'Account Lifecycle', description: getSettingBool('auto_delete_inactive_accounts') ? `Auto-delete after ${getSettingValue('inactive_account_days', '365')} days` : 'Manual management', status: getSettingBool('auto_delete_inactive_accounts') ? 'compliant' : 'review' },
                                ].map((item, idx) => (
                                  <div key={idx} className="p-4 rounded-xl border bg-gray-50" data-testid={`compliance-item-${idx}`}>
                                    <div className="flex items-start justify-between mb-1">
                                      <h4 className="font-medium text-sm">{item.label}</h4>
                                      <Badge
                                        variant="secondary"
                                        className={
                                          item.status === 'compliant' ? 'bg-green-100 text-green-700' :
                                          item.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                                          'bg-red-100 text-red-700'
                                        }
                                      >
                                        {item.status === 'compliant' ? 'Compliant' : item.status === 'in_progress' ? 'In Progress' : 'Needs Review'}
                                      </Badge>
                                    </div>
                                    <p className="text-xs text-gray-500">{item.description}</p>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      )}
                    </>
                  )}
                </div>
  );
}
