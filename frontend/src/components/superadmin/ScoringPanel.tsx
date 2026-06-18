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

export default function ScoringPanel() {
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
                <div className="flex flex-col h-full">

                  {/* ── Compact Header ─────────────────────────────────────── */}
                  <div className="bg-white border-b px-6 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                          <Calculator className="h-5 w-5" style={{ color: BRAND.primary }} />
                          Calculation &amp; Norms Engine
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border" style={{ borderColor: BRAND.primary+'40', color: BRAND.primary, backgroundColor: BRAND.primary+'10' }}>{configVersion}</span>
                          {configApproval === 'approved' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 font-medium flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />Approved</span>}
                          {configApproval === 'pending'  && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">Pending Approval</span>}
                          {configApproval === 'draft'    && <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200 font-medium">Draft</span>}
                        </h2>
                        <p className="text-xs text-gray-500">Scoring formulas, norms, domain weights &amp; band thresholds &nbsp;·&nbsp; Last calibrated Jan 2025 &nbsp;·&nbsp; <span className="text-gray-400">{auditLog.length} changes in this version</span></p>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Download CSV Template */}
                        <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-gray-500 hover:text-gray-800" onClick={() => {
                          const templates: Record<string, { filename: string; content: string }> = {
                            agebands: {
                              filename: 'metryx-age-band-norms-template.csv',
                              content: [
                                '# MetryxOne — Age Band Norms Import Template',
                                '# Instructions: Fill in P20/P40/P60/P80 cutoff scores for each age band.',
                                '# P20 = 20th percentile boundary (lowest tier threshold)',
                                '# P80 = 80th percentile boundary (highest tier threshold)',
                                '# Do NOT modify the Band column values.',
                                'Band,Grades,Ages,P20,P40,P60,P80',
                                'A,Gr 6-7,11-13,28,42,58,74',
                                'B,Gr 8-9,13-15,32,46,62,77',
                                'C,Gr 10,15-16,35,50,65,80',
                                'D,Gr 11-12,16-18,38,53,68,82',
                                'E1,UG Yr 1-2,18-20,40,55,70,84',
                                'E2,UG Yr 3+/PG,20-23,42,57,72,86',
                                'E3,Adult,23+,44,59,74,88',
                              ].join('\n'),
                            },
                            domains: {
                              filename: 'metryx-domain-config-template.csv',
                              content: [
                                '# MetryxOne — Domain & Subdomain Configuration Template',
                                '# Instructions: Map each subdomain to a scoring module and age band scope.',
                                '# Module options: LES | ATT | MEM | CU | STR | EXAM',
                                '# Band options: A-E3 | A-D | B-E2 | C-E3 | D-E3 | E1-E3',
                                '# Status options: Active | Draft | Inactive',
                                '# Weight (%) should total 100 across all active subdomains.',
                                'ID,Domain,Subdomain,Module,Band,Weight%,Status',
                                '1,Language & Literacy,Reading Comprehension,LES,A-E3,30,Active',
                                '2,Language & Literacy,Vocabulary Range,CU,A-E3,25,Active',
                                '3,Cognitive Abilities,Working Memory,MEM,B-E2,35,Active',
                                '4,Cognitive Abilities,Sustained Attention,ATT,C-E3,30,Active',
                                '5,Learning & Strategy,Study Strategy Profile,STR,D-E3,20,Draft',
                                '6,Academic Readiness,Exam Preparedness,EXAM,C-E3,40,Active',
                              ].join('\n'),
                            },
                            formulas: {
                              filename: 'metryx-formula-params-template.csv',
                              content: [
                                '# MetryxOne — Formula Parameters Template',
                                '# Instructions: Edit editable parameters only. Fixed params cannot be changed.',
                                '# Weights must be decimals (e.g. 0.60 not 60%).',
                                '# Thresholds can use % suffix (e.g. 15%).',
                                'Module,Parameter Key,Label,Value,Editable',
                                'LES,mmi_items,MMI item count,7,Yes',
                                'LES,mci_items,MCI item count,7,Yes',
                                'ATT,stability_weight,Stability weight,0.60,Yes',
                                'ATT,sr_scale,SR scale factor,8,Yes',
                                'ATT,fatigue_threshold,Fatigue threshold,15%,Yes',
                                'MEM,enc_weight,Encoding weight,0.40,Yes',
                                'MEM,rec_weight,Recognition weight,0.40,Yes',
                                'MEM,dr_weight,Distortion resist. weight,0.20,Yes',
                                'CU,cu1_max,CU1 max score,10,Yes',
                                'CU,cu2_max,CU2 max score,10,Yes',
                                'CU,cu3_max,CU3 max score,10,Yes',
                                'STR,dominant_threshold,Dominant threshold,40%,Yes',
                                'STR,adaptability_min,Min switches for Adaptive,30%,Yes',
                              ].join('\n'),
                            },
                          };
                          const t = templates[scoringSubTab] || templates.agebands;
                          const blob = new Blob([t.content], { type: 'text/csv' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url; a.download = t.filename; a.click();
                          URL.revokeObjectURL(url);
                        }}>
                          <FileText className="h-3.5 w-3.5" /> Template
                        </Button>
                        <label className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors">
                          <Upload className="h-3.5 w-3.5" />
                          Import
                          <input type="file" accept=".csv" className="hidden" onChange={e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = ev => {
                              const text = ev.target?.result as string;
                              const lines = text.trim().split('\n').slice(1);
                              const validated = lines.map(ln => {
                                const parts = ln.split(',');
                                const [band, grades, ages, p20s, p40s, p60s, p80s, ns, ses] = parts;
                                const p20=Number(p20s)||0, p40=Number(p40s)||0, p60=Number(p60s)||0, p80=Number(p80s)||0;
                                const n=Number(ns)||0, se=Number(ses)||0;
                                const errors: string[] = [];
                                if (!band?.trim()) errors.push('Missing band ID');
                                if (!(p20<p40 && p40<p60 && p60<p80)) errors.push('P20<P40<P60<P80 violated');
                                if (p80>100||p20<0) errors.push('Values must be 0–100');
                                return { band:(band||'').trim(), p20, p40, p60, p80, n, se, valid:errors.length===0, error:errors.join('; ') };
                              }).filter(r => r.band);
                              if (validated.length) { setImportPreviewData(validated); setImportPreviewOpen(true); }
                            };
                            reader.readAsText(file);
                            e.target.value = '';
                          }} />
                        </label>
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => {
                          const tab = scoringSubTab;
                          let csv = '';
                          if (tab === 'agebands') {
                            csv = 'Band,Grades,Ages,P20,P40,P60,P80\n' + normRows.map(r => r.band+','+r.grades+','+r.ages+','+r.p20+','+r.p40+','+r.p60+','+r.p80).join('\n');
                          } else if (tab === 'domains') {
                            csv = 'ID,Domain,Subdomain,Module,Band,Weight%,Status\n' + domainRows.map(r => r.id+','+r.domain+','+r.subdomain+','+r.module+','+r.band+','+r.weight+','+r.status).join('\n');
                          } else {
                            csv = 'Module,Name,Formula,Weights,Bands,Params,Status\n' + formulaRows.map(r => r.code+',"'+r.name+'","'+r.formula+'","'+r.weights+'","'+r.bands+'",'+r.params+','+r.status).join('\n');
                          }
                          const blob = new Blob([csv], { type: 'text/csv' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url; a.download = 'metryx-norms-'+tab+'.csv'; a.click();
                          URL.revokeObjectURL(url);
                        }}>
                          <Download className="h-3.5 w-3.5" /> Export
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={async () => {
                          if (scoringSubTab === 'domains') await saveScoringDomains();
                          else if (scoringSubTab === 'agebands') await saveScoringNorms();
                          else if (scoringSubTab === 'formulas') await saveScoringParams();
                          else await saveScoringModules();
                          setConfigApproval('draft');
                        }}>
                          <Save className="h-3.5 w-3.5" /> Save Draft
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className={'gap-1.5 text-xs ' + (normLocked ? 'border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100' : 'border-gray-200 text-gray-600')}
                          onClick={() => setNormLocked(l => !l)}
                          title={normLocked ? 'Config is locked — click to unlock for editing' : 'Lock this config to prevent accidental edits'}
                        >
                          {normLocked
                            ? <><Lock className="h-3.5 w-3.5" /> Locked</>
                            : <><Unlock className="h-3.5 w-3.5" /> Lock Config</>}
                        </Button>
                        <Button size="sm" style={{ backgroundColor: BRAND.primary }} className="text-white gap-1.5 text-xs" onClick={() => { setPublishStatus('idle'); setPublishModalOpen(true); }}>
                          <Upload className="h-3.5 w-3.5" /> Review &amp; Publish
                        </Button>
                      </div>
                    </div>
                    {/* ── 5-Step Implementation Checklist ── */}
                    <div className="mt-1 space-y-2">
                      {(() => {
                        const modulesCount   = moduleScoringCatalog?.modules?.length ?? 0;
                        const domainsCfg     = engineStats?.productsConfigured ?? 0;
                        const domainsTotal   = engineStats?.products ?? 9;
                        const domainsOk      = domainsCfg > 0 && domainsCfg === domainsTotal;
                        const domainsPartial = domainsCfg > 0 && !domainsOk;
                        const normsOk        = normRows.length >= 6;
                        const formulasOk     = formulaRows.every(r => r.status === 'Active');
                        const testedOk       = batchResults.length > 0;
                        const steps: { id: string; num: number; label: string; status: 'done'|'partial'|'pending'; detail: string }[] = [
                          { id:'registry',   num:1, label:'Module Registry',    status: modulesCount > 0 ? 'done' : 'pending',                        detail: modulesCount > 0 ? `${modulesCount} modules active` : 'No modules loaded' },
                          { id:'domains',    num:2, label:'Domain Weights',     status: domainsOk ? 'done' : domainsPartial ? 'partial' : 'pending',   detail: `${domainsCfg} of ${domainsTotal} products configured` },
                          { id:'agebands',   num:3, label:'Age Band Norms',     status: normsOk ? 'done' : 'pending',                                  detail: normsOk ? `${normRows.length} bands calibrated · last Jan 2025` : 'Calibration required' },
                          { id:'formulas',   num:4, label:'Formula Parameters', status: formulasOk ? 'done' : 'partial',                               detail: formulasOk ? 'All formulas active & verified' : 'One or more formulas need review' },
                          { id:'calculator', num:5, label:'Test & Validate',    status: testedOk ? 'done' : 'pending',                                 detail: testedOk ? `${batchResults.length} test${batchResults.length===1?'':'s'} run` : 'Run the calculator to validate' },
                        ];
                        const doneCount = steps.filter(s => s.status === 'done').length;
                        const allDone   = doneCount === steps.length;
                        return (
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Setup Progress</p>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${allDone ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                                {doneCount}/{steps.length} complete
                              </span>
                            </div>
                            <div className="flex items-stretch border border-gray-200 rounded-xl overflow-hidden">
                              {steps.map((s, i) => {
                                const isDone    = s.status === 'done';
                                const isPartial = s.status === 'partial';
                                const isActive  = scoringSubTab === s.id;
                                return (
                                  <button
                                    key={s.id}
                                    onClick={() => setScoringSubTab(s.id)}
                                    className={`flex-1 flex flex-col gap-1 px-3 py-2.5 text-left transition-all border-r last:border-r-0 ${isActive ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'}`}
                                    style={isActive ? { borderBottomColor: BRAND.primary } : {}}
                                  >
                                    <div className="flex items-center gap-1.5">
                                      {isDone
                                        ? <CheckCircle className="h-3.5 w-3.5 flex-shrink-0 text-green-500" />
                                        : isPartial
                                        ? <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                                        : <span className="h-3.5 w-3.5 rounded-full border-2 border-gray-300 flex-shrink-0 flex items-center justify-center text-[8px] font-bold text-gray-400">{s.num}</span>
                                      }
                                      <span className={`text-[11px] font-semibold truncate ${isDone ? 'text-gray-700' : isPartial ? 'text-amber-700' : 'text-gray-500'}`}>{s.label}</span>
                                      {i < steps.length - 1 && <ChevronRight className="h-3 w-3 text-gray-300 ml-auto flex-shrink-0" />}
                                    </div>
                                    <p className={`text-[10px] pl-5 leading-tight ${isDone ? 'text-green-600' : isPartial ? 'text-amber-600' : 'text-gray-400'}`}>{s.detail}</p>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                      {/* Compact inventory line */}
                      <p className="text-[10px] text-gray-400 pt-0.5">
                        {engineStats?.modules ?? '—'} modules &nbsp;·&nbsp; {engineStats?.domains ?? '—'} domains &nbsp;·&nbsp; {engineStats?.subdomains ?? '—'} subdomains &nbsp;·&nbsp; {engineStats?.ageBands ?? '—'} age bands &nbsp;·&nbsp; {engineStats?.correlations ?? '—'} correlations &nbsp;·&nbsp; {engineStats?.products ?? '—'} products
                      </p>
                    </div>
                  </div>

                  {/* ── Sub-tab Bar ────────────────────────────────────────── */}
                  <div className="bg-white border-b px-6 flex gap-0">
                    {[
                      { id: 'registry',   label: 'Module Registry',         badge: engineStats?.modules },
                      { id: 'domains',    label: 'Domain & Subdomain Config', badge: engineStats ? `${engineStats.productsConfigured}/${engineStats.products}` : undefined },
                      { id: 'agebands',  label: 'Age Band Norms',           badge: engineStats?.ageBands },
                      { id: 'formulas',  label: 'Formula Parameters',       badge: undefined },
                      { id: 'calculator', label: 'Test Calculator',         badge: undefined },
                      { id: 'audit',      label: 'Audit & History',         badge: auditLog.length },
                    ].map(t => (
                      <button
                        key={t.id}
                        onClick={() => setScoringSubTab(t.id)}
                        className={'px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ' + (scoringSubTab === t.id ? '' : 'border-transparent text-gray-500 hover:text-gray-800')}
                        style={scoringSubTab === t.id ? { borderColor: BRAND.primary, color: BRAND.primary } : {}}
                      >
                        {t.label}
                        {t.badge !== undefined && (
                          <span className={'text-[10px] px-1.5 py-0.5 rounded-full font-semibold ' + (scoringSubTab === t.id ? '' : 'bg-gray-100 text-gray-500')} style={scoringSubTab === t.id ? { backgroundColor: BRAND.primary+'15', color: BRAND.primary } : {}}>
                            {t.badge}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="flex-1 overflow-auto p-5 space-y-4">

                    {/* ═══════ MODULE REGISTRY ═══════ */}
                    {scoringSubTab === 'registry' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-gray-800">All Scoring Modules</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{formulaRows.filter(m => m.status === 'Active').length} active</Badge>
                            <Button size="sm" style={{ backgroundColor: BRAND.primary }} className="text-white gap-1.5 text-xs" onClick={() => {
                              const code = prompt('Module code (e.g. NEW):');
                              if (!code) return;
                              const name = prompt('Module name:') || code;
                              setFormulaRows(prev => [...prev, {
                                code: code.toUpperCase(), name, formula: '', weights: '', bands: '',
                                params: 0, status: 'Draft', color: '#6B7280',
                              }]);
                            }}>
                              <Plus className="h-3.5 w-3.5" /> Add Module
                            </Button>
                            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={saveScoringModules}>
                              <Save className="h-3.5 w-3.5" /> Save Modules
                            </Button>
                          </div>
                        </div>
                        <Card>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b bg-gray-50">
                                  {['Code','Module Name','Formula','Domain Weights','Performance Bands','Color','Status','Actions'].map(h => (
                                    <th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-600 uppercase tracking-wider text-[10px] whitespace-nowrap">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {formulaRows.map((m, mi) => {
                                  const updateModule = (field: string, value: string) => {
                                    setFormulaRows(prev => prev.map((r, i) => i === mi ? { ...r, [field]: value } : r));
                                  };
                                  return (
                                  <tr key={m.code + mi} className="hover:bg-gray-50 group">
                                    <td className="px-3 py-2">
                                      <input value={m.code} onChange={e => updateModule('code', e.target.value.toUpperCase())}
                                        className="w-14 border-b border-transparent group-hover:border-gray-300 focus:border-blue-400 focus:outline-none text-[10px] font-bold bg-transparent text-center rounded px-1 py-0.5"
                                        style={{ color: '#fff', backgroundColor: m.color }} />
                                    </td>
                                    <td className="px-3 py-2">
                                      <input value={m.name} onChange={e => updateModule('name', e.target.value)}
                                        className="w-full border-b border-transparent group-hover:border-gray-300 focus:border-blue-400 focus:outline-none font-medium text-gray-800 bg-transparent text-xs py-0.5" />
                                    </td>
                                    <td className="px-3 py-2">
                                      <input value={m.formula} onChange={e => updateModule('formula', e.target.value)}
                                        className="w-full border-b border-transparent group-hover:border-gray-300 focus:border-blue-400 focus:outline-none font-mono text-[10px] bg-transparent py-0.5" />
                                    </td>
                                    <td className="px-3 py-2">
                                      <input value={m.weights} onChange={e => updateModule('weights', e.target.value)}
                                        className="w-full border-b border-transparent group-hover:border-gray-300 focus:border-blue-400 focus:outline-none text-gray-600 text-[10px] bg-transparent py-0.5" />
                                    </td>
                                    <td className="px-3 py-2">
                                      <input value={m.bands} onChange={e => updateModule('bands', e.target.value)}
                                        className="w-full border-b border-transparent group-hover:border-gray-300 focus:border-blue-400 focus:outline-none text-gray-500 text-[10px] bg-transparent py-0.5 max-w-xs" />
                                    </td>
                                    <td className="px-3 py-2">
                                      <input type="color" value={m.color} onChange={e => updateModule('color', e.target.value)}
                                        className="w-8 h-6 border rounded cursor-pointer" />
                                    </td>
                                    <td className="px-3 py-2">
                                      <select value={m.status} onChange={e => updateModule('status', e.target.value)}
                                        className={'border rounded px-2 py-1 text-[10px] font-medium focus:outline-none ' + (m.status==='Active' ? 'border-green-200 text-green-700 bg-green-50' : m.status==='Draft' ? 'border-amber-200 text-amber-700 bg-amber-50' : 'border-gray-200 text-gray-500 bg-gray-50')}>
                                        <option value="Active">Active</option>
                                        <option value="Draft">Draft</option>
                                        <option value="Inactive">Inactive</option>
                                      </select>
                                    </td>
                                    <td className="px-3 py-2">
                                      <div className="flex gap-1">
                                        <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]" onClick={() => { setExpandedModule(m.code); setScoringSubTab('formulas'); }}>Params</Button>
                                        <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]" onClick={() => setScoringSubTab('calculator')}>Test</Button>
                                        <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px] text-red-500 hover:text-red-700 hover:bg-red-50"
                                          onClick={() => { if (confirm(`Delete module ${m.code}?`)) setFormulaRows(prev => prev.filter((_, i) => i !== mi)); }}>
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </td>
                                  </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </Card>
                        {/* Health Legend */}
                        <div className="flex items-center gap-4 text-[10px] text-gray-500 px-1">
                          <span className="font-semibold text-gray-600">Health Legend:</span>
                          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-400" />Healthy (drift &lt;3%)</span>
                          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" />Watch (drift 3–6%)</span>
                          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" />Error / Action Required</span>
                          <span className="ml-auto text-gray-400">Linked = assessment packages using this module</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { title: 'Age Band Norms', desc: 'Edit P20–P80 percentile cutoffs per cohort', tab: 'agebands', icon: BarChart2, color: '#344E86' },
                            { title: 'Formula Parameters', desc: 'Adjust weights, thresholds, scale factors', tab: 'formulas', icon: SlidersHorizontal, color: '#059669' },
                            { title: 'Test Calculator', desc: 'Verify scores with live formula execution', tab: 'calculator', icon: FlaskConical, color: '#7C3AED' },
                          ].map(card => {
                            const Icon = card.icon;
                            return (
                              <Card key={card.tab} className="cursor-pointer hover:shadow-md transition-shadow border" onClick={() => setScoringSubTab(card.tab)}>
                                <CardContent className="pt-3 pb-3 flex items-start gap-3">
                                  <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: card.color + '18' }}>
                                    <Icon className="h-4 w-4" style={{ color: card.color }} />
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-gray-800">{card.title}</p>
                                    <p className="text-xs text-gray-500">{card.desc}</p>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* ═══════ DOMAIN & SUBDOMAIN CONFIG ═══════ */}
                    {scoringSubTab === 'domains' && (
                      <div className="space-y-4">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-gray-800">Domain &amp; Subdomain Weight Configuration</p>
                            <p className="text-xs text-gray-500">Select an assessment product, then manually key in domain and subdomain weights · Values auto-balance to 100%</p>
                          </div>
                          <span className="text-[10px] text-gray-400">{(assessmentProducts?.products||[]).filter((p:any)=>p.domainConfig?.length>0).length} of {(assessmentProducts?.products||[]).length} products configured</span>
                        </div>

                        {/* Assessment Product Picker */}
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Assessment Products</p>
                          <div className="flex gap-3 overflow-x-auto pb-2">
                            {(assessmentProducts?.products || []).map((p: any) => {
                              const isSel = selectedProductId === p.id;
                              const isCfg = p.domainConfig?.length > 0;
                              return (
                                <button key={p.id} onClick={() => { setSelectedProductId(p.id); setDomainSaveStatus('idle'); }}
                                  className={`flex-shrink-0 text-left rounded-xl border-2 p-3 w-48 transition-all ${isSel ? 'border-[#344E86] bg-blue-50 shadow-md' : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'}`}>
                                  <div className="flex items-start justify-between mb-1.5">
                                    <p className="text-xs font-bold text-gray-800 leading-tight">{p.name}</p>
                                    {isCfg && <span className="h-2 w-2 rounded-full bg-green-500 flex-shrink-0 mt-0.5" />}
                                  </div>
                                  {p.ageBands?.length > 0 && <p className="text-[10px] text-gray-500 mb-0.5">Bands: {p.ageBands.join(', ')}</p>}
                                  <p className="text-[10px] text-gray-400">{p.questionCount} items{p.price ? ` · ₹${p.price.toLocaleString()}` : ''}</p>
                                  <p className={`text-[10px] font-medium mt-1.5 ${isCfg ? 'text-green-600' : 'text-gray-400'}`}>{isCfg ? 'Weights configured' : 'Not configured'}</p>
                                </button>
                              );
                            })}
                            {!(assessmentProducts?.products?.length) && <p className="text-xs text-gray-400 py-4">Loading products…</p>}
                          </div>
                        </div>

                        {/* No selection prompt */}
                        {!selectedProductId && (
                          <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
                            <p className="text-sm font-medium text-gray-500 mb-1">Select an assessment product above</p>
                            <p className="text-xs text-gray-400">Domains and subdomains will appear here for weight configuration</p>
                          </div>
                        )}

                        {/* Weight Configuration Panel */}
                        {selectedProductId && productWeightConfig.length > 0 && (() => {
                          const domainTotal = Math.round(productWeightConfig.reduce((s, d) => s + d.domainWeight, 0));
                          const domainOk = domainTotal === 100;
                          const PAL = ['#344E86','#4ECDC4','#FF6B6B','#45B7D1','#96CEB4','#F7DC6F','#DDA0DD','#98D8C8','#FFB347','#82E0AA','#AED6F1','#F1948A','#FAD7A0','#D7BDE2'];
                          return (
                            <div className="space-y-3">
                              {/* Summary + Action Bar */}
                              <div className="flex items-center justify-between bg-gray-50 border rounded-xl px-4 py-3">
                                <div className="flex items-center gap-6">
                                  <div>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wide">Domain Weights Total</p>
                                    <p className={`text-xl font-bold ${domainOk ? 'text-green-600' : 'text-red-500'}`}>{domainTotal}%
                                      <span className="text-xs font-normal ml-1.5">{domainOk ? '— Balanced' : `${domainTotal > 100 ? 'Over' : 'Under'} by ${Math.abs(100-domainTotal)}%`}</span>
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wide">Domains</p>
                                    <p className="text-xl font-bold text-gray-800">{productWeightConfig.length}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wide">Subdomains</p>
                                    <p className="text-xl font-bold text-gray-800">{productWeightConfig.reduce((s,d)=>s+d.subdomains.length,0)}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => {
                                    const n = productWeightConfig.length;
                                    const sh = Math.floor(100/n); const rem = 100-sh*n;
                                    setProductWeightConfig(prev => prev.map((d, di) => {
                                      const sn = d.subdomains.length; const ss = sn ? Math.floor(100/sn) : 0; const sr = sn ? 100-ss*sn : 0;
                                      return { ...d, domainWeight: di===n-1 ? sh+rem : sh, subdomains: d.subdomains.map((s,si)=>({...s,weight:si===sn-1?ss+sr:ss})) };
                                    }));
                                  }}>
                                    <BarChart2 className="h-3.5 w-3.5" /> Auto-Balance All
                                  </Button>
                                  <Button size="sm" style={{ backgroundColor: domainOk ? BRAND.primary : '#9CA3AF' }} disabled={!domainOk}
                                    className="text-white gap-1.5 text-xs" onClick={async () => {
                                      setDomainSaveStatus('saving');
                                      try {
                                        const r = await fetch(`/api/admin/scoring/assessment-products/${selectedProductId}/domain-config`, {
                                          method: 'PUT', credentials: 'include',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ domainConfig: productWeightConfig }),
                                        });
                                        setDomainSaveStatus(r.ok ? 'saved' : 'error');
                                        if (r.ok) refetchProducts();
                                      } catch { setDomainSaveStatus('error'); }
                                    }}>
                                    {domainSaveStatus==='saving' ? <><span className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin"/> Saving…</> : domainSaveStatus==='saved' ? <><CheckCircle className="h-3.5 w-3.5"/> Saved</> : <><Save className="h-3.5 w-3.5"/> Save Config</>}
                                  </Button>
                                </div>
                              </div>

                              {/* Domain weight visualization */}
                              <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 gap-px">
                                {productWeightConfig.map((d, di) => (
                                  <div key={d.domainCode} style={{ width:`${d.domainWeight}%`, backgroundColor: PAL[di%PAL.length] }} title={`${d.domainName}: ${d.domainWeight}%`} className="transition-all"/>
                                ))}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {productWeightConfig.map((d, di) => (
                                  <span key={d.domainCode} className="flex items-center gap-1 text-[10px] text-gray-600">
                                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PAL[di%PAL.length] }}/>{d.domainCode}: {d.domainWeight}%
                                  </span>
                                ))}
                              </div>

                              {/* Domain Cards */}
                              {productWeightConfig.map((domain, di) => {
                                const sdTotal = Math.round(domain.subdomains.reduce((s,sd)=>s+sd.weight,0));
                                const sdOk = sdTotal===100||domain.subdomains.length===0;
                                return (
                                  <Card key={domain.domainCode} className="border-l-4 transition-all" style={{ borderLeftColor: PAL[di%PAL.length] }}>
                                    <CardContent className="pt-3 pb-4">
                                      {/* Domain header */}
                                      <div className="flex items-center gap-3 mb-3">
                                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded text-white" style={{ backgroundColor: PAL[di%PAL.length] }}>{domain.domainCode}</span>
                                        <p className="text-xs font-bold text-gray-800 flex-1">{domain.domainName}</p>
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] text-gray-500">Domain Weight:</span>
                                          <input type="number" min={0} max={100} step={1}
                                            className="w-16 border-2 border-gray-200 rounded-lg px-2 py-1 text-sm font-bold text-center focus:outline-none focus:border-blue-400"
                                            style={{ color: PAL[di%PAL.length] }}
                                            value={domain.domainWeight}
                                            onChange={e => {
                                              const v = Math.min(100,Math.max(0,Number(e.target.value)));
                                              setProductWeightConfig(prev => prev.map((d,i)=>i===di?{...d,domainWeight:v}:d));
                                              setDomainSaveStatus('idle');
                                            }}/>
                                          <span className="text-sm font-bold text-gray-400">%</span>
                                        </div>
                                      </div>
                                      {/* Domain bar */}
                                      <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
                                        <div className="h-1.5 rounded-full transition-all" style={{ width:`${Math.min(100,domain.domainWeight)}%`, backgroundColor: PAL[di%PAL.length] }}/>
                                      </div>
                                      {/* Subdomains */}
                                      {domain.subdomains.length > 0 && (
                                        <>
                                          <div className="flex items-center justify-between mb-2">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Subdomains</p>
                                            <div className="flex items-center gap-3">
                                              <span className={`text-[10px] font-semibold ${sdOk?'text-green-600':'text-amber-600'}`}>
                                                Sum: {sdTotal}% {sdOk ? '✓' : `(off by ${Math.abs(100-sdTotal)}%)`}
                                              </span>
                                              <button className="text-[10px] text-blue-600 hover:underline font-medium" onClick={() => {
                                                const sn = domain.subdomains.length; const ss = Math.floor(100/sn); const sr = 100-ss*sn;
                                                setProductWeightConfig(prev => prev.map((d,i)=>i===di?{...d,subdomains:d.subdomains.map((s,si)=>({...s,weight:si===sn-1?ss+sr:ss}))}:d));
                                                setDomainSaveStatus('idle');
                                              }}>Auto-balance</button>
                                            </div>
                                          </div>
                                          <div className="space-y-2">
                                            {domain.subdomains.map((sd, si) => (
                                              <div key={sd.code} className="flex items-center gap-3">
                                                <div className="flex-1 flex items-center gap-2 min-w-0">
                                                  <span className="h-1.5 w-1.5 rounded-full bg-gray-300 flex-shrink-0"/>
                                                  <span className="text-xs text-gray-700 truncate">{sd.name}</span>
                                                  <span className="text-[10px] font-mono text-gray-400 flex-shrink-0">{sd.code}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                                  <input type="number" min={0} max={100} step={1}
                                                    className="w-14 border border-gray-200 rounded-lg px-2 py-0.5 text-xs font-mono font-bold text-center focus:outline-none focus:border-blue-400"
                                                    value={sd.weight}
                                                    onChange={e => {
                                                      const v = Math.min(100,Math.max(0,Number(e.target.value)));
                                                      setProductWeightConfig(prev => prev.map((d,i)=>i===di?{...d,subdomains:d.subdomains.map((s,j)=>j===si?{...s,weight:v}:s)}:d));
                                                      setDomainSaveStatus('idle');
                                                    }}/>
                                                  <span className="text-[10px] text-gray-400">%</span>
                                                  <div className="w-20 bg-gray-100 rounded-full h-1.5">
                                                    <div className="h-1.5 rounded-full transition-all" style={{ width:`${sd.weight}%`, backgroundColor: PAL[di%PAL.length]+'AA' }}/>
                                                  </div>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                          <div className="flex h-1.5 rounded-full overflow-hidden mt-2.5 bg-gray-100 gap-px">
                                            {domain.subdomains.map((sd) => (
                                              <div key={sd.code} style={{ width:`${sd.weight}%`, backgroundColor: PAL[di%PAL.length]+'CC' }} className="transition-all"/>
                                            ))}
                                          </div>
                                        </>
                                      )}
                                      {domain.subdomains.length===0 && <p className="text-[10px] text-gray-400 italic">No subdomains configured for this domain</p>}
                                    </CardContent>
                                  </Card>
                                );
                              })}
                            </div>
                          );
                        })()}

                        {/* Save domain config button */}
                        <div className="flex justify-end">
                          <Button size="sm" style={{ backgroundColor: BRAND.primary }} className="text-white gap-1.5 text-xs" onClick={saveScoringDomains}>
                            <Save className="h-3.5 w-3.5" /> Save Domain Config
                          </Button>
                        </div>

                        {/* Domain summary cards */}
                        <div className="grid grid-cols-2 gap-3">
                          {(() => {
                            const grouped: Record<string, typeof domainRows> = {};
                            domainRows.forEach(r => { if (!grouped[r.domain]) grouped[r.domain]=[]; grouped[r.domain].push(r); });
                            return Object.entries(grouped).map(([domain, rows]) => (
                              <Card key={domain} className="border">
                                <CardContent className="pt-3 pb-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-bold text-gray-800">{domain}</p>
                                    <Badge variant="outline" className="text-[10px]">{rows.length} subdomains</Badge>
                                  </div>
                                  <div className="space-y-1">
                                    {rows.map(r => (
                                      <div key={r.id} className="flex items-center justify-between text-[10px]">
                                        <span className="text-gray-600">{r.subdomain}</span>
                                        <div className="flex items-center gap-2">
                                          <span className="px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: (formulaRows.find(f=>f.code===r.module)?.color||'#888')+'20', color: formulaRows.find(f=>f.code===r.module)?.color||'#888' }}>{r.module}</span>
                                          <span className="text-gray-400">{r.weight}%</span>
                                          <span className={'px-1.5 py-0.5 rounded ' + (r.status==='Active'?'bg-green-50 text-green-600':'bg-amber-50 text-amber-600')}>{r.status}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </CardContent>
                              </Card>
                            ));
                          })()}
                        </div>
                      </div>
                    )}
                    {/* ═══════ AGE BAND NORMS ═══════ */}
                    {scoringSubTab === 'agebands' && (() => {
                      const invalidBands = normRows.filter(r => !(r.p20 < r.p40 && r.p40 < r.p60 && r.p60 < r.p80));
                      return (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-gray-800">Age Band Norm Tables</p>
                            <p className="text-xs text-gray-500">P20–P80 cutoff scores used to classify raw scores into performance tiers by cohort</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 text-xs">
                              {[['P20','bg-red-100 text-red-700'],['P40','bg-orange-100 text-orange-700'],['P60','bg-yellow-100 text-yellow-700'],['P80','bg-green-100 text-green-700']].map(([l,cls]) => (
                                <span key={l} className={'px-2 py-0.5 rounded font-medium ' + cls}>{l}</span>
                              ))}
                              <span className="text-gray-400">= lower boundary</span>
                            </div>
                            {invalidBands.length === 0
                              ? <span className="flex items-center gap-1 text-[10px] text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 font-medium"><CheckCircle className="h-3 w-3" /> All bands valid</span>
                              : <span className="flex items-center gap-1 text-[10px] text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5 font-medium"><AlertTriangle className="h-3 w-3" /> {invalidBands.length} band{invalidBands.length>1?'s':''} invalid</span>
                            }
                            <Button size="sm" disabled={normLocked} style={{ backgroundColor: BRAND.primary }} className="text-white gap-1.5 text-xs"
                              onClick={() => setNormRows(prev => [...prev, { band: 'NEW', grades: '', ages: '', p20: 20, p40: 40, p60: 60, p80: 80, n: 0, se: 0 }])}>
                              <Plus className="h-3.5 w-3.5" /> Add Band
                            </Button>
                          </div>
                        </div>
                        {invalidBands.length > 0 && (
                          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                            <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                            <div className="text-xs text-red-700">
                              <span className="font-semibold">Norm Validation Error: </span>
                              {invalidBands.map(r => r.band).join(', ')} — P20 must be &lt; P40 &lt; P60 &lt; P80 in ascending order. Fix before publishing.
                            </div>
                          </div>
                        )}
                        <Card>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b bg-gray-50">
                                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Band</th>
                                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Grades</th>
                                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Ages</th>
                                  <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-red-600 uppercase tracking-wider">P20</th>
                                  <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-orange-600 uppercase tracking-wider">P40</th>
                                  <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-yellow-600 uppercase tracking-wider">P60</th>
                                  <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-green-600 uppercase tracking-wider">P80</th>
                                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Curve</th>
                                  <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-indigo-600 uppercase tracking-wider">N</th>
                                  <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-purple-600 uppercase tracking-wider">SE</th>
                                  <th className="px-2 py-2.5 text-[10px]"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {normRows.map((r, ri) => {
                                  const isRowValid = r.p20 < r.p40 && r.p40 < r.p60 && r.p60 < r.p80;
                                  const pts = [r.p20,r.p40,r.p60,r.p80];
                                  const mn = Math.min(...pts)-5, mx = Math.max(...pts)+5;
                                  const sx = (v:number) => ((v-mn)/(mx-mn)*58)+1;
                                  const pathD = `M ${sx(r.p20)} 14 Q ${sx(r.p40)} 2 ${sx(r.p60)} 8 T ${sx(r.p80)} 2`;
                                  return (
                                  <tr key={r.band} className={'hover:bg-gray-50 group ' + (!isRowValid ? 'bg-red-50/30' : '')}>
                                    <td className="px-3 py-1.5">
                                      <input value={r.band} disabled={normLocked}
                                        onChange={e => setNormRows(p => p.map((row,rIdx) => rIdx===ri ? {...row, band: e.target.value} : row))}
                                        className={'w-10 text-center text-[10px] font-bold rounded py-0.5 border-b border-transparent group-hover:border-gray-300 focus:border-blue-400 focus:outline-none ' + (normLocked ? 'bg-gray-50 cursor-not-allowed' : 'bg-transparent')}
                                        style={{ color: '#fff', backgroundColor: BRAND.primary }} />
                                    </td>
                                    <td className="px-3 py-1.5">
                                      <input value={r.grades} disabled={normLocked}
                                        onChange={e => setNormRows(p => p.map((row,rIdx) => rIdx===ri ? {...row, grades: e.target.value} : row))}
                                        className={'w-24 border-b border-transparent group-hover:border-gray-300 focus:border-blue-400 focus:outline-none text-gray-700 bg-transparent text-xs py-0.5 ' + (normLocked ? 'cursor-not-allowed' : '')} />
                                    </td>
                                    <td className="px-3 py-1.5">
                                      <input value={r.ages} disabled={normLocked}
                                        onChange={e => setNormRows(p => p.map((row,rIdx) => rIdx===ri ? {...row, ages: e.target.value} : row))}
                                        className={'w-16 border-b border-transparent group-hover:border-gray-300 focus:border-blue-400 focus:outline-none text-gray-700 bg-transparent text-xs py-0.5 ' + (normLocked ? 'cursor-not-allowed' : '')} />
                                    </td>
                                    {(['p20','p40','p60','p80'] as const).map(key => (
                                      <td key={key} className="px-3 py-1.5 text-center">
                                        <input
                                          type="number"
                                          disabled={normLocked}
                                          value={r[key]}
                                          onChange={e => setNormRows(p => p.map((row,rIdx) => rIdx===ri ? {...row, [key]: Number(e.target.value)} : row))}
                                          className={'w-14 border rounded text-center py-0.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 ' + (normLocked ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : '')}
                                        />
                                      </td>
                                    ))}
                                    <td className="px-3 py-1.5">
                                      <svg width="60" height="16" viewBox="0 0 60 16" className="overflow-visible">
                                        <defs>
                                          <linearGradient id={'ng'+ri} x1="0" y1="0" x2="1" y2="0">
                                            <stop offset="0%" stopColor="#EF4444" />
                                            <stop offset="33%" stopColor="#F59E0B" />
                                            <stop offset="66%" stopColor="#84CC16" />
                                            <stop offset="100%" stopColor="#22C55E" />
                                          </linearGradient>
                                        </defs>
                                        <path d={pathD} fill="none" stroke={`url(#ng${ri})`} strokeWidth="1.5" strokeLinecap="round" />
                                        {pts.map((v,i) => <circle key={i} cx={sx(v)} cy={i===0?14:i===1?2:i===2?8:2} r="1.5" fill={['#EF4444','#F59E0B','#84CC16','#22C55E'][i]} />)}
                                      </svg>
                                    </td>
                                    <td className="px-3 py-1.5 text-center">
                                      <input
                                        type="number"
                                        disabled={normLocked}
                                        value={r.n}
                                        onChange={e => setNormRows(p => p.map((row,rIdx) => rIdx===ri ? {...row, n: Number(e.target.value)} : row))}
                                        className={'w-16 border rounded text-center py-0.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-400 ' + (normLocked ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : '')}
                                      />
                                    </td>
                                    <td className="px-3 py-1.5 text-center">
                                      <input type="number" step="0.1" disabled={normLocked} value={r.se}
                                        onChange={e => setNormRows(p => p.map((row,rIdx) => rIdx===ri ? {...row, se: Number(e.target.value)} : row))}
                                        className={'w-14 border rounded text-center py-0.5 text-xs font-mono text-purple-700 focus:outline-none focus:ring-1 focus:ring-purple-400 ' + (normLocked ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : '')} />
                                    </td>
                                    <td className="px-2 py-1.5">
                                      <Button variant="ghost" size="sm" disabled={normLocked}
                                        className="h-6 px-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity text-[10px]"
                                        onClick={() => setNormRows(p => p.filter((_,rIdx) => rIdx !== ri))}>
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </td>
                                  </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </Card>
                        <Card className="border-amber-200 bg-amber-50">
                          <CardContent className="py-2 px-4">
                            <div className="flex gap-2 items-start">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                              <p className="text-xs text-amber-700">ATT, MEM and STR apply internal scaling before these cutoffs. Fatigue Sensitivity and Adaptability are additive adjustments on top of the base percentile classification.</p>
                            </div>
                          </CardContent>
                        </Card>
                        {/* Save norms button */}
                        <div className="flex justify-end">
                          <Button size="sm" style={{ backgroundColor: BRAND.primary }} className="text-white gap-1.5 text-xs" onClick={saveScoringNorms}>
                            <Save className="h-3.5 w-3.5" /> Save Age Band Norms
                          </Button>
                        </div>
                      </div>
                      );
                    })()}

                    {/* ═══════ FORMULA PARAMETERS ═══════ */}
                    {scoringSubTab === 'formulas' && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between mb-1">
                          <div>
                            <p className="text-sm font-semibold text-gray-800">Scoring Formula Parameters</p>
                            <p className="text-xs text-gray-500">Click any row to expand steps &amp; edit parameters</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => {
                              const moduleCode = prompt('Module code (e.g. LES, ATT, MEM):')?.toUpperCase();
                              if (!moduleCode) return;
                              const paramKey = prompt('Parameter key (e.g. new_weight):');
                              if (!paramKey) return;
                              const label = prompt('Label:') || paramKey;
                              const value = prompt('Value:') || '0';
                              setScoringParams(prev => [...prev, { id: Date.now(), module_code: moduleCode, param_key: paramKey, label, value, editable: true }]);
                            }}>
                              <Plus className="h-3.5 w-3.5" /> Add Parameter
                            </Button>
                            <Button size="sm" style={{ backgroundColor: BRAND.primary }} className="text-white gap-1.5 text-xs" onClick={saveScoringParams}>
                              <Save className="h-3.5 w-3.5" /> Save All Params
                            </Button>
                          </div>
                        </div>
                        {formulaRows.map(m => {
                          const details: Record<string, {steps:{label:string,formula:string,note:string}[], params:{key:string,label:string,value:string,editable:boolean}[]}> = {
                            LES: { steps:[{label:'Sum Likert responses',formula:'Raw = Σ item_scores',note:'Items 1–7: MMI, Items 8–14: MCI'},{label:'Normalize 0–100',formula:'LES% = ((Raw − 7) ÷ 28) × 100',note:'Min=7, Max=35, range=28'},{label:'Split MMI / MCI',formula:'MMI% = ((MMI_raw − 7) ÷ 28) × 100',note:'Same formula per subscale'},{label:'Pattern detection',formula:'MMI>70 & MCI<50 → Aware but Passive',note:'Cross-pattern flags for learning style'}], params:[{key:'item_count',label:'Total items',value:'14',editable:false},{key:'min_raw',label:'Min raw',value:'7',editable:false},{key:'max_raw',label:'Max raw',value:'35',editable:false},{key:'mmi_items',label:'MMI items',value:'7',editable:true},{key:'mci_items',label:'MCI items',value:'7',editable:true}] },
                            ATT: { steps:[{label:'Stability Score',formula:'Stability = Hit Rate − False Alarm Rate',note:'Hit Rate = correct taps ÷ targets'},{label:'Self-report avg',formula:'SR_avg = Σ scores ÷ n',note:'Likert 1–5'},{label:'Composite ATI',formula:'ATI = (Stability × 0.6) + (SR_avg × 8)',note:'Stability 0–1, scaled ×8'},{label:'Fatigue flag',formula:'1H_acc − 2H_acc > 15% → Fatigue Detected',note:'First vs second half accuracy gap'}], params:[{key:'stability_weight',label:'Stability weight',value:'0.60',editable:true},{key:'sr_scale',label:'SR scale factor',value:'8',editable:true},{key:'fatigue_threshold',label:'Fatigue threshold',value:'15%',editable:true}] },
                            MEM: { steps:[{label:'Encoding (recall)',formula:'ENC = (Correct Recalls ÷ Targets) × 100',note:'Immediate word recall accuracy'},{label:'Recognition',formula:'REC = (TP ÷ (TP+FN)) × 100',note:'Sensitivity to target items'},{label:'Distortion resistance',formula:'DR = (1 − FalseAlarms÷Distractors) × 100',note:'Ability to reject lure items'},{label:'Composite MEM',formula:'MEM = 0.4×ENC + 0.4×REC + 0.2×DR',note:'All subscores normalized before combining'}], params:[{key:'enc_weight',label:'Encoding weight',value:'0.40',editable:true},{key:'rec_weight',label:'Recognition weight',value:'0.40',editable:true},{key:'dr_weight',label:'Distortion resist.',value:'0.20',editable:true}] },
                            CU:  { steps:[{label:'CU1 – Main Idea',formula:'CU1 = Σ option_scores (0–10)',note:'Text comprehension questions'},{label:'CU2 – Cause-Effect',formula:'CU2 = Σ option_scores (0–10)',note:'Inferential reasoning questions'},{label:'CU3 – Application',formula:'CU3 = Σ option_scores (0–10)',note:'Transfer-to-novel-context questions'},{label:'Overall CU',formula:'CU = (CU1+CU2+CU3) ÷ 3',note:'Arithmetic mean of three dimensions'}], params:[{key:'cu1_max',label:'CU1 max score',value:'10',editable:true},{key:'cu2_max',label:'CU2 max score',value:'10',editable:true},{key:'cu3_max',label:'CU3 max score',value:'10',editable:true}] },
                            STR: { steps:[{label:'Tag responses',formula:'V / R / P tag per option selected',note:'Tags defined per question in bank'},{label:'Sum tags',formula:'V_total = Σ V-tags, R_total = Σ R, P_total = Σ P',note:'Count per strategy type'},{label:'Dominant strategy',formula:'Dominant = argmax(V, R, P)',note:'Highest count; tie → Balanced'},{label:'Adaptability',formula:'Adaptability = switches on hard ÷ total_hard',note:'Strategy switches on difficulty-3+ items'}], params:[{key:'dominant_threshold',label:'Dominant threshold',value:'40%',editable:true},{key:'adaptability_min',label:'Min switches for Adaptive',value:'30%',editable:true}] },
                            EXAM:{ steps:[{label:'Domain score',formula:'Domain% = (Σ option_score ÷ max_possible) × 100',note:'Per subdomain, normalized to 100'},{label:'Overall score',formula:'Overall = weighted avg of subdomains',note:'Equal weight unless overridden'},{label:'Readiness band',formula:'<40 Needs Support | 40–55 Dev | 55–70 Appr | 70–85 On Track | 85+ Ready',note:'Applied after board/grade filter'}], params:[{key:'subdomain_weight',label:'Subdomain weighting',value:'Equal',editable:false},{key:'board_filter',label:'Board/Grade filter',value:'Yes',editable:false}] },
                          };
                          const d = details[m.code] || details['LES'];
                          return (
                            <Card key={m.code} className="overflow-hidden">
                              <div className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setExpandedModule(expandedModule === m.code ? null : m.code)}>
                                <span className="inline-flex items-center justify-center h-6 px-2 rounded text-white text-[10px] font-bold flex-shrink-0" style={{ backgroundColor: m.color }}>{m.code}</span>
                                <span className="font-medium text-sm text-gray-800 flex-1">{m.name}</span>
                                <code className="text-[10px] bg-gray-50 border border-gray-100 rounded px-2 py-0.5 font-mono text-gray-600 hidden md:inline">{m.formula}</code>
                                <span className="text-[10px] text-gray-400 hidden lg:inline mr-2">{m.weights}</span>
                                <span className="px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded text-[10px] font-medium">{m.status}</span>
                                <ChevronDown className={'h-4 w-4 text-gray-400 transition-transform ' + (expandedModule === m.code ? 'rotate-180' : '')} />
                              </div>
                              {expandedModule === m.code && (
                                <div className="border-t grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 bg-gray-50">
                                  <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Calculation Steps</p>
                                    <div className="space-y-2.5">
                                      {d.steps.map((s,si) => (
                                        <div key={si} className="flex gap-2.5">
                                          <div className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5" style={{ backgroundColor: m.color }}>{si+1}</div>
                                          <div className="flex-1">
                                            <p className="text-xs font-medium text-gray-800">{s.label}</p>
                                            <code className="text-[10px] bg-white border border-gray-200 rounded px-2 py-0.5 block mt-0.5 font-mono">{s.formula}</code>
                                            <p className="text-[10px] text-gray-500 mt-0.5">{s.note}</p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Editable Parameters</p>
                                    <div className="space-y-2">
                                      {(() => {
                                        // Use DB params if loaded, otherwise fall back to static details
                                        const dbParams = scoringParams.filter(sp => sp.module_code === m.code);
                                        const displayParams = dbParams.length > 0
                                          ? dbParams.map(sp => ({ key: sp.param_key, label: sp.label, value: sp.value, editable: sp.editable }))
                                          : d.params;
                                        return displayParams.map(p => (
                                          <div key={p.key} className="flex items-center gap-2">
                                            <div className="flex-1">
                                              <p className="text-xs font-medium text-gray-700">{p.label}</p>
                                              <p className="text-[10px] font-mono text-gray-400">{p.key}</p>
                                            </div>
                                            {p.editable ? (
                                              <input
                                                type="text"
                                                value={p.value}
                                                onChange={e => {
                                                  const newVal = e.target.value;
                                                  if (dbParams.length > 0) {
                                                    setScoringParams(prev => prev.map(sp =>
                                                      sp.module_code === m.code && sp.param_key === p.key ? { ...sp, value: newVal } : sp
                                                    ));
                                                  }
                                                }}
                                                className="w-20 border rounded px-2 py-1 text-xs text-center font-mono focus:outline-none focus:ring-1"
                                                style={{ '--tw-ring-color': m.color } as React.CSSProperties}
                                              />
                                            ) : (
                                              <span className="w-20 text-center text-xs font-mono text-gray-500 bg-gray-100 rounded px-2 py-1">{p.value}</span>
                                            )}
                                            {p.editable && (
                                              <Button variant="ghost" size="sm" className="h-6 px-1 text-red-400 hover:text-red-600"
                                                onClick={() => setScoringParams(prev => prev.filter(sp => !(sp.module_code === m.code && sp.param_key === p.key)))}>
                                                <Trash2 className="h-3 w-3" />
                                              </Button>
                                            )}
                                            {!p.editable && <span className="text-[10px] text-gray-400">fixed</span>}
                                          </div>
                                        ));
                                      })()}
                                      <div className="flex gap-2 mt-2">
                                        <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => {
                                          const key = prompt('Param key:');
                                          if (!key) return;
                                          const label = prompt('Label:') || key;
                                          const val = prompt('Value:') || '0';
                                          setScoringParams(prev => [...prev, { id: Date.now(), module_code: m.code, param_key: key, label, value: val, editable: true }]);
                                        }}>
                                          <Plus className="h-3 w-3" /> Add Param
                                        </Button>
                                        <Button size="sm" className="text-white text-xs gap-1" style={{ backgroundColor: m.color }} onClick={saveScoringParams}>
                                          <Save className="h-3 w-3" /> Save {m.code}
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Card>
                          );
                        })}
                      </div>
                    )}

                    {/* ═══════ TEST CALCULATOR ═══════ */}
                    {scoringSubTab === 'calculator' && (
                      <div className="max-w-3xl space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-gray-800">Live Score Calculator</p>
                            <p className="text-xs text-gray-500">Enter raw values — calculates exactly what the backend scoring engine returns</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">Batch Mode</span>
                            <button
                              onClick={() => { setBatchMode(m => !m); setBatchResults([]); }}
                              className={'relative h-5 w-9 rounded-full transition-colors ' + (batchMode ? 'bg-blue-600' : 'bg-gray-200')}
                            >
                              <span className={'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ' + (batchMode ? 'translate-x-4' : 'translate-x-0.5')} />
                            </button>
                          </div>
                        </div>

                        {batchMode && (
                          <Card className="border-blue-200 bg-blue-50/30">
                            <CardContent className="pt-4 pb-4 space-y-3">
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="text-xs font-semibold text-gray-800">Batch Test Runner</p>
                                  <p className="text-[10px] text-gray-500 mt-0.5">Paste CSV rows: <code className="bg-white border rounded px-1 font-mono text-[10px]">module,raw,mmi_raw,mci_raw</code> — one per line</p>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-[10px] h-6 px-2"
                                  onClick={() => {
                                    const blob = new Blob(['module,raw,mmi_raw,mci_raw\nles,28,26,30\nles,32,31,33\natt,0.78,4.2,72,68\nmem,70,65,80'], { type: 'text/csv' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href=url; a.download='batch-template.csv'; a.click();
                                    URL.revokeObjectURL(url);
                                  }}
                                >
                                  <Download className="h-3 w-3 mr-1" />Template
                                </Button>
                              </div>
                              <textarea
                                value={batchCsv}
                                onChange={e => setBatchCsv(e.target.value)}
                                rows={4}
                                placeholder={'les,28,26,30\nles,32,31,33\natt,0.78,4.2,72,68'}
                                className="w-full border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white resize-none"
                              />
                              <Button
                                size="sm"
                                style={{ backgroundColor: BRAND.primary }}
                                className="text-white text-xs gap-1.5"
                                onClick={() => {
                                  const rows = batchCsv.trim().split('\n').filter(l => l.trim() && !l.startsWith('module'));
                                  const results = rows.map((line, i) => {
                                    const parts = line.split(',').map(s => s.trim());
                                    const mod = parts[0].toLowerCase();
                                    const g = (idx:number) => parseFloat(parts[idx]||'0');
                                    let composite = 0;
                                    if (mod==='les') composite = Math.round(((g(1)-7)/28)*100);
                                    else if (mod==='att') composite = Math.round(Math.min(100, g(1)*60 + g(2)*8));
                                    else if (mod==='mem') composite = Math.round(0.4*g(1) + 0.4*g(2) + 0.2*g(3));
                                    else if (mod==='cu') composite = Math.round((g(1)+g(2)+g(3))/3*10);
                                    const bandData = normRows[0];
                                    const tier = composite>=bandData.p80?'Above P80':composite>=bandData.p60?'P60–P80':composite>=bandData.p40?'P40–P60':composite>=bandData.p20?'P20–P40':'Below P20';
                                    return { row:i+1, inputs:parts.slice(1).join(', '), composite: String(composite), tier };
                                  });
                                  setBatchResults(results);
                                }}
                              >
                                Run Batch ({batchCsv.trim().split('\n').filter(l=>l.trim()&&!l.startsWith('module')).length} rows)
                              </Button>
                              {batchResults.length > 0 && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-semibold text-gray-700 uppercase tracking-wider">Batch Results — {batchResults.length} rows</p>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-[10px] h-6 px-2 gap-1"
                                      onClick={() => {
                                        const csv = 'Row,Inputs,Composite,Tier\n' + batchResults.map(r => `${r.row},"${r.inputs}",${r.composite},"${r.tier}"`).join('\n');
                                        const blob = new Blob([csv], {type:'text/csv'});
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a'); a.href=url; a.download='batch-results.csv'; a.click();
                                        URL.revokeObjectURL(url);
                                      }}
                                    >
                                      <Download className="h-3 w-3" /> Export
                                    </Button>
                                  </div>
                                  <div className="border rounded-lg overflow-hidden bg-white">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="border-b bg-gray-50">
                                          {['Row','Inputs','Composite','Normative Tier'].map(h => (
                                            <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">{h}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100">
                                        {batchResults.map(r => (
                                          <tr key={r.row} className="hover:bg-gray-50">
                                            <td className="px-3 py-1.5 font-mono text-gray-400 text-[10px]">{String(r.row).padStart(2,'0')}</td>
                                            <td className="px-3 py-1.5 font-mono text-gray-600 text-[10px]">{r.inputs}</td>
                                            <td className="px-3 py-1.5 font-bold text-gray-800">{r.composite}</td>
                                            <td className="px-3 py-1.5">
                                              <span className={'text-[10px] px-1.5 py-0.5 rounded font-medium ' + (r.tier==='Above P80'?'bg-green-50 text-green-700':r.tier==='P60–P80'?'bg-lime-50 text-lime-700':r.tier==='P40–P60'?'bg-yellow-50 text-yellow-700':r.tier==='P20–P40'?'bg-orange-50 text-orange-700':'bg-red-50 text-red-700')}>{r.tier}</span>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )}

                        {!batchMode && <><div className="flex flex-wrap gap-1.5">
                          {[{id:'les',label:'LES'},{id:'att',label:'ATT'},{id:'mem',label:'MEM'},{id:'cu',label:'CU'}].map(m => (
                            <button key={m.id} onClick={() => { setCalcModule(m.id); setCalcInputs({}); setCalcResult(null); }} className={'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ' + (calcModule===m.id ? 'text-white border-transparent' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400')} style={calcModule===m.id ? { backgroundColor: BRAND.primary } : {}}>
                              {m.label}
                            </button>
                          ))}
                        </div>
                        <Card>
                          <CardContent className="pt-4 pb-4">
                            {(() => {
                              const inputSets: Record<string, {key:string,label:string,min:number,max:number,step?:number}[]> = {
                                les: [{key:'raw',label:'Raw Total Score (7–35)',min:7,max:35},{key:'mmi_raw',label:'MMI Subscore (7–35)',min:7,max:35},{key:'mci_raw',label:'MCI Subscore (7–35)',min:7,max:35}],
                                att: [{key:'stability',label:'Stability Score (0–1)',min:0,max:1,step:0.01},{key:'sr_avg',label:'Self-Report Avg (1–5)',min:1,max:5,step:0.1},{key:'h1_acc',label:'1st Half Accuracy %',min:0,max:100},{key:'h2_acc',label:'2nd Half Accuracy %',min:0,max:100}],
                                mem: [{key:'enc',label:'Encoding Score (0–100)',min:0,max:100},{key:'rec',label:'Recognition Score (0–100)',min:0,max:100},{key:'dr',label:'Distortion Resistance (0–100)',min:0,max:100}],
                                cu:  [{key:'cu1',label:'CU1 – Main Idea (0–10)',min:0,max:10,step:0.5},{key:'cu2',label:'CU2 – Cause-Effect (0–10)',min:0,max:10,step:0.5},{key:'cu3',label:'CU3 – Application (0–10)',min:0,max:10,step:0.5}],
                              };
                              const inputs = inputSets[calcModule] || inputSets.les;
                              return (
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                  {inputs.map(inp => (
                                    <div key={inp.key}>
                                      <label className="block text-[10px] font-medium text-gray-600 mb-1">{inp.label}</label>
                                      <input type="number" min={inp.min} max={inp.max} step={inp.step||1} value={calcInputs[inp.key]||''} onChange={e => setCalcInputs(p => ({...p, [inp.key]: e.target.value}))} placeholder={inp.min+'–'+inp.max} className="w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                            <Button size="sm" onClick={() => {
                              const g = (k: string) => parseFloat(calcInputs[k]||'0');
                              let result: Record<string,string> = {};
                              if (calcModule==='les') {
                                const les=((g('raw')-7)/28)*100, mmi=((g('mmi_raw')-7)/28)*100, mci=((g('mci_raw')-7)/28)*100;
                                result={'LES%':les.toFixed(1),'MMI%':mmi.toFixed(1),'MCI%':mci.toFixed(1),'Pattern':mmi>70&&mci<50?'Aware but Passive':mmi>60&&mci>60?'Balanced Self-Regulated':mmi<50&&mci>60?'Regulated w/o Awareness':'Developing','Band':les<40?'Developing':les<60?'Emerging':les<75?'Proficient':les<90?'Advanced':'Exceptional'};
                              } else if (calcModule==='att') {
                                const ati=g('stability')*0.6+g('sr_avg')*8;
                                result={'ATI Score':ati.toFixed(2),'Band':ati<30?'Very Low':ati<50?'Low':ati<65?'Moderate':ati<80?'High':'Very High','Fatigue':(g('h1_acc')-g('h2_acc'))>15?'Detected':'No','Stability (60%)':(g('stability')*0.6).toFixed(3),'SR (40%)':(g('sr_avg')*8).toFixed(2)};
                              } else if (calcModule==='mem') {
                                const mem=0.4*g('enc')+0.4*g('rec')+0.2*g('dr');
                                result={'MEM%':mem.toFixed(1),'Band':mem<40?'Weak':mem<55?'Developing':mem<70?'Functional':mem<85?'Strong':'Exceptional','Encoding (40%)':(0.4*g('enc')).toFixed(1),'Recognition (40%)':(0.4*g('rec')).toFixed(1),'Distortion (20%)':(0.2*g('dr')).toFixed(1),'Flag':g('rec')>80&&g('dr')<40?'Confusion Risk':g('enc')<40&&g('rec')<40?'Consolidation Gap':'None'};
                              } else if (calcModule==='cu') {
                                const cu=(g('cu1')+g('cu2')+g('cu3'))/3;
                                result={'CU Score':cu.toFixed(2),'CU1':g('cu1').toFixed(1),'CU2':g('cu2').toFixed(1),'CU3':g('cu3').toFixed(1),'Band':cu<4?'Below Basic':cu<6?'Basic':cu<7.5?'Developing':cu<9?'Proficient':'Advanced'};
                              }
                              setCalcResult(result);
                            }} style={{ backgroundColor: BRAND.primary }} className="text-white gap-1.5 text-xs">
                              <Calculator className="h-3.5 w-3.5" /> Calculate
                            </Button>
                          </CardContent>
                        </Card>
                        {calcResult && (
                          <Card className="border-green-200 bg-green-50">
                            <CardHeader className="pb-1 pt-3">
                              <CardTitle className="text-xs text-green-800 flex items-center gap-1.5">
                                <CheckCircle className="h-3.5 w-3.5" /> Result — {calcModule.toUpperCase()}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="pb-3">
                              <div className="grid grid-cols-3 gap-2">
                                {Object.entries(calcResult).map(([k,v]) => (
                                  <div key={k} className="bg-white rounded border border-green-200 px-2.5 py-1.5">
                                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{k}</p>
                                    <p className="text-xs font-bold text-gray-900 mt-0.5">{String(v)}</p>
                                  </div>
                                ))}
                              </div>
                              {/* Normative Percentile Lookup */}
                              {typeof calcResult['Composite'] === 'number' && (() => {
                                const score = calcResult['Composite'] as number;
                                const band = normRows.find(r => {
                                  if (score >= r.p80) return false;
                                  return true;
                                });
                                const tier =
                                  score >= (normRows[0]?.p80 ?? 999) ? { label: 'Above P80', color: 'bg-green-100 text-green-800 border-green-300', pct: '>80th' } :
                                  score >= (normRows[0]?.p60 ?? 999) ? { label: 'P60–P80',   color: 'bg-lime-100 text-lime-800 border-lime-300',   pct: '60–80th' } :
                                  score >= (normRows[0]?.p40 ?? 999) ? { label: 'P40–P60',   color: 'bg-yellow-100 text-yellow-800 border-yellow-300', pct: '40–60th' } :
                                  score >= (normRows[0]?.p20 ?? 999) ? { label: 'P20–P40',   color: 'bg-orange-100 text-orange-800 border-orange-300', pct: '20–40th' } :
                                                                        { label: 'Below P20',  color: 'bg-red-100 text-red-800 border-red-300',     pct: '<20th' };
                                return (
                                  <div className="mt-3 flex items-center gap-3 pt-3 border-t border-green-200">
                                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Normative Band</span>
                                    <span className={'text-xs font-bold px-2.5 py-1 rounded-full border ' + tier.color}>{tier.label}</span>
                                    <span className="text-[10px] text-gray-500">Approx. {tier.pct} percentile rank (based on Band {normRows[0]?.band ?? '—'} cutoffs)</span>
                                    <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2 ml-auto" onClick={() => setScoringSubTab('agebands')}>View Full Norms →</Button>
                                  </div>
                                );
                              })()}
                            </CardContent>
                          </Card>
                        )}</>}
                      </div>
                    )}

                    {/* ═══════ AUDIT & HISTORY ═══════ */}
                    {scoringSubTab === 'audit' && (
                      <div className="space-y-4">
                        {/* Header row */}
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-gray-800">Audit Log &amp; Version History</p>
                            <p className="text-xs text-gray-500">Full change trail for all scoring engine modifications, with rollback support</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <select
                              value={auditFilter}
                              onChange={e => setAuditFilter(e.target.value)}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
                            >
                              {['All Types','Formula','Norm','Domain','Config','Publish'].map(f => (
                                <option key={f}>{f}</option>
                              ))}
                            </select>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7 gap-1.5"
                              onClick={() => {
                                const header = 'Timestamp,User,Action,Module,Details,Type\n';
                                const rows = auditLog.map(e => `"${e.timestamp}","${e.user}","${e.action}","${e.module}","${e.details}","${e.type}"`).join('\n');
                                const blob = new Blob([header + rows], { type: 'text/csv' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url; a.download = 'audit-log.csv'; a.click();
                                URL.revokeObjectURL(url);
                              }}
                            >
                              <Download className="h-3 w-3" /> Export Log
                            </Button>
                          </div>
                        </div>

                        {/* Two-column layout: change log (left) + version history (right) */}
                        <div className="grid grid-cols-5 gap-4">

                          {/* ── Change Log ────────────────── */}
                          <div className="col-span-3 space-y-2">
                            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Change Log</p>
                            <Card>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b bg-gray-50">
                                      {['Timestamp','User','Action','Module','Details'].map(h => (
                                        <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {auditLog
                                      .filter(e => auditFilter === 'All Types' || e.type === auditFilter)
                                      .map((e, i) => (
                                      <tr key={i} className="hover:bg-gray-50">
                                        <td className="px-3 py-2 text-[10px] text-gray-400 whitespace-nowrap font-mono">{e.timestamp}</td>
                                        <td className="px-3 py-2 text-[10px] font-medium text-gray-700 whitespace-nowrap">{e.user}</td>
                                        <td className="px-3 py-2">
                                          <span className={'text-[10px] px-1.5 py-0.5 rounded font-medium ' + (
                                            e.action === 'Published'   ? 'bg-green-50 text-green-700' :
                                            e.action === 'Reverted'   ? 'bg-amber-50 text-amber-700' :
                                            e.action === 'Deleted'    ? 'bg-red-50 text-red-700' :
                                                                         'bg-blue-50 text-blue-700'
                                          )}>{e.action}</span>
                                        </td>
                                        <td className="px-3 py-2 text-[10px] font-mono text-gray-600">{e.module}</td>
                                        <td className="px-3 py-2 text-[10px] text-gray-500">{e.details}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </Card>
                            {/* Activity summary */}
                            <div className="grid grid-cols-4 gap-2">
                              {[
                                { label: 'Total Changes', value: auditLog.length, color: 'text-gray-800' },
                                { label: 'Published', value: auditLog.filter(e => e.action === 'Published').length, color: 'text-green-700' },
                                { label: 'Reverted', value: auditLog.filter(e => e.action === 'Reverted').length, color: 'text-amber-700' },
                                { label: 'Last Actor', value: auditLog[0]?.user ?? '—', color: 'text-blue-700' },
                              ].map(s => (
                                <Card key={s.label}>
                                  <CardContent className="pt-2.5 pb-2.5 px-3">
                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">{s.label}</p>
                                    <p className={'text-sm font-bold mt-0.5 ' + s.color}>{s.value}</p>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </div>

                          {/* ── Version History ───────────── */}
                          <div className="col-span-2 space-y-2">
                            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Version History</p>
                            <div className="space-y-2">
                              {versionHistory.map((v, i) => (
                                <Card key={v.version} className={'border ' + (i === 0 ? 'border-blue-200 bg-blue-50/30' : '')}>
                                  <CardContent className="pt-3 pb-3 px-4">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-bold text-gray-800 font-mono">{v.version}</span>
                                          {i === 0 && <span className="text-[10px] px-1.5 py-0.5 bg-blue-600 text-white rounded-full font-medium">Current</span>}
                                          {v.status === 'Live' && <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 border border-green-200 rounded-full font-medium">Live</span>}
                                          {v.status === 'Draft' && <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 border border-gray-200 rounded-full font-medium">Draft</span>}
                                        </div>
                                        <p className="text-[10px] text-gray-500 mt-1 font-mono">{v.date}</p>
                                        <p className="text-xs text-gray-700 mt-1 leading-relaxed">{v.summary}</p>
                                        <p className="text-[10px] text-gray-400 mt-0.5">by {v.author}</p>
                                      </div>
                                      <div className="flex flex-col gap-1 flex-shrink-0">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className={'text-[10px] h-6 px-2 ' + (diffExpanded===v.version ? 'text-blue-700 bg-blue-50' : 'text-gray-500')}
                                          onClick={() => setDiffExpanded(d => d===v.version ? null : v.version)}
                                        >
                                          {diffExpanded===v.version ? '▲ Hide' : '▼ Diff'}
                                        </Button>
                                        {i > 0 && (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-[10px] h-6 px-2 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700"
                                            onClick={() => {
                                              const entry = {
                                                timestamp: new Date().toISOString().replace('T',' ').substring(0,19),
                                                user: 'superadmin@metryxone.com',
                                                action: 'Reverted',
                                                module: 'ENGINE',
                                                details: `Restored to ${v.version}: ${v.summary}`,
                                                type: 'Config'
                                              };
                                              setAuditLog(prev => [entry, ...prev]);
                                            }}
                                          >
                                            Restore
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                    {/* Diff Viewer */}
                                    {diffExpanded === v.version && (() => {
                                      const diffs: {field:string,from:string,to:string,type:string}[] = [
                                        { field:'Band C — P60', from: i===0?'62':'58', to: i===0?'65':'62', type:'Norm' },
                                        { field:'Band E2 — P80', from: i===0?'84':'82', to: i===0?'86':'84', type:'Norm' },
                                        { field:'ATT stability_weight', from: i===0?'0.55':'0.50', to: i===0?'0.60':'0.55', type:'Formula' },
                                        ...(i===1 ? [{ field:'MEM enc_weight', from:'0.45', to:'0.40', type:'Formula' }, { field:'Domain: Exam Preparedness weight', from:'35%', to:'40%', type:'Domain' }] : []),
                                      ];
                                      return (
                                        <div className="mt-2 pt-2 border-t border-dashed border-gray-200">
                                          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Field-Level Changes</p>
                                          <div className="space-y-1">
                                            {diffs.map((d,di) => (
                                              <div key={di} className="flex items-center gap-2 text-[10px]">
                                                <span className={'px-1.5 py-0.5 rounded font-medium ' + (d.type==='Norm'?'bg-blue-50 text-blue-600':d.type==='Formula'?'bg-purple-50 text-purple-600':'bg-green-50 text-green-600')}>{d.type}</span>
                                                <span className="text-gray-600 font-mono">{d.field}</span>
                                                <span className="text-red-500 font-mono line-through">{d.from}</span>
                                                <span className="text-gray-400">→</span>
                                                <span className="text-green-600 font-mono font-semibold">{d.to}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                            {/* Diff hint */}
                            <div className="text-[10px] text-gray-400 px-1">
                              Restore creates a new draft version with the historical configuration applied. Existing live data is not affected until re-published.
                            </div>
                          </div>
                        </div>

                        {/* ── Alert Rules ────────────────────────────────────────── */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Alert Rules</p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7 gap-1.5"
                              onClick={() => setAlertRules(prev => [...prev, { id: Date.now(), metric: 'Drift %', condition: '>', threshold: 5, module: 'All', enabled: true, notify: 'superadmin@metryxone.com' }])}
                            >
                              <Plus className="h-3 w-3" /> Add Rule
                            </Button>
                          </div>
                          <Card>
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b bg-gray-50">
                                    {['On/Off','Metric','Condition','Threshold','Module','Notify',''].map(h => (
                                      <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {alertRules.map(rule => (
                                    <tr key={rule.id} className="hover:bg-gray-50">
                                      <td className="px-3 py-2">
                                        <button
                                          onClick={() => setAlertRules(p => p.map(r => r.id===rule.id ? {...r, enabled: !r.enabled} : r))}
                                          className={'relative h-4 w-8 rounded-full transition-colors flex-shrink-0 ' + (rule.enabled ? 'bg-green-500' : 'bg-gray-200')}
                                        >
                                          <span className={'absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ' + (rule.enabled ? 'translate-x-4' : 'translate-x-0.5')} />
                                        </button>
                                      </td>
                                      <td className="px-3 py-2">
                                        <select
                                          value={rule.metric}
                                          onChange={e => setAlertRules(p => p.map(r => r.id===rule.id ? {...r, metric: e.target.value} : r))}
                                          className="border border-gray-200 rounded px-1.5 py-0.5 text-[10px] bg-white focus:outline-none"
                                        >
                                          {['Drift %','Linked Drop','Norm Age','Error Count'].map(m => <option key={m}>{m}</option>)}
                                        </select>
                                      </td>
                                      <td className="px-3 py-2">
                                        <select
                                          value={rule.condition}
                                          onChange={e => setAlertRules(p => p.map(r => r.id===rule.id ? {...r, condition: e.target.value} : r))}
                                          className="border border-gray-200 rounded px-1.5 py-0.5 text-[10px] bg-white focus:outline-none w-12"
                                        >
                                          {['>','<','>=','<=','=='].map(c => <option key={c}>{c}</option>)}
                                        </select>
                                      </td>
                                      <td className="px-3 py-2">
                                        <input
                                          type="number"
                                          value={rule.threshold}
                                          onChange={e => setAlertRules(p => p.map(r => r.id===rule.id ? {...r, threshold: Number(e.target.value)} : r))}
                                          className="w-14 border border-gray-200 rounded px-1.5 py-0.5 text-[10px] font-mono text-center focus:outline-none focus:ring-1 focus:ring-blue-400"
                                        />
                                      </td>
                                      <td className="px-3 py-2">
                                        <select
                                          value={rule.module}
                                          onChange={e => setAlertRules(p => p.map(r => r.id===rule.id ? {...r, module: e.target.value} : r))}
                                          className="border border-gray-200 rounded px-1.5 py-0.5 text-[10px] bg-white focus:outline-none"
                                        >
                                          {['All','LES','ATT','MEM','CU','STR','EXAM'].map(m => <option key={m}>{m}</option>)}
                                        </select>
                                      </td>
                                      <td className="px-3 py-2">
                                        <input
                                          type="text"
                                          value={rule.notify}
                                          onChange={e => setAlertRules(p => p.map(r => r.id===rule.id ? {...r, notify: e.target.value} : r))}
                                          className="w-48 border border-gray-200 rounded px-1.5 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-blue-400"
                                        />
                                      </td>
                                      <td className="px-3 py-2">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-5 w-5 p-0 text-red-400 hover:text-red-600"
                                          onClick={() => setAlertRules(p => p.filter(r => r.id !== rule.id))}
                                        >
                                          <XCircle className="h-3.5 w-3.5" />
                                        </Button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </Card>
                          <p className="text-[10px] text-gray-400 px-1">Alerts are evaluated after each publish event and sent to the configured notify address. Disabled rules are saved but not evaluated.</p>
                        </div>

                      </div>
                    )}

                  </div>

                  {/* ══════════════════════════════════════════════════
                      PUBLISH MODAL
                  ══════════════════════════════════════════════════ */}
                  {publishModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) { setPublishModalOpen(false); setPublishStatus('idle'); } }}>
                      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">

                        {/* Modal Header — stepper */}
                        <div className="border-b px-6 py-4">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-gray-900">Publish Norms &amp; Scoring Configuration</h3>
                            <button onClick={() => { setPublishModalOpen(false); setPublishStatus('idle'); }} className="h-7 w-7 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          {/* Stepper */}
                          <div className="flex items-center gap-0 text-xs">
                            {[
                              { n: 1, label: 'Norms Config',   done: true  },
                              { n: 2, label: 'Domain Mapping', done: true  },
                              { n: 3, label: 'Formula Review', done: true  },
                              { n: 4, label: 'Publish',        done: false },
                            ].map((s, si, arr) => (
                              <div key={s.n} className="flex items-center">
                                <div className="flex items-center gap-1.5">
                                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${s.done ? 'text-white' : 'text-white'}`}
                                    style={{ backgroundColor: s.done ? '#10B981' : BRAND.primary }}>
                                    {s.done ? <CheckCircle className="h-4 w-4" /> : s.n}
                                  </div>
                                  <span className={`font-medium ${s.done ? 'text-green-700' : 'text-gray-900'}`}>{s.label}</span>
                                </div>
                                {si < arr.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-gray-300 mx-2" />}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Modal Body */}
                        <div className="px-6 py-4 max-h-96 overflow-y-auto space-y-4">

                          {/* Configuration Summary */}
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Configuration Summary</p>
                            <div className="border rounded-xl overflow-hidden">
                              <table className="w-full text-xs">
                                <tbody className="divide-y divide-gray-100">
                                  {[
                                    ['Scoring modules active', '6 of 6 (LES · ATT · MEM · CU · STR · EXAM)'],
                                    ['Age bands configured',   normRows.length + ' bands (A through E3)'],
                                    ['Norm table version',     'Jan 2025 calibration'],
                                    ['Domains mapped',         domainRows.filter(r=>r.status==='Active').length + ' active / ' + domainRows.filter(r=>r.status==='Draft').length + ' draft'],
                                    ['Configurable parameters', '24 formula weights & thresholds'],
                                    ['Age band spread (P20–P80)', normRows[0]?.p20 + '–' + normRows[normRows.length-1]?.p80 + ' across cohorts'],
                                    ['Domain weight total', domainRows.reduce((s,r)=>s+r.weight,0) + '% ' + (domainRows.reduce((s,r)=>s+r.weight,0)===100 ? '— Balanced' : '— Adjust to reach 100%')],
                                    ['Scoring engine target', 'Backend API → /api/scoring/*'],
                                  ].map(([k, v]) => (
                                    <tr key={k} className="hover:bg-gray-50">
                                      <td className="px-4 py-2 text-gray-500 w-1/2">{k}</td>
                                      <td className="px-4 py-2 font-medium text-gray-800">{v}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Publication Status */}
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Publication Status</p>
                            <div className="grid grid-cols-2 gap-3">
                              {/* Save as Draft */}
                              <div
                                onClick={() => setPublishChoice('draft')}
                                className={'border-2 rounded-xl p-4 cursor-pointer transition-all ' + (publishChoice === 'draft' ? 'border-gray-400 bg-gray-50' : 'border-gray-200 bg-white hover:border-gray-300')}
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <div className={'h-4 w-4 rounded-full border-2 flex items-center justify-center ' + (publishChoice === 'draft' ? 'border-gray-500' : 'border-gray-300')}>
                                    {publishChoice === 'draft' && <div className="h-2 w-2 rounded-full bg-gray-500" />}
                                  </div>
                                  <span className="font-semibold text-sm text-gray-800">Save as Draft</span>
                                  <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">Draft</span>
                                </div>
                                <p className="text-xs text-gray-500">Configuration is saved privately. Not applied to live scoring. You can continue editing before publishing.</p>
                              </div>

                              {/* Publish to Scoring Engine */}
                              <div
                                onClick={() => setPublishChoice('live')}
                                className={'border-2 rounded-xl p-4 cursor-pointer transition-all ' + (publishChoice === 'live' ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white hover:border-green-300')}
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <div className={'h-4 w-4 rounded-full border-2 flex items-center justify-center ' + (publishChoice === 'live' ? 'border-green-500' : 'border-gray-300')}>
                                    {publishChoice === 'live' && <div className="h-2 w-2 rounded-full bg-green-500" />}
                                  </div>
                                  <span className="font-semibold text-sm text-gray-800">Publish to Scoring Engine</span>
                                  <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold flex items-center gap-1">
                                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
                                    Live
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500">Configuration goes live immediately. Norms, formulas and domain mappings are applied to all new assessments. Link modules from Pricing &amp; Packages → Configure.</p>
                              </div>
                            </div>
                          </div>

                          {/* Success state */}
                          {publishStatus === 'done' && (
                            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                              <div>
                                <p className="text-sm font-semibold text-green-800">
                                  {publishChoice === 'live' ? 'Published to Scoring Engine' : 'Saved as Draft'}
                                </p>
                                <p className="text-xs text-green-600 mt-0.5">
                                  {publishChoice === 'live'
                                    ? 'All norms, formulas and domain mappings are now live and will be applied to new assessments.'
                                    : 'Configuration saved. Return to publish when ready.'}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Modal Footer */}
                        <div className="border-t px-6 py-4 flex items-center justify-between bg-gray-50">
                          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setPublishModalOpen(false); setPublishStatus('idle'); }}>
                            <ChevronLeft className="h-3.5 w-3.5" /> Back
                          </Button>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => { setPublishModalOpen(false); setPublishStatus('idle'); }}>
                              Cancel
                            </Button>
                            {publishStatus === 'done' ? (
                              <Button size="sm" className="gap-1.5 text-white" style={{ backgroundColor: '#10B981' }} onClick={() => { setPublishModalOpen(false); setPublishStatus('idle'); }}>
                                <CheckCircle className="h-3.5 w-3.5" /> Done
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                className="gap-1.5 text-white"
                                style={{ backgroundColor: publishChoice === 'live' ? BRAND.primary : '#6B7280' }}
                                disabled={publishStatus === 'publishing'}
                                onClick={async () => {
                                  setPublishStatus('publishing');
                                  try {
                                    const ver = `v${new Date().toISOString().slice(0,10).replace(/-/g,'.')}`;
                                    await publishScoringConfig(ver, publishChoice === 'live' ? 'Published to live' : 'Saved as draft');
                                    setPublishStatus('done');
                                  } catch {
                                    setPublishStatus('idle');
                                  }
                                }}
                              >
                                {publishStatus === 'publishing' ? (
                                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Publishing…</>
                                ) : publishChoice === 'live' ? (
                                  <><Upload className="h-3.5 w-3.5" /> Update &amp; Publish</>
                                ) : (
                                  <><Save className="h-3.5 w-3.5" /> Save as Draft</>
                                )}
                              </Button>
                            )}
                          </div>
                        </div>

                      </div>
                    </div>
                  )}

                  {/* ══════════════════════════════════════════════════
                      IMPORT VALIDATION PREVIEW MODAL
                  ══════════════════════════════════════════════════ */}
                  {importPreviewOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setImportPreviewOpen(false); }}>
                      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 overflow-hidden">
                        <div className="border-b px-6 py-4 flex items-center justify-between">
                          <div>
                            <h3 className="text-base font-bold text-gray-900">Import Validation Preview</h3>
                            <p className="text-xs text-gray-500 mt-0.5">Review and confirm before applying — invalid rows are highlighted and must be corrected in your CSV</p>
                          </div>
                          <button onClick={() => setImportPreviewOpen(false)} className="h-7 w-7 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100">
                            <X className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Summary Bar */}
                        <div className="px-6 py-3 border-b bg-gray-50 flex items-center gap-6 text-xs">
                          <span className="flex items-center gap-1.5 text-gray-600"><span className="font-semibold">{importPreviewData.length}</span> rows detected</span>
                          <span className="flex items-center gap-1.5 text-green-700"><CheckCircle className="h-3.5 w-3.5" /><span className="font-semibold">{importPreviewData.filter(r=>r.valid).length}</span> valid</span>
                          <span className="flex items-center gap-1.5 text-red-600"><AlertTriangle className="h-3.5 w-3.5" /><span className="font-semibold">{importPreviewData.filter(r=>!r.valid).length}</span> invalid</span>
                          {importPreviewData.some(r=>!r.valid) && (
                            <span className="ml-auto text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-0.5 font-medium">Fix invalid rows before applying</span>
                          )}
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto max-h-80 overflow-y-auto">
                          <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-gray-50 border-b z-10">
                              <tr>
                                {['Status','Band','P20','P40','P60','P80','N','Validation'].map(h => (
                                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {importPreviewData.map((r, i) => (
                                <tr key={i} className={r.valid ? 'hover:bg-gray-50' : 'bg-red-50/40 hover:bg-red-50/60'}>
                                  <td className="px-3 py-2">
                                    {r.valid
                                      ? <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                                      : <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                                  </td>
                                  <td className="px-3 py-2 font-bold font-mono text-gray-800">{r.band}</td>
                                  {[r.p20,r.p40,r.p60,r.p80].map((v,j) => (
                                    <td key={j} className="px-3 py-2 font-mono text-center text-gray-700">{v}</td>
                                  ))}
                                  <td className="px-3 py-2 font-mono text-center text-gray-500">{r.n || '—'}</td>
                                  <td className="px-3 py-2 text-[10px]">
                                    {r.valid
                                      ? <span className="text-green-600 font-medium">All checks passed</span>
                                      : <span className="text-red-600">{r.error}</span>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Footer Actions */}
                        <div className="px-6 py-4 border-t flex items-center justify-between">
                          <Button variant="outline" onClick={() => setImportPreviewOpen(false)}>Cancel</Button>
                          <div className="flex items-center gap-2">
                            {importPreviewData.some(r=>!r.valid) && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50"
                                onClick={() => {
                                  const validOnly = importPreviewData.filter(r=>r.valid);
                                  setNormRows(validOnly.map(r => ({ band:r.band, grades:'', ages:'', p20:r.p20, p40:r.p40, p60:r.p60, p80:r.p80, n:r.n, se:r.se })));
                                  setImportPreviewOpen(false);
                                }}
                              >
                                Apply Valid Rows Only ({importPreviewData.filter(r=>r.valid).length})
                              </Button>
                            )}
                            <Button
                              disabled={importPreviewData.some(r=>!r.valid)}
                              style={importPreviewData.every(r=>r.valid) ? { backgroundColor: BRAND.primary } : {}}
                              className={importPreviewData.every(r=>r.valid) ? 'text-white text-xs' : 'text-xs'}
                              onClick={() => {
                                setNormRows(importPreviewData.map(r => ({ band:r.band, grades:'', ages:'', p20:r.p20, p40:r.p40, p60:r.p60, p80:r.p80, n:r.n, se:r.se })));
                                setImportPreviewOpen(false);
                                const entry = {
                                  timestamp: new Date().toISOString().replace('T',' ').substring(0,19),
                                  user: 'superadmin@metryxone.com', action: 'Imported', module: 'Age Bands',
                                  details: `${importPreviewData.length} bands imported via CSV`, type: 'Norm'
                                };
                                setAuditLog(prev => [entry, ...prev]);
                              }}
                            >
                              Apply All ({importPreviewData.length})
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
  );
}
