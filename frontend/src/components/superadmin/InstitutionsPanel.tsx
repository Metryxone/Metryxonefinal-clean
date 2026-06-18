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

export default function InstitutionsPanel() {
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

                const typeLabels: Record<string, string> = {
                  all: 'All', school: 'School', college: 'College', ngo: 'NGO', lei: 'LEI'
                };
                const typeAbbr: Record<string, string> = {
                  school: 'SCH', college: 'CLG', ngo: 'NGO', lei: 'LEI'
                };
                const filteredInstitutions = institutionsList.filter(i => {
                  const matchType = institutionTypeFilter === 'all' || i.institutionType === institutionTypeFilter;
                  const matchSearch = !institutionSearch ||
                    i.name?.toLowerCase().includes(institutionSearch.toLowerCase()) ||
                    i.city?.toLowerCase().includes(institutionSearch.toLowerCase()) ||
                    i.contactPerson?.toLowerCase().includes(institutionSearch.toLowerCase()) ||
                    i.institutionCode?.toLowerCase().includes(institutionSearch.toLowerCase());
                  return matchType && matchSearch;
                });
                return (
                  <div className="flex h-[calc(100vh-120px)] bg-[#F5F7FA]">
                    {/* Registry Panel */}
                    <div className="w-[300px] flex-shrink-0 border-r border-[#E2E8F0] bg-white flex flex-col">
                      <div className="px-4 py-4 border-b border-[#E2E8F0]">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide">Institution Registry</span>
                          <span className="text-xs text-[#9AA4B2] tabular-nums">{filteredInstitutions.length} / {institutionsList.length}</span>
                        </div>
                        <input
                          className="w-full text-sm rounded-lg border border-[#E2E8F0] px-3 py-2 focus:outline-none focus:border-[#344E86] focus:ring-2 focus:ring-[#344E86]/10 bg-[#F5F7FA] placeholder-[#9AA4B2] transition-all"
                          placeholder="Search name, city, code..."
                          value={institutionSearch}
                          onChange={e => setInstitutionSearch(e.target.value)}
                        />
                      </div>
                      <div className="px-4 py-2.5 border-b border-[#E2E8F0] flex gap-1.5 flex-wrap">
                        {['all', 'school', 'college', 'ngo', 'lei'].map(type => (
                          <button key={type} onClick={() => { setInstitutionTypeFilter(type); setSelectedInstitution(null); }}
                            className={`text-xs font-medium px-3 py-1 rounded-full transition-all ${institutionTypeFilter === type ? 'bg-[#344E86] text-white shadow-sm' : 'bg-[#F5F7FA] text-[#5F6C80] hover:bg-[#E2E8F0]'}`}>
                            {typeLabels[type]}
                          </button>
                        ))}
                      </div>
                      <div className="flex-1 overflow-y-auto">
                        {loadingInstitutions ? (
                          <div className="py-16 text-center text-sm text-[#9AA4B2]">Loading...</div>
                        ) : filteredInstitutions.length === 0 ? (
                          <div className="py-16 text-center text-sm text-[#9AA4B2]">No institutions found</div>
                        ) : filteredInstitutions.map(inst => (
                          <button key={inst.id} onClick={() => { setSelectedInstitution(inst); setInstitutionDetailTab('profile'); }}
                            className={`w-full text-left px-4 py-3 border-b border-[#F5F7FA] transition-all ${selectedInstitution?.id === inst.id ? 'bg-[#344E86]/[0.05] border-l-[3px] !border-l-[#344E86] pl-[13px]' : 'hover:bg-[#F5F7FA] border-l-[3px] border-l-transparent'}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-[10px] font-bold text-[#344E86] bg-[#344E86]/10 px-2 py-0.5 rounded-full flex-shrink-0">{typeAbbr[inst.institutionType] || 'INST'}</span>
                                  <p className="text-sm font-semibold text-[#2E3440] truncate">{inst.name}</p>
                                </div>
                                <p className="text-xs text-[#9AA4B2] mt-0.5">{inst.city || '—'}{inst.state ? `, ${inst.state}` : ''}</p>
                                {inst.institutionCode && (
                                  <p className="text-xs font-mono text-[#5F6C80] mt-0.5">{inst.institutionCode}</p>
                                )}
                              </div>
                              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 capitalize ${
                                inst.status === 'active' ? 'text-emerald-700 bg-emerald-50' :
                                inst.status === 'rejected' ? 'text-red-600 bg-red-50' :
                                'text-amber-700 bg-amber-50'
                              }`}>{inst.status}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Detail Area */}
                    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                      {!selectedInstitution ? (
                        <div className="flex-1 flex items-center justify-center h-full">
                          <div className="text-center">
                            <div className="w-16 h-16 rounded-2xl bg-[#344E86]/10 flex items-center justify-center mx-auto mb-4">
                              <span className="text-2xl font-black text-[#344E86]">I</span>
                            </div>
                            <p className="text-sm font-semibold text-[#5F6C80]">Select an institution to view its record</p>
                            <div className="grid grid-cols-4 gap-3 mt-6">
                              {[['school','Schools'],['college','Colleges'],['ngo','NGOs'],['lei','LEIs']].map(([type, label]) => (
                                <div key={type} className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm px-5 py-4 text-center">
                                  <p className="text-2xl font-bold text-[#344E86]">{institutionsList.filter(i => i.institutionType === type).length}</p>
                                  <p className="text-xs font-medium text-[#9AA4B2] uppercase tracking-wide mt-1">{label}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="bg-white border-b border-[#E2E8F0] px-6 py-4 flex-shrink-0">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                  <span className="text-xs font-bold text-[#344E86] bg-[#344E86]/10 px-2.5 py-1 rounded-lg">{typeAbbr[selectedInstitution.institutionType] || 'INST'}</span>
                                  <h2 className="text-lg font-bold text-[#2E3440]">{selectedInstitution.name}</h2>
                                  <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full capitalize ${
                                    selectedInstitution.status === 'active' ? 'text-emerald-700 bg-emerald-50' :
                                    selectedInstitution.status === 'rejected' ? 'text-red-600 bg-red-50' :
                                    'text-amber-700 bg-amber-50'
                                  }`}>{selectedInstitution.status}</span>
                                  <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                                    selectedInstitution.kycStatus === 'verified' ? 'text-emerald-700 bg-emerald-50' :
                                    selectedInstitution.kycStatus === 'rejected' ? 'text-red-600 bg-red-50' :
                                    'text-[#9AA4B2] bg-[#F5F7FA]'
                                  }`}>KYC: {selectedInstitution.kycStatus?.replace('_', ' ') || 'pending'}</span>
                                  {selectedInstitution.institutionCode && (
                                    <code className="text-xs font-mono font-bold text-[#344E86] bg-[#344E86]/10 px-2.5 py-0.5 rounded-md">{selectedInstitution.institutionCode}</code>
                                  )}
                                </div>
                                <p className="text-sm text-[#5F6C80]">{selectedInstitution.email || '—'}{selectedInstitution.phone ? ` · ${selectedInstitution.phone}` : ''}{selectedInstitution.city ? ` · ${selectedInstitution.city}` : ''}</p>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                                {/* Deactivate / Activate */}
                                <button
                                  onClick={async () => {
                                    const newStatus = selectedInstitution.status === 'active' ? 'suspended' : 'active';
                                    const confirmed = window.confirm(`${newStatus === 'suspended' ? 'Deactivate' : 'Activate'} "${selectedInstitution.name}"?`);
                                    if (!confirmed) return;
                                    const res = await fetch(`/api/admin/institutions/${selectedInstitution.id}/status`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) });
                                    if (res.ok) { toast({ title: newStatus === 'suspended' ? 'Institution Deactivated' : 'Institution Activated', description: `${selectedInstitution.name} is now ${newStatus}.` }); refetchInstitutions(); }
                                    else { const d = await res.json(); toast({ title: 'Error', description: d.error || 'Failed', variant: 'destructive' }); }
                                  }}
                                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap ${selectedInstitution.status === 'active' ? 'border-rose-300 text-rose-600 bg-rose-50 hover:bg-rose-100' : 'border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'}`}>
                                  {selectedInstitution.status === 'active' ? 'Deactivate' : 'Activate'}
                                </button>
                                {/* Reset Password */}
                                <button
                                  onClick={async () => {
                                    if (!selectedInstitution.email) { toast({ title: 'No Email', description: 'This institution has no email on file.', variant: 'destructive' }); return; }
                                    const res = await fetch(`/api/admin/institutions/${selectedInstitution.id}/reset-password`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } });
                                    const d = await res.json();
                                    if (res.ok) toast({ title: 'Password Reset Sent', description: `Reset link dispatched to ${d.email}.` });
                                    else toast({ title: 'Error', description: d.error || 'Reset failed', variant: 'destructive' });
                                  }}
                                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors whitespace-nowrap">
                                  Reset Password
                                </button>
                                {/* Notify */}
                                <button
                                  onClick={async () => {
                                    const msg = window.prompt(`Send notification to "${selectedInstitution.name}" (${selectedInstitution.email || 'no email'}):\n\nEnter message:`, 'You have a new update from MetryxOne platform admin. Please log in to review.');
                                    if (!msg) return;
                                    const res = await fetch(`/api/admin/institutions/${selectedInstitution.id}/notify`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg }) });
                                    const d = await res.json();
                                    if (res.ok) toast({ title: 'Notification Sent', description: `Message dispatched to ${d.sent_to || 'institution'}.` });
                                    else toast({ title: 'Error', description: d.error || 'Send failed', variant: 'destructive' });
                                  }}
                                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#4ECDC4] text-[#4ECDC4] bg-[#4ECDC4]/5 hover:bg-[#4ECDC4]/10 transition-colors whitespace-nowrap">
                                  Notify
                                </button>
                                {/* Download */}
                                <button
                                  onClick={() => {
                                    const data = {
                                      id: selectedInstitution.id,
                                      name: selectedInstitution.name,
                                      code: selectedInstitution.institutionCode || '',
                                      type: selectedInstitution.institutionType || '',
                                      status: selectedInstitution.status || '',
                                      kyc_status: selectedInstitution.kycStatus || '',
                                      email: selectedInstitution.email || '',
                                      phone: selectedInstitution.phone || '',
                                      city: selectedInstitution.city || '',
                                      state: selectedInstitution.state || '',
                                      exported_at: new Date().toISOString(),
                                    };
                                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a'); a.href = url;
                                    a.download = `${(selectedInstitution.name || 'institution').replace(/\s+/g, '-').toLowerCase()}-profile.json`;
                                    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                                    toast({ title: 'Profile Downloaded', description: `${selectedInstitution.name} data exported as JSON.` });
                                  }}
                                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#344E86] text-[#344E86] bg-[#344E86]/5 hover:bg-[#344E86]/10 transition-colors whitespace-nowrap">
                                  Download
                                </button>
                                {/* Refresh */}
                                <button onClick={() => refetchInstitutions()} className="text-xs font-medium text-[#5F6C80] border border-[#E2E8F0] px-3 py-1.5 rounded-lg hover:bg-[#F5F7FA] transition-colors whitespace-nowrap bg-white">Refresh</button>
                              </div>
                            </div>
                          </div>

                          <div className="bg-white border-b border-[#E2E8F0] px-6 flex-shrink-0">
                            <div className="flex">
                              {([
                                { id: 'profile', label: 'Profile' },
                                { id: 'documents', label: 'Documents' },
                                { id: 'kyc', label: 'KYC Verification' },
                                { id: 'contacts', label: 'Contacts' },
                                { id: 'activity', label: 'Activity' },
                                { id: 'code', label: 'Platform Code' },
                                { id: 'students', label: 'Students' },
                              ] as const).map(tab => (
                                <button key={tab.id} onClick={() => setInstitutionDetailTab(tab.id)}
                                  className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${institutionDetailTab === tab.id ? 'border-[#344E86] text-[#344E86]' : 'border-transparent text-[#9AA4B2] hover:text-[#5F6C80]'}`}>
                                  {tab.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="flex-1 overflow-y-auto p-6 bg-[#F5F7FA]">
                            {institutionDetailTab === 'profile' && (
                              <div className="space-y-4 max-w-2xl">
                                <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5">
                                  <h3 className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide mb-4">Institution Information</h3>
                                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                                    {[
                                      { label: 'Institution Name', value: selectedInstitution.name },
                                      { label: 'Type', value: selectedInstitution.institutionType },
                                      { label: 'City', value: selectedInstitution.city || '—' },
                                      { label: 'State', value: selectedInstitution.state || '—' },
                                      { label: 'Pincode', value: selectedInstitution.pincode || '—' },
                                      { label: 'Country', value: selectedInstitution.country || 'India' },
                                      { label: 'Students (approx.)', value: selectedInstitution.studentCount ? `~${selectedInstitution.studentCount}` : '—' },
                                      { label: 'Staff (approx.)', value: selectedInstitution.staffCount ? `~${selectedInstitution.staffCount}` : '—' },
                                      { label: 'Affiliation / Board', value: selectedInstitution.affiliationBoard || '—' },
                                      { label: 'Accreditation', value: selectedInstitution.accreditation || '—' },
                                      { label: 'Registered On', value: selectedInstitution.createdAt ? new Date(selectedInstitution.createdAt).toLocaleDateString('en-IN') : '—' },
                                      { label: 'Last Updated', value: selectedInstitution.updatedAt ? new Date(selectedInstitution.updatedAt).toLocaleDateString('en-IN') : '—' },
                                    ].map(({ label, value }) => (
                                      <div key={label}>
                                        <p className="text-xs font-medium text-[#9AA4B2] uppercase tracking-wide mb-1">{label}</p>
                                        <p className="text-sm font-medium text-[#2E3440] capitalize">{value}</p>
                                      </div>
                                    ))}
                                  </div>
                                  {selectedInstitution.address && (
                                    <div className="mt-4 pt-4 border-t border-[#F5F7FA]">
                                      <p className="text-xs font-medium text-[#9AA4B2] uppercase tracking-wide mb-1">Address</p>
                                      <p className="text-sm text-[#5F6C80]">{selectedInstitution.address}</p>
                                    </div>
                                  )}
                                  {selectedInstitution.website && (
                                    <div className="mt-4 pt-4 border-t border-[#F5F7FA]">
                                      <p className="text-xs font-medium text-[#9AA4B2] uppercase tracking-wide mb-1">Website</p>
                                      <a href={selectedInstitution.website} target="_blank" rel="noreferrer" className="text-sm text-[#344E86] underline">{selectedInstitution.website}</a>
                                    </div>
                                  )}
                                </div>
                                <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5">
                                  <h3 className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide mb-3">Account Status Control</h3>
                                  <div className="flex gap-2 flex-wrap">
                                    {['active', 'suspended', 'pending', 'rejected'].map(s => (
                                      <button key={s}
                                        className={`text-xs font-medium px-4 py-2 rounded-lg border transition-colors capitalize ${selectedInstitution.status === s ? 'bg-[#344E86] text-white border-[#344E86]' : 'bg-white text-[#5F6C80] border-[#E2E8F0] hover:border-[#344E86] hover:text-[#344E86]'}`}
                                        onClick={async () => {
                                          await fetch(`/api/admin/institutions/${selectedInstitution.id}/status`, {
                                            method: 'PATCH', credentials: 'include',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ status: s })
                                          });
                                          refetchInstitutions();
                                          setSelectedInstitution({ ...selectedInstitution, status: s });
                                        }}>
                                        {s}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}

                            {institutionDetailTab === 'documents' && (
                              <div className="max-w-2xl space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                  {[
                                    { label: 'Registration Number', value: selectedInstitution.registrationNumber || '—' },
                                    { label: 'PAN Number', value: selectedInstitution.panNumber || '—' },
                                    { label: 'GST Number', value: selectedInstitution.gstNumber || '—' },
                                    { label: 'Documents Verified', value: selectedInstitution.documentsVerified ? 'Verified' : 'Pending Verification' },
                                  ].map(({ label, value }) => (
                                    <div key={label} className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-4">
                                      <p className="text-xs font-medium text-[#9AA4B2] uppercase tracking-wide mb-1">{label}</p>
                                      <p className={`text-sm font-bold font-mono ${value === 'Verified' ? 'text-emerald-700' : value === 'Pending Verification' ? 'text-amber-700' : 'text-[#2E3440]'}`}>{value}</p>
                                    </div>
                                  ))}
                                </div>
                                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 text-sm text-amber-800 leading-relaxed">
                                  Document uploads from institutions are managed through the Onboarding module. Cross-reference with the Onboarding KYC section for supporting documents.
                                </div>
                              </div>
                            )}

                            {institutionDetailTab === 'kyc' && (
                              <div className="max-w-2xl space-y-4">
                                <div className={`p-5 rounded-xl border shadow-sm ${selectedInstitution.kycStatus === 'verified' ? 'bg-emerald-50 border-emerald-100' : selectedInstitution.kycStatus === 'rejected' ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
                                  <p className={`text-sm font-bold ${selectedInstitution.kycStatus === 'verified' ? 'text-emerald-800' : selectedInstitution.kycStatus === 'rejected' ? 'text-red-700' : 'text-amber-800'}`}>
                                    KYC Status: {selectedInstitution.kycStatus?.replace('_', ' ') || 'Pending'}
                                  </p>
                                  <p className="text-xs mt-1 text-[#5F6C80]">
                                    {selectedInstitution.kycStatus === 'verified' ? 'All documents have been verified and approved.' :
                                     selectedInstitution.kycStatus === 'rejected' ? 'KYC rejected — submitted documents did not pass verification.' :
                                     'KYC verification is pending review by the compliance team.'}
                                  </p>
                                </div>
                                <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-5">
                                  <h3 className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide mb-3">Update KYC Status</h3>
                                  <div className="flex gap-2 flex-wrap">
                                    {['verified', 'in_review', 'rejected'].map(s => (
                                      <button key={s}
                                        className={`text-xs font-medium px-4 py-2 rounded-lg border transition-colors capitalize ${selectedInstitution.kycStatus === s ? 'bg-[#344E86] text-white border-[#344E86]' : 'bg-white text-[#5F6C80] border-[#E2E8F0] hover:border-[#344E86] hover:text-[#344E86]'}`}
                                        onClick={async () => {
                                          await fetch(`/api/admin/institutions/${selectedInstitution.id}/verify-kyc`, {
                                            method: 'POST', credentials: 'include',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ status: s })
                                          });
                                          refetchInstitutions();
                                          setSelectedInstitution({ ...selectedInstitution, kycStatus: s, documentsVerified: s === 'verified' });
                                        }}>
                                        {s.replace('_', ' ')}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                {selectedInstitution.notes && (
                                  <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-4">
                                    <p className="text-xs font-medium text-[#9AA4B2] uppercase tracking-wide mb-2">Notes</p>
                                    <p className="text-sm text-[#5F6C80]">{selectedInstitution.notes}</p>
                                  </div>
                                )}
                              </div>
                            )}

                            {institutionDetailTab === 'contacts' && (
                              <div className="max-w-2xl space-y-4">
                                {(selectedInstitution.contactPerson || selectedInstitution.contactEmail || selectedInstitution.contactPhone) && (
                                  <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                                    <div className="px-5 py-3 border-b border-[#F5F7FA]">
                                      <h3 className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide">Primary Contact Person</h3>
                                    </div>
                                    {selectedInstitution.contactPerson && (
                                      <div className="px-5 py-3 border-b border-[#F5F7FA]">
                                        <p className="text-xs font-medium text-[#9AA4B2] uppercase tracking-wide mb-1">Name</p>
                                        <p className="text-sm font-semibold text-[#2E3440]">{selectedInstitution.contactPerson}</p>
                                        {selectedInstitution.contactDesignation && <p className="text-xs text-[#5F6C80] mt-0.5">{selectedInstitution.contactDesignation}</p>}
                                      </div>
                                    )}
                                    {selectedInstitution.contactEmail && (
                                      <div className="px-5 py-3 border-b border-[#F5F7FA]">
                                        <p className="text-xs font-medium text-[#9AA4B2] uppercase tracking-wide mb-1">Email</p>
                                        <p className="text-sm text-[#2E3440]">{selectedInstitution.contactEmail}</p>
                                      </div>
                                    )}
                                    {selectedInstitution.contactPhone && (
                                      <div className="px-5 py-3">
                                        <p className="text-xs font-medium text-[#9AA4B2] uppercase tracking-wide mb-1">Phone</p>
                                        <p className="text-sm text-[#2E3440]">{selectedInstitution.contactPhone}</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {(selectedInstitution.email || selectedInstitution.phone) && (
                                  <div className="grid grid-cols-2 gap-3">
                                    {[
                                      { label: 'Email', value: selectedInstitution.email },
                                      { label: 'Phone', value: selectedInstitution.phone },
                                    ].filter(f => f.value).map(({ label, value }) => (
                                      <div key={label} className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-4">
                                        <p className="text-xs font-medium text-[#9AA4B2] uppercase tracking-wide mb-1">{label}</p>
                                        <p className="text-sm font-medium text-[#2E3440]">{value}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {!selectedInstitution.contactPerson && !selectedInstitution.email && !selectedInstitution.phone && (
                                  <div className="py-16 text-center text-sm text-[#9AA4B2] rounded-xl border border-dashed border-[#E2E8F0] bg-white">No contact information available for this institution</div>
                                )}
                              </div>
                            )}

                            {institutionDetailTab === 'activity' && (
                              <div className="max-w-2xl space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                  {[
                                    { label: 'Account Status', value: selectedInstitution.status || '—', color: selectedInstitution.status === 'active' ? '#059669' : '#9AA4B2' },
                                    { label: 'KYC Status', value: selectedInstitution.kycStatus || '—', color: selectedInstitution.kycStatus === 'verified' ? '#059669' : '#9AA4B2' },
                                    { label: 'Students (approx.)', value: selectedInstitution.studentCount || 0, color: '#344E86' },
                                    { label: 'Staff (approx.)', value: selectedInstitution.staffCount || 0, color: '#344E86' },
                                  ].map(({ label, value, color }) => (
                                    <div key={label} className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-4">
                                      <p className="text-xs font-medium text-[#9AA4B2] uppercase tracking-wide mb-1">{label}</p>
                                      <p className="text-sm font-bold capitalize" style={{ color }}>{value}</p>
                                    </div>
                                  ))}
                                </div>
                                <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                                  {[
                                    { label: 'Registered on platform', value: selectedInstitution.createdAt ? new Date(selectedInstitution.createdAt).toLocaleString('en-IN') : '—' },
                                    { label: 'Last updated', value: selectedInstitution.updatedAt ? new Date(selectedInstitution.updatedAt).toLocaleString('en-IN') : '—' },
                                    { label: 'Activated at', value: selectedInstitution.activatedAt ? new Date(selectedInstitution.activatedAt).toLocaleString('en-IN') : 'Not yet activated' },
                                  ].map(({ label, value }, i) => (
                                    <div key={label} className={`flex items-center justify-between px-5 py-3 ${i > 0 ? 'border-t border-[#F5F7FA]' : ''}`}>
                                      <span className="text-sm text-[#5F6C80]">{label}</span>
                                      <span className="text-sm font-medium text-[#2E3440]">{value}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {institutionDetailTab === 'code' && (
                              <div className="max-w-2xl space-y-5">
                                {selectedInstitution.institutionCode ? (
                                  <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-8 text-center">
                                    <p className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide mb-4">Platform Identifier</p>
                                    <code className="text-3xl font-bold font-mono text-[#344E86] tracking-widest">
                                      {selectedInstitution.institutionCode}
                                    </code>
                                    <p className="text-xs text-[#9AA4B2] mt-4">This code uniquely identifies the institution across the MetryxOne platform.</p>
                                    {selectedInstitution.activatedAt && (
                                      <p className="text-xs text-emerald-600 font-medium mt-2">Activated {new Date(selectedInstitution.activatedAt).toLocaleDateString('en-IN')}</p>
                                    )}
                                  </div>
                                ) : (
                                  <div className="bg-white rounded-xl border border-dashed border-[#E2E8F0] p-8 text-center">
                                    <p className="text-sm font-bold text-[#5F6C80] mb-2">No Platform Code Assigned</p>
                                    <p className="text-xs text-[#9AA4B2] mb-3">Assigning a code will generate a unique identifier:</p>
                                    <code className="text-sm font-mono font-bold text-[#344E86] bg-[#344E86]/10 px-3 py-1.5 rounded-lg">
                                      {selectedInstitution.institutionType === 'school' ? 'MTX-SCH-XXXX' :
                                       selectedInstitution.institutionType === 'college' ? 'MTX-CLG-XXXX' :
                                       selectedInstitution.institutionType === 'ngo' ? 'MTX-NGO-XXXX' : 'MTX-LEI-XXXX'}
                                    </code>
                                    <p className="text-xs text-[#9AA4B2] mt-3 mb-5">This will activate the institution on the platform.</p>
                                    <button
                                      disabled={assigningInstCode}
                                      data-testid="button-assign-institution-code"
                                      className="bg-[#344E86] text-white text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-[#2d4373] transition-colors disabled:opacity-50"
                                      onClick={async () => {
                                        setAssigningInstCode(true);
                                        try {
                                          const res = await fetch(`/api/admin/institutions/${selectedInstitution.id}/assign-code`, {
                                            method: 'POST', credentials: 'include'
                                          });
                                          const data = await res.json();
                                          if (res.ok) {
                                            setSelectedInstitution({ ...selectedInstitution, institutionCode: data.code, status: 'active', activatedAt: new Date().toISOString() });
                                            refetchInstitutions();
                                          } else {
                                            alert(data.error || 'Failed to assign code');
                                          }
                                        } catch { alert('Network error'); }
                                        finally { setAssigningInstCode(false); }
                                      }}>
                                      {assigningInstCode ? 'Generating...' : 'Assign Platform Code'}
                                    </button>
                                  </div>
                                )}
                                <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-4">
                                  <p className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wide mb-3">Code Format Reference</p>
                                  <div className="space-y-2">
                                    {[
                                      { prefix: 'MTX-SCH-XXXX', label: 'Schools' },
                                      { prefix: 'MTX-CLG-XXXX', label: 'Colleges' },
                                      { prefix: 'MTX-NGO-XXXX', label: 'NGOs' },
                                      { prefix: 'MTX-LEI-XXXX', label: 'Learning & Education Institutions' },
                                    ].map(({ prefix, label }) => (
                                      <div key={prefix} className="flex items-center justify-between py-1.5 border-b border-[#F5F7FA] last:border-0">
                                        <code className="text-xs font-mono font-bold text-[#344E86]">{prefix}</code>
                                        <span className="text-xs text-[#9AA4B2]">{label}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}

                            {institutionDetailTab === 'students' && (() => {
                              const rawStudents: any[] = instStudentsData?.students || [];
                              const instStats = instStudentsData?.stats || {};
                              const filteredStudents = rawStudents.filter((s: any) => {
                                if (!instStudentsSearch) return true;
                                const q = instStudentsSearch.toLowerCase();
                                return (s.name || '').toLowerCase().includes(q) ||
                                  (s.grade || '').toLowerCase().includes(q) ||
                                  (s.platform_id || '').toLowerCase().includes(q) ||
                                  (s.parent_name || '').toLowerCase().includes(q) ||
                                  (s.parent_email || '').toLowerCase().includes(q);
                              });
                              const sortedGrades = instStudentsGroupBy === 'grade'
                                ? [...new Set(filteredStudents.map((s: any) => s.grade || 'Unassigned'))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
                                : null;
                              const gradeCounts: Record<string, number> = {};
                              filteredStudents.forEach((s: any) => { const k = s.grade || 'Unassigned'; gradeCounts[k] = (gradeCounts[k] || 0) + 1; });

                              const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : null;

                              const exportCSV = () => {
                                const rows = ['#,Student,Platform ID,Grade,Age,Gender,Board,Parent,Parent ID,Email,Phone,KYC,Plan,Sub Status,Valid Until,Mentor Sessions'];
                                filteredStudents.forEach((s: any, i: number) => {
                                  rows.push([i+1,`"${s.name}"`,s.platform_id||'',s.grade||'',s.age||'',s.gender||'',s.board||'',`"${s.parent_name||''}"`,s.parent_platform_id||'',s.parent_email||'',s.parent_phone||'',s.kyc_status||'N/A',s.subscription_tier||'',s.subscription_status||'',fmtDate(s.subscription_expires_at)||'',s.mentor_session_count||0].join(','));
                                });
                                const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a'); a.href = url;
                                a.download = `${selectedInstitution?.name || 'institution'}-roster.csv`;
                                document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                              };

                              const doAssignPlan = async () => {
                                const pkg = (instPlansList || []).find((p: any) => p.id === instSelectedPlanId || p.product_name === instSelectedPlanId);
                                if (!pkg && !instSelectedPlanId) return;
                                const plan = pkg?.product_name || instSelectedPlanId;
                                const validity_days = pkg?.validity_days || 30;
                                const body: any = { plan, validity_days };
                                if (instAssignPlanModal.isBulk && instAssignPlanModal.grade) body.grade = instAssignPlanModal.grade;
                                if (!instAssignPlanModal.isBulk && instAssignPlanModal.student) body.parent_ids = [instAssignPlanModal.student.parent_id];
                                try {
                                  const res = await fetch(`/api/admin/institutions/${selectedInstitution?.id}/assign-subscription`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                                  const d = await res.json();
                                  if (res.ok) { toast({ title: 'Plan Assigned', description: `${d.assigned} parent(s) enrolled in "${plan}" (${validity_days}d validity).` }); refetchInstStudents(); }
                                  else toast({ title: 'Error', description: d.error || 'Assignment failed', variant: 'destructive' });
                                } catch { toast({ title: 'Network Error', variant: 'destructive' }); }
                                setInstAssignPlanModal({ open: false, student: null, isBulk: false }); setInstSelectedPlanId('');
                              };

                              const doAssignMentor = async () => {
                                if (!instAssignMentorModal.student || !instSelectedMentorId || !instMentorSlotDate) return;
                                try {
                                  const res = await fetch(`/api/admin/institutions/${selectedInstitution?.id}/students/${instAssignMentorModal.student.id}/assign-mentor`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mentor_id: Number(instSelectedMentorId), slot_date: instMentorSlotDate, mode: 'online' }) });
                                  const d = await res.json();
                                  if (res.ok) { toast({ title: 'Session Booked', description: `Mentor session scheduled for ${instAssignMentorModal.student.name}.` }); refetchInstStudents(); }
                                  else toast({ title: 'Error', description: d.error || 'Booking failed', variant: 'destructive' });
                                } catch { toast({ title: 'Network Error', variant: 'destructive' }); }
                                setInstAssignMentorModal({ open: false, student: null }); setInstSelectedMentorId(''); setInstMentorSlotDate('');
                              };

                              const studentRow = (s: any, idx: number) => (
                                <tr key={s.id} className="border-b border-[#F5F7FA] hover:bg-[#F8F9FB] transition-colors">
                                  <td className="px-3 py-2 text-[#9AA4B2] tabular-nums text-xs">{idx + 1}</td>
                                  <td className="px-3 py-2">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-semibold text-[#1A2341] text-xs leading-tight">{s.name}</span>
                                      {s.gender && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${s.gender === 'female' ? 'bg-pink-50 text-pink-600' : 'bg-blue-50 text-blue-600'}`}>{s.gender === 'female' ? 'F' : 'M'}</span>}
                                    </div>
                                    <code className="text-[10px] font-mono text-[#9AA4B2]">{s.platform_id || '—'}</code>
                                  </td>
                                  <td className="px-3 py-2 text-xs text-[#5F6C80] font-medium whitespace-nowrap">{s.age ? `${s.age}y` : '—'}</td>
                                  <td className="px-3 py-2 text-xs text-[#5F6C80]">{s.board || s.medium || '—'}</td>
                                  <td className="px-3 py-2">
                                    {s.parent_name ? (
                                      <>
                                        <div className="text-xs font-medium text-[#1A2341] leading-tight">{s.parent_name} <code className="text-[9px] font-mono text-[#9AA4B2]">{s.parent_platform_id}</code></div>
                                        <div className="text-[10px] text-[#5F6C80] leading-tight">{s.parent_email || ''}{s.parent_phone ? ` · ${s.parent_phone}` : ''}</div>
                                      </>
                                    ) : <span className="text-[10px] text-[#9AA4B2] italic">No parent</span>}
                                  </td>
                                  <td className="px-3 py-2">
                                    {s.subscription_status ? (
                                      <div>
                                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${s.subscription_status === 'active' ? 'bg-emerald-50 text-emerald-700' : s.subscription_status === 'trial' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>{s.subscription_tier || s.subscription_status}</span>
                                        {s.subscription_expires_at && <div className="text-[9px] text-[#9AA4B2] mt-0.5">Until {fmtDate(s.subscription_expires_at)}</div>}
                                      </div>
                                    ) : <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#F5F7FA] text-[#9AA4B2]">None</span>}
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    {Number(s.mentor_session_count) > 0 ? (
                                      <div className="text-center">
                                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#4ECDC4]/15 text-[10px] font-bold text-[#4ECDC4]">{s.mentor_session_count}</span>
                                        {s.last_mentor_name && <div className="text-[9px] text-[#9AA4B2] mt-0.5 truncate max-w-[70px]">{s.last_mentor_name}</div>}
                                      </div>
                                    ) : <span className="text-[10px] text-[#9AA4B2]">—</span>}
                                  </td>
                                  <td className="px-3 py-2">
                                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${s.kyc_status === 'verified' ? 'bg-emerald-50 text-emerald-700' : s.kyc_status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-[#F5F7FA] text-[#9AA4B2]'}`}>{s.kyc_status || 'N/A'}</span>
                                    {s.uid_number && <div className="text-[9px] text-[#9AA4B2] font-mono">{s.uid_number}</div>}
                                  </td>
                                  <td className="px-3 py-2">
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <button onClick={() => { setActiveTab('parents'); setParentSearch(s.parent_name || ''); }} className="text-[10px] font-semibold px-1.5 py-1 rounded bg-[#344E86] text-white hover:bg-[#2d4373] transition-colors whitespace-nowrap">Parent</button>
                                      <button onClick={() => { setInstAssignPlanModal({ open: true, student: s, isBulk: false }); setInstSelectedPlanId(''); }} className="text-[10px] font-semibold px-1.5 py-1 rounded border border-[#344E86] text-[#344E86] hover:bg-[#344E86]/5 transition-colors whitespace-nowrap">Plan</button>
                                      <button onClick={() => { setInstAssignMentorModal({ open: true, student: s }); setInstSelectedMentorId(''); setInstMentorSlotDate(''); }} className="text-[10px] font-semibold px-1.5 py-1 rounded border border-[#4ECDC4] text-[#4ECDC4] hover:bg-[#4ECDC4]/5 transition-colors whitespace-nowrap">Mentor</button>
                                      <button onClick={() => { fetch(`/api/admin/parents/${s.parent_id}/notify`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'general', message: `Hello ${s.parent_name}, this is a message from MetryxOne regarding ${s.name}.` }) }).catch(()=>null); toast({ title: 'Notification Sent', description: `Message queued for ${s.parent_name||'parent'}.` }); }} className="text-[10px] font-semibold px-1.5 py-1 rounded border border-[#E2E8F0] text-[#5F6C80] hover:bg-[#F5F7FA] transition-colors whitespace-nowrap">Notify</button>
                                    </div>
                                  </td>
                                </tr>
                              );

                              return (
                                <>
                                  {/* ── ASSIGN PLAN MODAL ── */}
                                  {instAssignPlanModal.open && (
                                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setInstAssignPlanModal({ open: false, student: null, isBulk: false })}>
                                      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                                        <div className="px-6 py-4 border-b border-[#E2E8F0]">
                                          <h3 className="text-sm font-bold text-[#1A2341]">{instAssignPlanModal.isBulk ? `Assign Plan — ${instAssignPlanModal.grade || 'All Grades'}` : `Assign Plan — ${instAssignPlanModal.student?.name}`}</h3>
                                          <p className="text-xs text-[#9AA4B2] mt-0.5">{instAssignPlanModal.isBulk ? `Will enroll ${instAssignPlanModal.grade ? gradeCounts[instAssignPlanModal.grade] || 0 : filteredStudents.length} parent(s)` : `Parent: ${instAssignPlanModal.student?.parent_name || 'Unknown'}`}</p>
                                        </div>
                                        <div className="overflow-y-auto flex-1 p-4 space-y-2">
                                          {(instPlansList || []).filter((p: any) => p.is_active !== false).map((p: any) => (
                                            <div key={p.id} onClick={() => setInstSelectedPlanId(p.id || p.product_name)} className={`p-3 rounded-xl border cursor-pointer transition-all ${instSelectedPlanId === (p.id || p.product_name) ? 'border-[#344E86] bg-[#344E86]/5 ring-1 ring-[#344E86]' : 'border-[#E2E8F0] hover:border-[#344E86]/40'}`}>
                                              <div className="flex items-center justify-between">
                                                <div>
                                                  <div className="text-xs font-bold text-[#1A2341]">{p.product_name}</div>
                                                  <div className="text-[10px] text-[#5F6C80] mt-0.5">{p.description || p.student_segment || ''}</div>
                                                </div>
                                                <div className="text-right shrink-0 ml-3">
                                                  <div className="text-sm font-bold text-[#344E86]">₹{p.price}</div>
                                                  <div className="text-[10px] text-[#9AA4B2]">{p.validity_days}d validity</div>
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                          {(!instPlansList || instPlansList.length === 0) && <div className="text-xs text-center text-[#9AA4B2] py-8">No plans available</div>}
                                        </div>
                                        <div className="px-6 py-4 border-t border-[#E2E8F0] flex gap-2 justify-end">
                                          <button onClick={() => setInstAssignPlanModal({ open: false, student: null, isBulk: false })} className="text-xs font-semibold px-4 py-2 rounded-lg border border-[#E2E8F0] text-[#5F6C80] hover:bg-[#F5F7FA]">Cancel</button>
                                          <button disabled={!instSelectedPlanId} onClick={doAssignPlan} className="text-xs font-semibold px-4 py-2 rounded-lg bg-[#344E86] text-white hover:bg-[#2d4373] disabled:opacity-40 disabled:cursor-not-allowed">Assign Plan</button>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* ── ASSIGN MENTOR MODAL ── */}
                                  {instAssignMentorModal.open && (
                                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setInstAssignMentorModal({ open: false, student: null })}>
                                      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                                        <div className="px-6 py-4 border-b border-[#E2E8F0]">
                                          <h3 className="text-sm font-bold text-[#1A2341]">Assign Mentor — {instAssignMentorModal.student?.name}</h3>
                                          <p className="text-xs text-[#9AA4B2] mt-0.5">Grade {instAssignMentorModal.student?.grade} · {instAssignMentorModal.student?.parent_name}</p>
                                        </div>
                                        <div className="overflow-y-auto flex-1 p-4 space-y-2">
                                          {(instMentorsList || []).map((m: any) => (
                                            <div key={m.id} onClick={() => setInstSelectedMentorId(String(m.id))} className={`p-3 rounded-xl border cursor-pointer transition-all ${instSelectedMentorId === String(m.id) ? 'border-[#4ECDC4] bg-[#4ECDC4]/5 ring-1 ring-[#4ECDC4]' : 'border-[#E2E8F0] hover:border-[#4ECDC4]/40'}`}>
                                              <div className="text-xs font-bold text-[#1A2341]">{m.display_name || m.full_name}</div>
                                              <div className="text-[10px] text-[#5F6C80] capitalize">{(m.mentor_type || '').replace(/_/g, ' ')}</div>
                                              {m.subjects && m.subjects.length > 0 && <div className="text-[10px] text-[#9AA4B2] mt-0.5">{(m.subjects || []).slice(0,3).join(' · ')}</div>}
                                            </div>
                                          ))}
                                          {(!instMentorsList || instMentorsList.length === 0) && <div className="text-xs text-center text-[#9AA4B2] py-6">No mentors found</div>}
                                          <div className="mt-3 pt-3 border-t border-[#E2E8F0]">
                                            <label className="text-xs font-semibold text-[#5F6C80] block mb-1">Session Date</label>
                                            <input type="date" value={instMentorSlotDate} onChange={e => setInstMentorSlotDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="w-full text-xs border border-[#E2E8F0] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#4ECDC4]/20" />
                                          </div>
                                        </div>
                                        <div className="px-6 py-4 border-t border-[#E2E8F0] flex gap-2 justify-end">
                                          <button onClick={() => setInstAssignMentorModal({ open: false, student: null })} className="text-xs font-semibold px-4 py-2 rounded-lg border border-[#E2E8F0] text-[#5F6C80] hover:bg-[#F5F7FA]">Cancel</button>
                                          <button disabled={!instSelectedMentorId || !instMentorSlotDate} onClick={doAssignMentor} className="text-xs font-semibold px-4 py-2 rounded-lg bg-[#4ECDC4] text-white hover:bg-[#3ab8b0] disabled:opacity-40 disabled:cursor-not-allowed">Book Session</button>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* ── MAIN CONTENT ── */}
                                  <div className="space-y-3">
                                    {/* Stats Bar */}
                                    {rawStudents.length > 0 && (
                                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                                        {[
                                          { label: 'Total', value: instStats.total || rawStudents.length, color: 'text-[#344E86]', bg: 'bg-[#344E86]/6' },
                                          { label: 'Subscribed', value: instStats.with_subscription || 0, color: 'text-emerald-700', bg: 'bg-emerald-50' },
                                          { label: 'No Plan', value: instStats.no_subscription || 0, color: 'text-amber-700', bg: 'bg-amber-50' },
                                          { label: 'KYC Verified', value: instStats.kyc_verified || 0, color: 'text-emerald-700', bg: 'bg-emerald-50' },
                                          { label: 'KYC Pending', value: instStats.kyc_pending || 0, color: 'text-rose-700', bg: 'bg-rose-50' },
                                          { label: 'Sessions', value: instStats.with_sessions || 0, color: 'text-[#4ECDC4]', bg: 'bg-[#4ECDC4]/10' },
                                        ].map(stat => (
                                          <div key={stat.label} className={`${stat.bg} rounded-xl px-3 py-2 text-center`}>
                                            <div className={`text-base font-bold ${stat.color}`}>{stat.value}</div>
                                            <div className="text-[10px] text-[#9AA4B2] font-medium">{stat.label}</div>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* Toolbar */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <input type="text" placeholder="Search name, grade, parent, email..." value={instStudentsSearch} onChange={e => setInstStudentsSearch(e.target.value)} className="flex-1 min-w-[180px] text-xs border border-[#E2E8F0] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#344E86]/20 bg-white" />
                                      <button onClick={() => setInstStudentsGroupBy(g => g === 'grade' ? 'none' : 'grade')} className={`text-xs font-semibold px-3 py-2 rounded-lg border transition-colors whitespace-nowrap ${instStudentsGroupBy === 'grade' ? 'bg-[#344E86] text-white border-[#344E86]' : 'bg-white text-[#5F6C80] border-[#E2E8F0] hover:bg-[#F5F7FA]'}`}>Grade Groups</button>
                                      <button onClick={() => setInstAssignPlanModal({ open: true, student: null, isBulk: true })} className="text-xs font-semibold px-3 py-2 rounded-lg border border-[#344E86] text-[#344E86] bg-white hover:bg-[#344E86]/5 whitespace-nowrap">Assign Plan to All</button>
                                      <button onClick={() => { filteredStudents.forEach((s: any) => { if (s.parent_id) fetch(`/api/admin/parents/${s.parent_id}/notify`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'general', message: `Hello ${s.parent_name}, important update from MetryxOne.` }) }).catch(()=>null); }); toast({ title: 'Bulk Notification Sent', description: `Queued messages for ${filteredStudents.filter(s=>s.parent_id).length} parent(s).` }); }} className="text-xs font-semibold px-3 py-2 rounded-lg border border-[#E2E8F0] text-[#5F6C80] bg-white hover:bg-[#F5F7FA] whitespace-nowrap">Notify All</button>
                                      <button onClick={() => refetchInstStudents()} className="text-xs font-medium text-[#5F6C80] border border-[#E2E8F0] px-3 py-2 rounded-lg hover:bg-[#F5F7FA] bg-white whitespace-nowrap">Refresh</button>
                                      <button onClick={exportCSV} className="text-xs font-semibold px-3 py-2 rounded-lg border border-[#344E86] text-[#344E86] bg-white hover:bg-[#344E86]/5 whitespace-nowrap">Export CSV</button>
                                    </div>

                                    {/* Grade summary */}
                                    <div className="flex items-center gap-3 text-xs text-[#5F6C80] flex-wrap">
                                      <span><span className="font-bold text-[#344E86]">{filteredStudents.length}</span> student{filteredStudents.length !== 1 ? 's' : ''}</span>
                                      {sortedGrades && sortedGrades.map(g => (
                                        <span key={g} className="text-[#9AA4B2]">{g}: <span className="font-semibold text-[#5F6C80]">{gradeCounts[g]}</span>
                                          <button onClick={() => setInstAssignPlanModal({ open: true, student: null, isBulk: true, grade: g })} className="ml-1 text-[10px] text-[#344E86] hover:underline">assign plan</button>
                                        </span>
                                      ))}
                                    </div>

                                    {/* Table */}
                                    {filteredStudents.length === 0 ? (
                                      <div className="bg-white rounded-xl border border-dashed border-[#E2E8F0] p-10 text-center">
                                        <GraduationCap className="h-8 w-8 text-[#344E86]/30 mx-auto mb-3" />
                                        <p className="text-sm font-semibold text-[#344E86]">No Students Linked</p>
                                        <p className="text-xs text-[#9AA4B2] mt-1 max-w-xs mx-auto">Students are matched when their school name equals <span className="font-semibold">{selectedInstitution?.name}</span>.</p>
                                      </div>
                                    ) : (
                                      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                                        <div className="overflow-x-auto">
                                          <table className="w-full text-xs border-collapse">
                                            <thead>
                                              <tr className="bg-[#F5F7FA] border-b border-[#E2E8F0]">
                                                <th className="text-left px-3 py-2 font-semibold text-[#9AA4B2] uppercase tracking-wide w-6">#</th>
                                                <th className="text-left px-3 py-2 font-semibold text-[#9AA4B2] uppercase tracking-wide">Student</th>
                                                <th className="text-left px-3 py-2 font-semibold text-[#9AA4B2] uppercase tracking-wide">Age</th>
                                                <th className="text-left px-3 py-2 font-semibold text-[#9AA4B2] uppercase tracking-wide">Board</th>
                                                <th className="text-left px-3 py-2 font-semibold text-[#9AA4B2] uppercase tracking-wide">Parent / Contact</th>
                                                <th className="text-left px-3 py-2 font-semibold text-[#9AA4B2] uppercase tracking-wide">Subscription</th>
                                                <th className="text-center px-3 py-2 font-semibold text-[#9AA4B2] uppercase tracking-wide">Sessions</th>
                                                <th className="text-left px-3 py-2 font-semibold text-[#9AA4B2] uppercase tracking-wide">KYC</th>
                                                <th className="text-left px-3 py-2 font-semibold text-[#9AA4B2] uppercase tracking-wide">Actions</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {sortedGrades ? (
                                                sortedGrades.flatMap(grp => {
                                                  const grpStudents = filteredStudents.filter((s: any) => (s.grade || 'Unassigned') === grp);
                                                  return [
                                                    <tr key={`grp-${grp}`} className="bg-[#344E86]/5 border-y border-[#344E86]/10">
                                                      <td colSpan={9} className="px-3 py-1.5">
                                                        <div className="flex items-center gap-3">
                                                          <span className="text-[10px] font-bold text-[#344E86] uppercase tracking-widest">{grp}</span>
                                                          <span className="text-[10px] text-[#9AA4B2]">{grpStudents.length} student{grpStudents.length !== 1 ? 's' : ''}</span>
                                                          <button onClick={() => setInstAssignPlanModal({ open: true, student: null, isBulk: true, grade: grp })} className="text-[10px] font-semibold text-[#344E86] hover:underline ml-auto">Assign Plan to Grade</button>
                                                        </div>
                                                      </td>
                                                    </tr>,
                                                    ...grpStudents.map((s: any, i: number) => studentRow(s, filteredStudents.indexOf(s)))
                                                  ];
                                                })
                                              ) : (
                                                filteredStudents.map((s: any, i: number) => studentRow(s, i))
                                              )}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
}
