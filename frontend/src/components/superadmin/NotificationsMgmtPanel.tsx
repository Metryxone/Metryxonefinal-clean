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

export default function NotificationsMgmtPanel() {
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

                const CATEGORY_COLORS: Record<string, string> = {
                  security: '#DC2626', onboarding: '#F59E0B', billing: '#8B5CF6', commerce: '#8B5CF6',
                  exam: '#344E86', reports: '#059669', ai_tools: '#6366F1', booking: '#EC4899',
                  classes: '#0EA5E9', compliance: '#F97316', feedback: '#14B8A6', system: '#6366F1', general: '#6B7280',
                  assessment: '#344E86', mentorship: '#EC4899',
                };
                const CHANNEL_COLORS: Record<string, string> = { app: '#059669', email: '#6366F1', sms: '#F59E0B', push: '#EC4899', dashboard: '#0EA5E9' };

                const extractVars = (text: string): string[] => {
                  const matches = text.match(/\{\{(\w+)\}\}/g);
                  return matches ? Array.from(new Set(matches.map(m => m.replace(/[{}]/g, '')))) : [];
                };

                const interpolatePreview = (text: string, ctx: Record<string, string>): string => {
                  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => ctx[key] || `{{${key}}}`);
                };

                return (
                <div className="space-y-4">
                  <div className="border-b pb-3">
                    <h2 className="text-xl font-bold text-gray-900">Notification Management</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Broadcasts, templates, quick send, analytics, audit logs, automation scenarios & scheduled jobs</p>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {([
                      { key: 'broadcasts', label: 'Broadcasts', icon: <Send className="h-3.5 w-3.5 mr-1.5" /> },
                      { key: 'templates', label: 'Templates', icon: <Layers className="h-3.5 w-3.5 mr-1.5" /> },
                      { key: 'quicksend', label: 'Quick Send', icon: <Play className="h-3.5 w-3.5 mr-1.5" /> },
                      { key: 'analytics', label: 'Analytics', icon: <BarChart3 className="h-3.5 w-3.5 mr-1.5" /> },
                      { key: 'auditlogs', label: 'Audit Logs', icon: <History className="h-3.5 w-3.5 mr-1.5" /> },
                      { key: 'scenarios', label: 'Scenarios', icon: <GitBranch className="h-3.5 w-3.5 mr-1.5" /> },
                      { key: 'scheduled', label: 'Scheduled Jobs', icon: <Clock className="h-3.5 w-3.5 mr-1.5" /> },
                    ] as Array<{ key: typeof notifSubTab; label: string; icon: React.ReactNode }>).map(tab => (
                      <Button
                        key={tab.key}
                        variant={notifSubTab === tab.key ? 'default' : 'outline'}
                        size="sm"
                        className="text-xs"
                        style={notifSubTab === tab.key ? { backgroundColor: BRAND.primary, color: '#fff' } : {}}
                        onClick={() => setNotifSubTab(tab.key)}
                        data-testid={`notif-tab-${tab.key}`}
                      >
                        {tab.icon}{tab.label}
                      </Button>
                    ))}
                  </div>

                  {/* BROADCASTS SUB-TAB */}
                  {notifSubTab === 'broadcasts' && (
                    <div className="grid lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2">
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                              <Bell className="h-4 w-4" style={{ color: BRAND.primary }} />
                              Create Notification Broadcast
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="flex gap-3">
                              <button onClick={() => setBroadcastType('fyi')} className={`flex-1 p-2.5 rounded-lg border-2 transition-all ${broadcastType === 'fyi' ? 'ring-2' : 'border-gray-200'}`} style={broadcastType === 'fyi' ? { borderColor: BRAND.primary, backgroundColor: `${BRAND.primary}10` } : {}} data-testid="btn-broadcast-fyi">
                                <div className="flex items-center gap-2 mb-0.5"><Info className="h-3.5 w-3.5" style={{ color: BRAND.primary }} /><span className="font-semibold text-xs" style={{ color: BRAND.primary }}>FYI</span></div>
                                <p className="text-xs text-gray-500">Informational updates</p>
                              </button>
                              <button onClick={() => setBroadcastType('fya')} className={`flex-1 p-2.5 rounded-lg border-2 transition-all ${broadcastType === 'fya' ? 'ring-2' : 'border-gray-200'}`} style={broadcastType === 'fya' ? { borderColor: '#DC2626', backgroundColor: '#FEF2F2' } : {}} data-testid="btn-broadcast-fya">
                                <div className="flex items-center gap-2 mb-0.5"><AlertTriangle className="h-3.5 w-3.5 text-red-500" /><span className="font-semibold text-xs text-red-600">FYA</span></div>
                                <p className="text-xs text-gray-500">Requires acknowledgement</p>
                              </button>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-700 block mb-1">Title</label>
                              <Input placeholder="Notification title..." value={broadcastTitle} onChange={(e) => setBroadcastTitle(e.target.value)} data-testid="input-broadcast-title" className="text-sm" />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-700 block mb-1">Message</label>
                              <textarea className="w-full border rounded-lg p-2.5 text-sm min-h-[80px] resize-y focus:outline-none focus:ring-2" style={{ borderColor: '#e5e7eb' }} placeholder="Write your notification message..." value={broadcastMessage} onChange={(e) => setBroadcastMessage(e.target.value)} data-testid="input-broadcast-message" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs font-medium text-gray-700 block mb-1">Category</label>
                                <Select value={broadcastCategory} onValueChange={setBroadcastCategory}>
                                  <SelectTrigger data-testid="select-broadcast-category" className="text-sm"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {['system', 'general', 'assessment', 'subscription', 'security', 'exam', 'onboarding', 'document', 'consent'].map(c => (
                                      <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <label className="text-xs font-medium text-gray-700 block mb-1">Priority</label>
                                <Select value={broadcastPriority} onValueChange={setBroadcastPriority}>
                                  <SelectTrigger data-testid="select-broadcast-priority" className="text-sm"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="low">Low</SelectItem>
                                    <SelectItem value="normal">Normal</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                    <SelectItem value="urgent">Urgent</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-700 block mb-1">Target Audience</label>
                              <div className="flex flex-wrap gap-1.5">
                                {['parent', 'student', 'institute', 'mentor', 'super_admin'].map(role => (
                                  <button key={role} onClick={() => setBroadcastTargetRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role])} className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${broadcastTargetRoles.includes(role) ? 'text-white' : 'text-gray-600 border-gray-300 hover:border-gray-400'}`} style={broadcastTargetRoles.includes(role) ? { backgroundColor: BRAND.primary, borderColor: BRAND.primary } : {}} data-testid={`btn-target-role-${role}`}>
                                    {role === 'super_admin' ? 'Super Admin' : role.charAt(0).toUpperCase() + role.slice(1)}
                                  </button>
                                ))}
                              </div>
                              <p className="text-xs text-gray-400 mt-1">{broadcastTargetRoles.length === 0 ? 'All users will be notified' : `Selected: ${broadcastTargetRoles.join(', ')}`}</p>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-700 block mb-1">Action URL (optional)</label>
                              <Input placeholder="/dashboard or https://..." value={broadcastActionUrl} onChange={(e) => setBroadcastActionUrl(e.target.value)} data-testid="input-broadcast-action-url" className="text-sm" />
                            </div>
                            <div className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50">
                              <button onClick={() => setBroadcastSendEmail(!broadcastSendEmail)} className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${broadcastSendEmail ? 'border-transparent' : 'border-gray-300'}`} style={broadcastSendEmail ? { backgroundColor: BRAND.accent } : {}} data-testid="checkbox-send-email">
                                {broadcastSendEmail && <Check className="h-3 w-3 text-white" />}
                              </button>
                              <div>
                                <span className="text-xs font-medium">Also send via email</span>
                                <p className="text-xs text-gray-500">Deliver to users who consented to emails</p>
                              </div>
                            </div>
                            <div className="flex gap-3 pt-1">
                              <Button className="flex-1 text-white text-sm" style={{ backgroundColor: BRAND.primary }} disabled={!broadcastTitle.trim() || !broadcastMessage.trim()} onClick={async () => {
                                try {
                                  const res = await fetch('/api/admin/notification-broadcasts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ type: broadcastType, category: broadcastCategory, title: broadcastTitle, message: broadcastMessage, priority: broadcastPriority, targetRoles: broadcastTargetRoles, actionUrl: broadcastActionUrl || undefined, sendEmail: broadcastSendEmail }) });
                                  if (!res.ok) throw new Error('Failed to create broadcast');
                                  const broadcast = await res.json();
                                  const sendRes = await fetch(`/api/admin/notification-broadcasts/${broadcast.id}/send`, { method: 'POST', credentials: 'include' });
                                  if (!sendRes.ok) throw new Error('Failed to send');
                                  const sendResult = await sendRes.json();
                                  toast({ title: 'Broadcast Sent', description: `Notification delivered to ${sendResult.sent} recipients` });
                                  setBroadcastTitle(''); setBroadcastMessage(''); setBroadcastActionUrl(''); setBroadcastTargetRoles([]); setBroadcastSendEmail(false); setBroadcastPriority('normal'); setBroadcastCategory('system'); setBroadcastType('fyi');
                                  refetchBroadcasts();
                                } catch (e) { toast({ title: 'Error', description: 'Failed to send broadcast', variant: 'destructive' }); }
                              }} data-testid="btn-send-broadcast">
                                <Send className="h-4 w-4 mr-2" />Send Now
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                      <div className="space-y-4">
                        <Card>
                          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Broadcast Stats</CardTitle></CardHeader>
                          <CardContent className="space-y-2">
                            <div className="flex justify-between items-center"><span className="text-xs text-gray-600">Total</span><span className="font-bold text-sm" style={{ color: BRAND.primary }}>{broadcastHistory.length}</span></div>
                            <div className="flex justify-between items-center"><span className="text-xs text-gray-600">Sent</span><span className="font-bold text-sm text-green-600">{broadcastHistory.filter((b: any) => b.status === 'sent').length}</span></div>
                            <div className="flex justify-between items-center"><span className="text-xs text-gray-600">FYI</span><span className="font-bold text-sm" style={{ color: BRAND.accent }}>{broadcastHistory.filter((b: any) => b.type === 'fyi').length}</span></div>
                            <div className="flex justify-between items-center"><span className="text-xs text-gray-600">FYA</span><span className="font-bold text-sm text-red-600">{broadcastHistory.filter((b: any) => b.type === 'fya').length}</span></div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2 flex flex-row items-center justify-between">
                            <CardTitle className="text-sm font-semibold">Recent Broadcasts</CardTitle>
                            <Button variant="ghost" size="sm" onClick={() => refetchBroadcasts()} data-testid="btn-refresh-broadcasts"><RefreshCw className="h-3.5 w-3.5" /></Button>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2 max-h-[350px] overflow-y-auto">
                              {broadcastHistory.slice(0, 10).map((b: any) => (
                                <div key={b.id} className="p-2.5 rounded-lg bg-gray-50 text-xs" data-testid={`broadcast-${b.id}`}>
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium text-white ${b.type === 'fya' ? 'bg-red-500' : ''}`} style={b.type !== 'fya' ? { backgroundColor: BRAND.primary } : {}}>{b.type.toUpperCase()}</span>
                                    <span className="font-medium truncate text-xs">{b.title}</span>
                                  </div>
                                  <p className="text-xs text-gray-500 line-clamp-1">{b.message}</p>
                                  <div className="flex items-center justify-between mt-1.5">
                                    <span className="text-[10px] text-gray-400">{b.sentAt ? new Date(b.sentAt).toLocaleDateString() : 'Pending'}</span>
                                    <div className="flex items-center gap-1">
                                      <Badge variant={b.status === 'sent' ? 'default' : 'secondary'} className="text-[10px]">{b.status}</Badge>
                                      {b.totalDelivered > 0 && <span className="text-[10px] text-gray-500">{b.totalDelivered} rcpt</span>}
                                    </div>
                                  </div>
                                </div>
                              ))}
                              {broadcastHistory.length === 0 && <p className="text-center py-4 text-gray-400 text-xs">No broadcasts sent yet</p>}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  )}

                  {/* TEMPLATES SUB-TAB */}
                  {notifSubTab === 'templates' && (() => {
                    const templates = notifTemplates;
                    const filtered = templates.filter((t: any) => {
                      const matchSearch = !templateSearch || t.serviceName?.toLowerCase().includes(templateSearch.toLowerCase()) || t.titleTemplate?.toLowerCase().includes(templateSearch.toLowerCase()) || t.triggerEvent?.toLowerCase().includes(templateSearch.toLowerCase());
                      const matchCat = templateCategoryFilter === 'all' || t.category === templateCategoryFilter;
                      return matchSearch && matchCat;
                    });
                    const categories = Array.from(new Set(templates.map((t: any) => t.category)));

                    return (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                            <Input placeholder="Search templates..." value={templateSearch} onChange={e => setTemplateSearch(e.target.value)} className="pl-8 text-sm h-9" data-testid="input-template-search" />
                          </div>
                          <Select value={templateCategoryFilter} onValueChange={setTemplateCategoryFilter}>
                            <SelectTrigger className="w-[160px] text-sm h-9" data-testid="select-template-category"><SelectValue placeholder="All Categories" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Categories</SelectItem>
                              {categories.map((c: string) => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1).replace('_', ' ')}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Badge variant="secondary" className="text-xs">{filtered.length} templates</Badge>
                          <Button size="sm" className="text-white text-xs h-9" style={{ backgroundColor: BRAND.primary }} onClick={() => { setTemplateFormData({ title: '', category: 'general', bodyTemplate: '', type: 'fyi', priority: 'normal', roles: 'all', variables: '', actionLabel: '' }); setTemplateDialog({ open: true, mode: 'create', template: null }); }}>
                            <Plus className="h-3.5 w-3.5 mr-1" /> Add Template
                          </Button>
                        </div>
                        {notifTemplatesLoading ? (
                          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" style={{ color: BRAND.primary }} /></div>
                        ) : (
                          <Card>
                            <CardContent className="p-0">
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b bg-gray-50">
                                      <th className="text-left p-2.5 font-semibold text-gray-600">ID</th>
                                      <th className="text-left p-2.5 font-semibold text-gray-600">Name</th>
                                      <th className="text-left p-2.5 font-semibold text-gray-600">Category</th>
                                      <th className="text-left p-2.5 font-semibold text-gray-600">Type</th>
                                      <th className="text-left p-2.5 font-semibold text-gray-600">Priority</th>
                                      <th className="text-left p-2.5 font-semibold text-gray-600">Channels</th>
                                      <th className="text-left p-2.5 font-semibold text-gray-600">Audience</th>
                                      <th className="text-left p-2.5 font-semibold text-gray-600">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {filtered.map((t: any) => (
                                      <React.Fragment key={t.id}>
                                        <tr className="border-b hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => setTemplateExpandedId(templateExpandedId === t.id ? null : t.id)} data-testid={`template-row-${t.id}`}>
                                          <td className="p-2.5 font-mono text-gray-500">#{t.id}</td>
                                          <td className="p-2.5 font-medium text-gray-800 max-w-[200px] truncate">{t.serviceName || t.notificationType}</td>
                                          <td className="p-2.5">
                                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium text-white" style={{ backgroundColor: CATEGORY_COLORS[t.category] || '#6B7280' }}>{t.category}</span>
                                          </td>
                                          <td className="p-2.5">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium text-white ${t.type === 'fya' ? 'bg-red-500' : ''}`} style={t.type !== 'fya' ? { backgroundColor: BRAND.primary } : {}}>{(t.type || 'fyi').toUpperCase()}</span>
                                          </td>
                                          <td className="p-2.5">
                                            <span className={`text-[10px] font-medium ${t.priority === 'critical' ? 'text-red-600' : t.priority === 'high' ? 'text-orange-600' : t.priority === 'medium' ? 'text-yellow-600' : 'text-gray-500'}`}>{(t.priority || 'medium').toUpperCase()}</span>
                                          </td>
                                          <td className="p-2.5">
                                            <div className="flex gap-1 flex-wrap">
                                              {(t.channels || []).map((ch: string) => (
                                                <span key={ch} className="text-[10px] px-1.5 py-0.5 rounded text-white font-medium" style={{ backgroundColor: CHANNEL_COLORS[ch] || '#6B7280' }}>{ch}</span>
                                              ))}
                                            </div>
                                          </td>
                                          <td className="p-2.5 text-gray-600 text-[10px] max-w-[120px] truncate">{(t.targetAudience || []).join(', ')}</td>
                                          <td className="p-2.5">
                                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); setTemplateFormData({ title: t.serviceName || '', category: t.category || 'general', bodyTemplate: (t.messageTemplate || '').replace(/\{\{(\w+)\}\}/g, '[$1]'), type: t.type || 'fyi', priority: t.priority || 'normal', roles: (t.targetAudience || ['all']).join(', '), variables: (t.variables || []).join(', '), actionLabel: t.actionLabel || '' }); setTemplateDialog({ open: true, mode: 'edit', template: t }); }}>
                                              <Edit className="h-3.5 w-3.5 text-gray-500" />
                                            </Button>
                                          </td>
                                        </tr>
                                        {templateExpandedId === t.id && (
                                          <tr className="bg-gray-50">
                                            <td colSpan={8} className="p-4">
                                              <div className="space-y-2">
                                                <div><span className="text-xs font-semibold text-gray-600">Title: </span><span className="text-xs text-gray-800">{(t.titleTemplate || '').replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => `{{${k}}}`)}</span></div>
                                                <div><span className="text-xs font-semibold text-gray-600">Message: </span><span className="text-xs text-gray-700">{(t.messageTemplate || '').split(/(\{\{\w+\}\})/).map((part: string, i: number) => part.match(/\{\{\w+\}\}/) ? <span key={i} className="font-mono px-1 py-0.5 rounded text-[10px]" style={{ backgroundColor: `${BRAND.accent}25`, color: BRAND.primary }}>{part}</span> : <span key={i}>{part}</span>)}</span></div>
                                                {t.triggerEvent && <div><span className="text-xs font-semibold text-gray-600">Trigger: </span><span className="text-xs text-gray-600">{t.triggerEvent}</span></div>}
                                                {t.actionLabel && <div><span className="text-xs font-semibold text-gray-600">Action: </span><Badge variant="outline" className="text-[10px]">{t.actionLabel}</Badge></div>}
                                              </div>
                                            </td>
                                          </tr>
                                        )}
                                      </React.Fragment>
                                    ))}
                                    {filtered.length === 0 && (
                                      <tr><td colSpan={8} className="text-center py-8 text-gray-400 text-sm">No templates found</td></tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    );
                  })()}

                  {/* TEMPLATE CREATE/EDIT DIALOG */}
                  <Dialog open={templateDialog.open} onOpenChange={(open) => setTemplateDialog(prev => ({ ...prev, open }))}>
                    <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <FileText className="h-5 w-5" style={{ color: BRAND.primary }} />
                          {templateDialog.mode === 'create' ? 'Create Template' : 'Edit Template'}
                        </DialogTitle>
                        <DialogDescription>{templateDialog.mode === 'create' ? 'Add a new notification template' : 'Modify the notification template'}</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Title</Label>
                          <Input value={templateFormData.title} onChange={e => setTemplateFormData(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Welcome Notification" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Category</Label>
                            <Select value={templateFormData.category} onValueChange={v => setTemplateFormData(p => ({ ...p, category: v }))}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {['general', 'academic', 'assessment', 'subscription', 'mentoring', 'attendance', 'report', 'onboarding', 'engagement', 'system', 'scheduling', 'behavioral', 'class'].map(c => (
                                  <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Type</Label>
                            <Select value={templateFormData.type} onValueChange={v => setTemplateFormData(p => ({ ...p, type: v }))}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="fyi">FYI (Info Only)</SelectItem>
                                <SelectItem value="fya">FYA (Action Required)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <Label>Body Template</Label>
                          <Textarea value={templateFormData.bodyTemplate} onChange={e => setTemplateFormData(p => ({ ...p, bodyTemplate: e.target.value }))} placeholder="Use [variable] for placeholders, e.g. Hello [name], your [plan] is active." rows={4} />
                        </div>
                        {templateFormData.bodyTemplate && (
                          <div className="p-3 rounded-lg bg-gray-50 border">
                            <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">Preview</p>
                            <p className="text-xs text-gray-700">
                              {templateFormData.bodyTemplate.split(/(\[\w+\])/).map((part: string, i: number) =>
                                part.match(/\[\w+\]/) ? <span key={i} className="font-mono px-1 py-0.5 rounded text-[10px]" style={{ backgroundColor: `${BRAND.accent}25`, color: BRAND.primary }}>{part}</span> : <span key={i}>{part}</span>
                              )}
                            </p>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Priority</Label>
                            <Select value={templateFormData.priority} onValueChange={v => setTemplateFormData(p => ({ ...p, priority: v }))}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="normal">Normal</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="urgent">Urgent</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Action Label (optional)</Label>
                            <Input value={templateFormData.actionLabel} onChange={e => setTemplateFormData(p => ({ ...p, actionLabel: e.target.value }))} placeholder="e.g. View Details" />
                          </div>
                        </div>
                        <div>
                          <Label>Roles (comma-separated)</Label>
                          <Input value={templateFormData.roles} onChange={e => setTemplateFormData(p => ({ ...p, roles: e.target.value }))} placeholder="all, student, parent, mentor" />
                        </div>
                        <div>
                          <Label>Variables (comma-separated)</Label>
                          <Input value={templateFormData.variables} onChange={e => setTemplateFormData(p => ({ ...p, variables: e.target.value }))} placeholder="name, plan, date" />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setTemplateDialog(p => ({ ...p, open: false }))}>Cancel</Button>
                        <Button className="text-white" style={{ backgroundColor: BRAND.primary }} disabled={!templateFormData.title.trim() || !templateFormData.bodyTemplate.trim() || templateSaving} onClick={async () => {
                          setTemplateSaving(true);
                          try {
                            const payload = {
                              title: templateFormData.title.trim(),
                              category: templateFormData.category,
                              bodyTemplate: templateFormData.bodyTemplate.trim(),
                              type: templateFormData.type,
                              priority: templateFormData.priority,
                              roles: templateFormData.roles.split(',').map(r => r.trim()).filter(Boolean),
                              variables: templateFormData.variables.split(',').map(v => v.trim()).filter(Boolean),
                              actionLabel: templateFormData.actionLabel.trim() || undefined,
                            };
                            const isEdit = templateDialog.mode === 'edit' && templateDialog.template;
                            const url = isEdit ? `/api/admin/notification-templates/${templateDialog.template.id}` : '/api/admin/notification-templates';
                            const res = await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) });
                            if (!res.ok) throw new Error('Failed to save template');
                            queryClient.invalidateQueries({ queryKey: ['/api/notification-templates'] });
                            toast({ title: isEdit ? 'Template Updated' : 'Template Created', description: `"${payload.title}" has been ${isEdit ? 'updated' : 'created'} successfully` });
                            setTemplateDialog({ open: false, mode: 'create', template: null });
                          } catch (e: any) { toast({ title: 'Error', description: e.message || 'Failed to save template', variant: 'destructive' }); }
                          finally { setTemplateSaving(false); }
                        }}>
                          {templateSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                          {templateDialog.mode === 'create' ? 'Create' : 'Save Changes'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* QUICK SEND SUB-TAB */}
                  {notifSubTab === 'quicksend' && (() => {
                    const qsTemplates = notifTemplates;
                    const selectedTemplate = qsTemplates.find((t: any) => String(t.id) === quickSendTemplateId);
                    const allVars = selectedTemplate ? extractVars((selectedTemplate.titleTemplate || '') + ' ' + (selectedTemplate.messageTemplate || '')) : [];

                    return (
                      <div className="grid lg:grid-cols-2 gap-6">
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Play className="h-4 w-4" style={{ color: BRAND.primary }} />
                              Quick Send Notification
                            </CardTitle>
                            <CardDescription className="text-xs">Send a template-based notification to a specific user</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div>
                              <label className="text-xs font-medium text-gray-700 block mb-1">Template</label>
                              <Select value={quickSendTemplateId} onValueChange={(v) => { setQuickSendTemplateId(v); setQuickSendContext({}); }}>
                                <SelectTrigger data-testid="select-quicksend-template" className="text-sm"><SelectValue placeholder="Select a template..." /></SelectTrigger>
                                <SelectContent>
                                  {qsTemplates.map((t: any) => (
                                    <SelectItem key={t.id} value={String(t.id)}>#{t.id} — {t.serviceName || t.notificationType}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {selectedTemplate && (
                              <>
                                <div className="p-3 rounded-lg bg-gray-50 border">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium text-white" style={{ backgroundColor: CATEGORY_COLORS[selectedTemplate.category] || '#6B7280' }}>{selectedTemplate.category}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium text-white ${selectedTemplate.type === 'fya' ? 'bg-red-500' : ''}`} style={selectedTemplate.type !== 'fya' ? { backgroundColor: BRAND.primary } : {}}>{(selectedTemplate.type || 'fyi').toUpperCase()}</span>
                                  </div>
                                  <p className="text-xs font-medium text-gray-800 mt-1">{selectedTemplate.titleTemplate}</p>
                                  <p className="text-xs text-gray-600 mt-0.5">{selectedTemplate.messageTemplate}</p>
                                </div>
                                {allVars.length > 0 && (
                                  <div className="space-y-2">
                                    <label className="text-xs font-semibold text-gray-700">Context Variables</label>
                                    {allVars.map(v => (
                                      <div key={v} className="flex items-center gap-2">
                                        <span className="text-xs font-mono px-1.5 py-0.5 rounded min-w-[80px]" style={{ backgroundColor: `${BRAND.accent}20`, color: BRAND.primary }}>{`{{${v}}}`}</span>
                                        <Input placeholder={`Value for ${v}...`} value={quickSendContext[v] || ''} onChange={e => setQuickSendContext(prev => ({ ...prev, [v]: e.target.value }))} className="text-sm h-8 flex-1" data-testid={`input-qs-var-${v}`} />
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}
                            <div>
                              <label className="text-xs font-medium text-gray-700 block mb-1">Recipient (User ID or Email)</label>
                              <Input placeholder="Enter user ID or email..." value={quickSendRecipientId} onChange={e => setQuickSendRecipientId(e.target.value)} className="text-sm" data-testid="input-quicksend-recipient" />
                            </div>
                            <Button className="w-full text-white text-sm" style={{ backgroundColor: BRAND.primary }} disabled={!quickSendTemplateId || !quickSendRecipientId.trim() || quickSendSending} onClick={async () => {
                              setQuickSendSending(true);
                              try {
                                const res = await fetch('/api/admin/send-template-notification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ templateId: Number(quickSendTemplateId), recipientId: quickSendRecipientId.trim(), context: quickSendContext }) });
                                if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || 'Failed to send'); }
                                toast({ title: 'Notification Sent', description: 'Template notification delivered successfully' });
                                setQuickSendRecipientId(''); setQuickSendContext({});
                              } catch (e: any) { toast({ title: 'Error', description: e.message || 'Failed to send notification', variant: 'destructive' }); }
                              finally { setQuickSendSending(false); }
                            }} data-testid="btn-quicksend-send">
                              {quickSendSending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                              Send Notification
                            </Button>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Eye className="h-4 w-4" style={{ color: BRAND.primary }} />
                              Preview
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            {selectedTemplate ? (
                              <div className="space-y-3">
                                <div className="p-4 rounded-lg border-2" style={{ borderColor: `${BRAND.primary}30` }}>
                                  <div className="flex items-center gap-2 mb-2">
                                    <Bell className="h-4 w-4" style={{ color: BRAND.primary }} />
                                    <span className="text-sm font-semibold text-gray-900">{interpolatePreview(selectedTemplate.titleTemplate, quickSendContext)}</span>
                                  </div>
                                  <p className="text-sm text-gray-700">{interpolatePreview(selectedTemplate.messageTemplate, quickSendContext)}</p>
                                  {selectedTemplate.actionLabel && (
                                    <div className="mt-3">
                                      <Button size="sm" variant="outline" className="text-xs" style={{ borderColor: BRAND.primary, color: BRAND.primary }}>{selectedTemplate.actionLabel} <ArrowRight className="h-3 w-3 ml-1" /></Button>
                                    </div>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500 space-y-1">
                                  <div className="flex items-center gap-2"><MailCheck className="h-3 w-3" /><span>Channels: {(selectedTemplate.channels || []).join(', ')}</span></div>
                                  <div className="flex items-center gap-2"><Target className="h-3 w-3" /><span>Audience: {(selectedTemplate.targetAudience || []).join(', ')}</span></div>
                                  <div className="flex items-center gap-2"><Users className="h-3 w-3" /><span>Recipient: {quickSendRecipientId || '—'}</span></div>
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-12 text-gray-400">
                                <Layers className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                <p className="text-sm">Select a template to preview</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })()}

                  {/* ANALYTICS SUB-TAB */}
                  {notifSubTab === 'analytics' && (() => {
                    const analytics = notifAnalytics;

                    return (
                      <div className="space-y-4">
                        {notifAnalyticsLoading ? (
                          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" style={{ color: BRAND.primary }} /></div>
                        ) : analytics ? (
                          <>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                              {[
                                { label: 'Total Sent', value: analytics.totalSent ?? 0, icon: <Send className="h-4 w-4" />, color: BRAND.primary },
                                { label: 'Read Rate', value: `${analytics.readRate ?? 0}%`, icon: <Eye className="h-4 w-4" />, color: '#059669' },
                                { label: 'Acknowledged', value: analytics.acknowledged ?? 0, icon: <Check className="h-4 w-4" />, color: BRAND.accent },
                                { label: 'Recipients', value: analytics.uniqueRecipients ?? 0, icon: <Users className="h-4 w-4" />, color: '#8B5CF6' },
                                { label: 'Last 24h', value: analytics.last24h ?? 0, icon: <Clock className="h-4 w-4" />, color: '#F59E0B' },
                                { label: 'Last 7 days', value: analytics.last7days ?? 0, icon: <Calendar className="h-4 w-4" />, color: '#EC4899' },
                              ].map((card, i) => (
                                <Card key={i}>
                                  <CardContent className="p-3 text-center">
                                    <div className="flex justify-center mb-1" style={{ color: card.color }}>{card.icon}</div>
                                    <p className="text-lg font-bold" style={{ color: card.color }}>{card.value}</p>
                                    <p className="text-[10px] text-gray-500 font-medium">{card.label}</p>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>

                            {analytics.categoryBreakdown && analytics.categoryBreakdown.length > 0 && (
                              <Card>
                                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Category Breakdown</CardTitle></CardHeader>
                                <CardContent className="p-0">
                                  <table className="w-full text-xs">
                                    <thead><tr className="border-b bg-gray-50">
                                      <th className="text-left p-2.5 font-semibold text-gray-600">Category</th>
                                      <th className="text-right p-2.5 font-semibold text-gray-600">Count</th>
                                      <th className="text-right p-2.5 font-semibold text-gray-600">Read</th>
                                      <th className="text-right p-2.5 font-semibold text-gray-600">Read Rate</th>
                                    </tr></thead>
                                    <tbody>
                                      {analytics.categoryBreakdown.map((row: any, i: number) => (
                                        <tr key={i} className="border-b">
                                          <td className="p-2.5"><span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium text-white" style={{ backgroundColor: CATEGORY_COLORS[row.category] || '#6B7280' }}>{row.category}</span></td>
                                          <td className="p-2.5 text-right font-medium">{row.count}</td>
                                          <td className="p-2.5 text-right">{row.readCount ?? 0}</td>
                                          <td className="p-2.5 text-right font-medium" style={{ color: BRAND.primary }}>{row.readRate ?? 0}%</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </CardContent>
                              </Card>
                            )}

                            {analytics.dailyTrend && analytics.dailyTrend.length > 0 && (
                              <Card>
                                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Daily Trend (Last 14 Days)</CardTitle></CardHeader>
                                <CardContent>
                                  <div className="flex items-end gap-1 h-32">
                                    {analytics.dailyTrend.slice(-14).map((day: any, i: number) => {
                                      const maxVal = Math.max(...analytics.dailyTrend.slice(-14).map((d: any) => d.count || 0), 1);
                                      const height = ((day.count || 0) / maxVal) * 100;
                                      return (
                                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                          <span className="text-[9px] text-gray-500">{day.count || 0}</span>
                                          <div className="w-full rounded-t" style={{ height: `${Math.max(height, 4)}%`, backgroundColor: BRAND.primary, minHeight: '4px' }} title={`${day.date}: ${day.count || 0}`} />
                                          <span className="text-[8px] text-gray-400 rotate-[-45deg] origin-center whitespace-nowrap">{day.date ? new Date(day.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : ''}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </CardContent>
                              </Card>
                            )}
                          </>
                        ) : (
                          <Card><CardContent className="py-12 text-center text-gray-400 text-sm">No analytics data available</CardContent></Card>
                        )}
                      </div>
                    );
                  })()}

                  {/* AUDIT LOGS SUB-TAB */}
                  {notifSubTab === 'auditlogs' && (() => {
                    const logs = notifLogs;

                    return (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 flex-wrap">
                          <Select value={notifLogCategoryFilter} onValueChange={setNotifLogCategoryFilter}>
                            <SelectTrigger className="w-[140px] text-sm h-9" data-testid="select-log-category"><SelectValue placeholder="Category" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Categories</SelectItem>
                              {['security', 'onboarding', 'billing', 'commerce', 'exam', 'reports', 'ai_tools', 'booking', 'classes', 'compliance', 'feedback', 'system', 'general'].map(c => (
                                <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1).replace('_', ' ')}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select value={notifLogTypeFilter} onValueChange={setNotifLogTypeFilter}>
                            <SelectTrigger className="w-[100px] text-sm h-9" data-testid="select-log-type"><SelectValue placeholder="Type" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Types</SelectItem>
                              <SelectItem value="fyi">FYI</SelectItem>
                              <SelectItem value="fya">FYA</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select value={notifLogPriorityFilter} onValueChange={setNotifLogPriorityFilter}>
                            <SelectTrigger className="w-[120px] text-sm h-9" data-testid="select-log-priority"><SelectValue placeholder="Priority" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Priorities</SelectItem>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="critical">Critical</SelectItem>
                            </SelectContent>
                          </Select>
                          <Badge variant="secondary" className="text-xs">{logs.length} logs</Badge>
                        </div>
                        {notifLogsLoading ? (
                          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" style={{ color: BRAND.primary }} /></div>
                        ) : (
                          <Card>
                            <CardContent className="p-0">
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b bg-gray-50">
                                      <th className="text-left p-2.5 font-semibold text-gray-600">Date</th>
                                      <th className="text-left p-2.5 font-semibold text-gray-600">Recipient</th>
                                      <th className="text-left p-2.5 font-semibold text-gray-600">Title</th>
                                      <th className="text-left p-2.5 font-semibold text-gray-600">Category</th>
                                      <th className="text-left p-2.5 font-semibold text-gray-600">Type</th>
                                      <th className="text-left p-2.5 font-semibold text-gray-600">Priority</th>
                                      <th className="text-left p-2.5 font-semibold text-gray-600">Read</th>
                                      <th className="text-left p-2.5 font-semibold text-gray-600">Ack</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {logs.map((log: any) => (
                                      <React.Fragment key={log.id}>
                                        <tr className="border-b hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => setNotifLogExpandedId(notifLogExpandedId === log.id ? null : log.id)} data-testid={`log-row-${log.id}`}>
                                          <td className="p-2.5 text-gray-500 whitespace-nowrap">{log.createdAt ? new Date(log.createdAt).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                                          <td className="p-2.5 font-medium text-gray-700 max-w-[120px] truncate" title={log.recipientId}>{log.recipientName || log.recipientUsername || log.recipientId || '—'}</td>
                                          <td className="p-2.5 text-gray-800 max-w-[180px] truncate">{log.title || '—'}</td>
                                          <td className="p-2.5"><span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium text-white" style={{ backgroundColor: CATEGORY_COLORS[log.category] || '#6B7280' }}>{log.category || '—'}</span></td>
                                          <td className="p-2.5"><span className={`text-[10px] px-1.5 py-0.5 rounded font-medium text-white ${log.type === 'fya' ? 'bg-red-500' : ''}`} style={log.type !== 'fya' ? { backgroundColor: BRAND.primary } : {}}>{(log.type || 'fyi').toUpperCase()}</span></td>
                                          <td className="p-2.5"><span className={`text-[10px] font-medium ${log.priority === 'critical' ? 'text-red-600' : log.priority === 'high' ? 'text-orange-600' : log.priority === 'medium' ? 'text-yellow-600' : 'text-gray-500'}`}>{(log.priority || '—').toUpperCase()}</span></td>
                                          <td className="p-2.5">{log.isRead ? <Check className="h-3.5 w-3.5 text-green-600" /> : <X className="h-3.5 w-3.5 text-gray-300" />}</td>
                                          <td className="p-2.5">{log.isAcknowledged ? <Check className="h-3.5 w-3.5 text-green-600" /> : <X className="h-3.5 w-3.5 text-gray-300" />}</td>
                                        </tr>
                                        {notifLogExpandedId === log.id && (
                                          <tr className="bg-gray-50">
                                            <td colSpan={8} className="p-4">
                                              <p className="text-xs text-gray-700">{log.message || 'No message content'}</p>
                                              {log.actionUrl && <div className="mt-2"><a href={log.actionUrl} className="text-xs font-medium underline" style={{ color: BRAND.primary }}>Action: {log.actionUrl}</a></div>}
                                              {log.readAt && <p className="text-[10px] text-gray-400 mt-1">Read: {new Date(log.readAt).toLocaleString()}</p>}
                                              {log.acknowledgedAt && <p className="text-[10px] text-gray-400">Acknowledged: {new Date(log.acknowledgedAt).toLocaleString()}</p>}
                                            </td>
                                          </tr>
                                        )}
                                      </React.Fragment>
                                    ))}
                                    {logs.length === 0 && (
                                      <tr><td colSpan={8} className="text-center py-8 text-gray-400 text-sm">No notification logs found</td></tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    );
                  })()}
                  {/* SCENARIOS SUB-TAB */}
                  {notifSubTab === 'scenarios' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-base font-semibold text-gray-900">Automation Scenarios</h3>
                          <p className="text-sm text-gray-500">Rules that fire notifications automatically when platform events occur</p>
                        </div>
                        <span className="text-xs text-gray-400">{notifScenarios.length} scenario{notifScenarios.length !== 1 ? 's' : ''} configured</span>
                      </div>

                      <Card>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-gray-50">
                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide">Name</th>
                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide">Trigger Event</th>
                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide">Template</th>
                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide">Delay</th>
                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide">Channels</th>
                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide">Executions</th>
                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</th>
                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {notifScenarios.length === 0 ? (
                                <tr><td colSpan={8} className="text-center py-10 text-gray-400 text-sm">No scenarios configured</td></tr>
                              ) : notifScenarios.map((sc: any) => {
                                const channels: string[] = typeof sc.channels === 'object' && Array.isArray(sc.channels)
                                  ? sc.channels : typeof sc.channels === 'string' ? JSON.parse(sc.channels) : [];
                                const delay = Number(sc.delay_minutes ?? 0);
                                const delayLabel = delay <= 0 ? 'Immediate' : delay < 60 ? `${delay}m` : `${Math.round(delay / 60)}h`;
                                return (
                                  <tr key={sc.id} className="border-b hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                      <p className="font-medium text-gray-900">{sc.name}</p>
                                      {sc.description && <p className="text-xs text-gray-500 mt-0.5 max-w-[200px] truncate">{sc.description}</p>}
                                    </td>
                                    <td className="px-4 py-3">
                                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{sc.event_trigger}</code>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-700">{sc.template_title || <span className="text-gray-400">None</span>}</td>
                                    <td className="px-4 py-3 text-xs text-gray-700">{delayLabel}</td>
                                    <td className="px-4 py-3">
                                      <div className="flex gap-1 flex-wrap">
                                        {channels.map((ch: string) => (
                                          <span key={ch} className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">{ch}</span>
                                        ))}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-700">{Number(sc.execution_count ?? 0).toLocaleString()}</td>
                                    <td className="px-4 py-3">
                                      <button
                                        onClick={() => toggleScenarioMutation.mutate({ id: sc.id, isActive: !sc.is_active })}
                                        className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${sc.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                                      >
                                        {sc.is_active ? 'Active' : 'Inactive'}
                                      </button>
                                    </td>
                                    <td className="px-4 py-3">
                                      <button
                                        onClick={() => { if (window.confirm(`Delete scenario "${sc.name}"?`)) deleteScenarioMutation.mutate(sc.id); }}
                                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                                      >
                                        Delete
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    </div>
                  )}

                  {/* SCHEDULED JOBS SUB-TAB */}
                  {notifSubTab === 'scheduled' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-gray-900">Scheduled Notification Jobs</h3>
                          <p className="text-sm text-gray-500">Delayed notifications queued by automation scenarios</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select value={scheduledJobStatusFilter} onValueChange={setScheduledJobStatusFilter}>
                            <SelectTrigger className="w-[130px] text-sm h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Statuses</SelectItem>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="processing">Processing</SelectItem>
                              <SelectItem value="sent">Sent</SelectItem>
                              <SelectItem value="failed">Failed</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button variant="outline" size="sm" onClick={() => refetchScheduledJobs()} className="text-xs h-8">Refresh</Button>
                        </div>
                      </div>

                      <Card>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-gray-50">
                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide">Scenario</th>
                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide">Template</th>
                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide">Recipient</th>
                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide">Scheduled At</th>
                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</th>
                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide">Sent At</th>
                                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {scheduledJobs.length === 0 ? (
                                <tr><td colSpan={7} className="text-center py-10 text-gray-400 text-sm">No scheduled jobs found</td></tr>
                              ) : scheduledJobs.map((job: any) => {
                                const statusColors: Record<string, string> = {
                                  pending: 'bg-yellow-100 text-yellow-700',
                                  processing: 'bg-blue-100 text-blue-700',
                                  sent: 'bg-green-100 text-green-700',
                                  failed: 'bg-red-100 text-red-700',
                                  cancelled: 'bg-gray-100 text-gray-500',
                                };
                                return (
                                  <tr key={job.id} className="border-b hover:bg-gray-50">
                                    <td className="px-4 py-3 text-xs text-gray-700">{job.scenario_name || <span className="text-gray-400">—</span>}</td>
                                    <td className="px-4 py-3 text-xs text-gray-700">{job.template_title || `#${job.template_id}`}</td>
                                    <td className="px-4 py-3 text-xs text-gray-700">
                                      {job.recipient_name || job.recipient_email || job.recipient_id}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-600">
                                      {job.scheduled_at ? new Date(job.scheduled_at).toLocaleString() : '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[job.status] || 'bg-gray-100 text-gray-600'}`}>
                                        {job.status}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-600">
                                      {job.sent_at ? new Date(job.sent_at).toLocaleString() : '—'}
                                    </td>
                                    <td className="px-4 py-3">
                                      {job.status === 'pending' && (
                                        <button
                                          onClick={() => cancelScheduledJobMutation.mutate(job.id)}
                                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                                        >
                                          Cancel
                                        </button>
                                      )}
                                      {job.status === 'failed' && job.error_message && (
                                        <span title={job.error_message} className="text-xs text-red-400 cursor-help truncate max-w-[120px] block">
                                          {job.error_message.substring(0, 40)}{job.error_message.length > 40 ? '…' : ''}
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    </div>
                  )}

                </div>
                );
}
