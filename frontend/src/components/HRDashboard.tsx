import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HRBehavioralHiring } from './HRBehavioralHiring';
import { AppTopBar } from './AppTopBar';
import { QuickTour } from './QuickTour';
import { shouldShowTour } from '@/lib/tourUtils';
import { GlobalSearch } from './GlobalSearch';
import { 
  Briefcase, Users, FileText, AlertTriangle, DollarSign, Building2, 
  Plus, Eye, Edit, Send, CheckCircle, XCircle, Clock, Search,
  TrendingUp, TrendingDown, UserCheck, UserX, Shield, BarChart3,
  ChevronRight, Filter, RefreshCw, ArrowLeft, Play
} from 'lucide-react';

const brand = {
  primary: '#0B3C5D',
  accent: '#4ECDC4',
  warning: '#F59E0B',
  danger: '#DC2626'
};

interface HRDashboardProps {
  onNavigate: (screen: string) => void;
}

interface DashboardStats {
  totalJobs: number;
  publishedJobs: number;
  pendingApprovals: number;
  totalApplications: number;
  activeMentors: number;
  mentorsAtRisk: number;
  pendingViolations: number;
  pendingPayouts: number;
}

interface Job {
  id: string;
  title: string;
  roleCategory: string;
  employmentType: string;
  workMode: string;
  status: string;
  createdAt: string;
  hiringQuota: number;
  hiredCount: number;
}

interface Application {
  id: string;
  fullName: string;
  email: string;
  status: string;
  createdAt: string;
  jobId: string;
}

interface Mentor {
  id: string;
  mentorCode: string;
  fullName: string;
  status: string;
  performanceHealthIndex: number;
  createdAt: string;
}

const JOB_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  hr_review: 'bg-yellow-100 text-yellow-700',
  legal_review: 'bg-orange-100 text-orange-700',
  leadership_approval: 'bg-purple-100 text-purple-700',
  approved: 'bg-blue-100 text-blue-700',
  published: 'bg-teal-100 text-teal-700',
  closed: 'bg-red-100 text-red-700'
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  hr_review: 'HR Review',
  legal_review: 'Legal Review',
  leadership_approval: 'Leadership',
  approved: 'Approved',
  published: 'Published',
  closed: 'Closed'
};

const MENTOR_STATUS_COLORS: Record<string, string> = {
  pending_training: 'bg-gray-100 text-gray-700',
  training: 'bg-blue-100 text-blue-700',
  assessment: 'bg-purple-100 text-purple-700',
  active: 'bg-teal-100 text-teal-700',
  warning: 'bg-yellow-100 text-yellow-700',
  suspended: 'bg-orange-100 text-orange-700',
  deactivated: 'bg-red-100 text-red-700'
};

export function HRDashboard({ onNavigate }: HRDashboardProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showJobModal, setShowJobModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobFilter, setJobFilter] = useState('all');

  const { data: stats, isLoading: statsLoading, isError: statsError } = useQuery<DashboardStats>({
    queryKey: ['/api/hr/dashboard/stats'],
  });

  useEffect(() => {
    if (!statsLoading && shouldShowTour('hr')) setShowTour(true);
  }, [statsLoading]);

  const { data: jobs = [], isLoading: jobsLoading, isError: jobsError } = useQuery<Job[]>({
    queryKey: ['/api/hr/jobs'],
  });

  const { data: mentorsAtRisk = [] } = useQuery<Mentor[]>({
    queryKey: ['/api/hr/mentors/at-risk'],
  });

  const createJobMutation = useMutation({
    mutationFn: async (jobData: any) => {
      const response = await fetch('/api/hr/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(jobData)
      });
      if (!response.ok) throw new Error('Failed to create job');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/hr/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/hr/dashboard/stats'] });
      setShowJobModal(false);
    }
  });

  const submitForReviewMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await fetch(`/api/hr/jobs/${jobId}/submit`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to submit for review');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/hr/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/hr/dashboard/stats'] });
    }
  });

  const filteredJobs = jobs.filter(job => {
    if (jobFilter === 'all') return true;
    return job.status === jobFilter;
  });

  const StatCard = ({ icon: Icon, label, value, trend, color }: any) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-2xl font-bold" style={{ color }}>{value}</p>
          </div>
          <div className="p-3 rounded-full" style={{ backgroundColor: `${color}15` }}>
            <Icon size={24} style={{ color }} />
          </div>
        </div>
        {trend !== undefined && (
          <div className="mt-2 flex items-center gap-1 text-xs">
            {trend >= 0 ? (
              <TrendingUp size={14} className="text-teal-500" />
            ) : (
              <TrendingDown size={14} className="text-red-500" />
            )}
            <span className={trend >= 0 ? 'text-teal-600' : 'text-red-600'}>
              {Math.abs(trend)}% from last month
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const JobCard = ({ job }: { job: Job }) => (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedJob(job)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-semibold text-gray-900">{job.title}</h3>
            <p className="text-sm text-gray-500 capitalize">{job.roleCategory} • {job.employmentType} • {job.workMode}</p>
          </div>
          <Badge className={JOB_STATUS_COLORS[job.status]}>
            {STATUS_LABELS[job.status]}
          </Badge>
        </div>
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Users size={14} />
              {job.hiredCount}/{job.hiringQuota || '∞'}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={14} />
              {new Date(job.createdAt).toLocaleDateString()}
            </span>
          </div>
          <div className="flex gap-2">
            {job.status === 'draft' && (
              <Button size="sm" variant="outline" onClick={(e) => {
                e.stopPropagation();
                submitForReviewMutation.mutate(job.id);
              }}>
                <Send size={14} className="mr-1" /> Submit
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={(e) => {
              e.stopPropagation();
              setSelectedJob(job);
            }}>
              <Eye size={14} />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const MentorRiskCard = ({ mentor }: { mentor: Mentor }) => (
    <Card className="border-l-4" style={{ borderLeftColor: mentor.performanceHealthIndex < 40 ? brand.danger : brand.warning }}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900">{mentor.fullName}</p>
            <p className="text-sm text-gray-500">Code: {mentor.mentorCode}</p>
          </div>
          <div className="text-right">
            <Badge className={MENTOR_STATUS_COLORS[mentor.status]}>
              {mentor.status.replace('_', ' ')}
            </Badge>
            <p className="text-sm mt-1">
              PHI: <span className={mentor.performanceHealthIndex < 40 ? 'text-red-600 font-bold' : 'text-yellow-600 font-bold'}>
                {mentor.performanceHealthIndex?.toFixed(1) || 0}%
              </span>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AppTopBar
        title="HR Dashboard"
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        onSearch={() => setShowSearch(true)}
        onTour={() => setShowTour(true)}
        onLogout={() => onNavigate('landing')}
        rightExtra={
          <Button size="sm" style={{ backgroundColor: brand.accent }} onClick={() => setShowJobModal(true)} data-testid="btn-create-job" className="hidden sm:flex items-center gap-1.5 h-8 text-white text-xs font-semibold mr-1">
            <Plus size={13} /> New Job
          </Button>
        }
      />

      <main className="flex-1 p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="jobs" data-testid="tab-jobs">Job Postings</TabsTrigger>
            <TabsTrigger value="approvals" data-testid="tab-approvals">Approvals</TabsTrigger>
            <TabsTrigger value="mentors" data-testid="tab-mentors">Mentors</TabsTrigger>
            <TabsTrigger value="compliance" data-testid="tab-compliance">Compliance</TabsTrigger>
            <TabsTrigger value="behavioral-hiring" data-testid="tab-behavioral-hiring">Behavioral Hiring</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            {statsError ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" /> Failed to load dashboard statistics. Please refresh to try again.
              </div>
            ) : statsLoading ? (
              <div className="flex items-center justify-center py-24 text-gray-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading dashboard…
              </div>
            ) : (
            <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard icon={Briefcase} label="Total Jobs" value={stats?.totalJobs || 0} color={brand.primary} />
              <StatCard icon={FileText} label="Published" value={stats?.publishedJobs || 0} color={brand.accent} />
              <StatCard icon={Clock} label="Pending Approvals" value={stats?.pendingApprovals || 0} color={brand.warning} />
              <StatCard icon={Users} label="Applications" value={stats?.totalApplications || 0} color="#7C3AED" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard icon={UserCheck} label="Active Mentors" value={stats?.activeMentors || 0} color={brand.accent} />
              <StatCard icon={AlertTriangle} label="At Risk" value={stats?.mentorsAtRisk || 0} color={brand.warning} />
              <StatCard icon={Shield} label="Violations" value={stats?.pendingViolations || 0} color={brand.danger} />
              <StatCard icon={DollarSign} label="Pending Payouts" value={stats?.pendingPayouts || 0} color="#0891B2" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock size={18} /> Pending Approvals
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {jobs.filter(j => ['hr_review', 'legal_review', 'leadership_approval'].includes(j.status)).slice(0, 5).map(job => (
                      <div key={job.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium">{job.title}</p>
                          <p className="text-sm text-gray-500">{job.roleCategory}</p>
                        </div>
                        <Badge className={JOB_STATUS_COLORS[job.status]}>
                          {STATUS_LABELS[job.status]}
                        </Badge>
                      </div>
                    ))}
                    {jobs.filter(j => ['hr_review', 'legal_review', 'leadership_approval'].includes(j.status)).length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-4">No pending approvals</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle size={18} className="text-yellow-500" /> Mentors At Risk
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mentorsAtRisk.slice(0, 5).map(mentor => (
                      <MentorRiskCard key={mentor.id} mentor={mentor} />
                    ))}
                    {mentorsAtRisk.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-4">No mentors at risk</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
            </>
            )}
          </TabsContent>

          <TabsContent value="jobs">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <Select value={jobFilter} onValueChange={setJobFilter}>
                  <SelectTrigger className="w-48">
                    <Filter size={14} className="mr-2" />
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Jobs</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="hr_review">HR Review</SelectItem>
                    <SelectItem value="legal_review">Legal Review</SelectItem>
                    <SelectItem value="leadership_approval">Leadership</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button style={{ backgroundColor: brand.accent }} onClick={() => setShowJobModal(true)}>
                <Plus size={14} className="mr-1" /> Create Job
              </Button>
            </div>

            {jobsLoading ? (
              <div className="flex items-center justify-center py-24 text-gray-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading jobs…
              </div>
            ) : jobsError ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" /> Failed to load job postings. Please refresh to try again.
              </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredJobs.map(job => (
                <JobCard key={job.id} job={job} />
              ))}
              {filteredJobs.length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-500">
                  <Briefcase size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No jobs found</p>
                </div>
              )}
            </div>
            )}
          </TabsContent>

          <TabsContent value="approvals">
            <ApprovalWorkflow jobs={jobs.filter(j => ['hr_review', 'legal_review', 'leadership_approval'].includes(j.status))} />
          </TabsContent>

          <TabsContent value="mentors">
            <MentorManagement />
          </TabsContent>

          <TabsContent value="compliance">
            <ComplianceDashboard />
          </TabsContent>

          <TabsContent value="behavioral-hiring">
            <HRBehavioralHiring />
          </TabsContent>
        </Tabs>
      </main>

      <CreateJobModal 
        isOpen={showJobModal} 
        onClose={() => setShowJobModal(false)}
        onSubmit={(data) => createJobMutation.mutate(data)}
        isLoading={createJobMutation.isPending}
      />

      {selectedJob && (
        <JobDetailModal
          job={selectedJob}
          isOpen={!!selectedJob}
          onClose={() => setSelectedJob(null)}
        />
      )}

      {showTour && (
        <QuickTour
          type="hr"
          onClose={() => setShowTour(false)}
          onNavigate={(tab) => setActiveTab(tab)}
        />
      )}

      {showSearch && (
        <GlobalSearch
          role="hr"
          onNavigate={(screen) => onNavigate(screen as any)}
          onMenuSelect={(item) => setActiveTab(item)}
          onClose={() => setShowSearch(false)}
          onShowTour={() => setShowTour(true)}
        />
      )}

    </div>
  );
}

function CreateJobModal({ isOpen, onClose, onSubmit, isLoading }: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSubmit: (data: any) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    title: '',
    roleCategory: 'mentor',
    employmentType: 'part-time',
    workMode: 'remote',
    eligibility: '',
    qualifications: '',
    responsibilities: '',
    kpis: '',
    compensationModel: '',
    legalClauses: '',
    hiringQuota: 10
  });

  const handleSubmit = () => {
    onSubmit(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Job Posting</DialogTitle>
          <DialogDescription>Fill in the job details below. The job will be saved as a draft.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Job Title</Label>
            <Input 
              value={formData.title} 
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Academic Mentor - Mathematics"
              data-testid="input-job-title"
            />
          </div>

          <div>
            <Label>Role Category</Label>
            <Select value={formData.roleCategory} onValueChange={(v) => setFormData({ ...formData, roleCategory: v })}>
              <SelectTrigger data-testid="select-role-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mentor">Mentor</SelectItem>
                <SelectItem value="counselor">Counselor</SelectItem>
                <SelectItem value="trainer">Trainer</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Employment Type</Label>
            <Select value={formData.employmentType} onValueChange={(v) => setFormData({ ...formData, employmentType: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="part-time">Part-time</SelectItem>
                <SelectItem value="full-time">Full-time</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Work Mode</Label>
            <Select value={formData.workMode} onValueChange={(v) => setFormData({ ...formData, workMode: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="remote">Remote</SelectItem>
                <SelectItem value="hybrid">Hybrid</SelectItem>
                <SelectItem value="field">Field</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Hiring Quota</Label>
            <Input 
              type="number"
              value={formData.hiringQuota} 
              onChange={(e) => setFormData({ ...formData, hiringQuota: parseInt(e.target.value) })}
            />
          </div>

          <div className="col-span-2">
            <Label>Eligibility & Qualifications</Label>
            <Textarea 
              value={formData.qualifications} 
              onChange={(e) => setFormData({ ...formData, qualifications: e.target.value })}
              placeholder="Required qualifications, experience, certifications..."
              rows={3}
            />
          </div>

          <div className="col-span-2">
            <Label>Responsibilities</Label>
            <Textarea 
              value={formData.responsibilities} 
              onChange={(e) => setFormData({ ...formData, responsibilities: e.target.value })}
              placeholder="Key responsibilities and duties..."
              rows={3}
            />
          </div>

          <div className="col-span-2">
            <Label>KPIs & Performance Expectations</Label>
            <Textarea 
              value={formData.kpis} 
              onChange={(e) => setFormData({ ...formData, kpis: e.target.value })}
              placeholder="Performance metrics and expectations..."
              rows={3}
            />
          </div>

          <div className="col-span-2">
            <Label>Compensation Model</Label>
            <Textarea 
              value={formData.compensationModel} 
              onChange={(e) => setFormData({ ...formData, compensationModel: e.target.value })}
              placeholder="Performance-based earnings, commission structure..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading || !formData.title}
            style={{ backgroundColor: brand.accent }}
            data-testid="btn-save-job"
          >
            {isLoading ? 'Saving...' : 'Save Draft'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function JobDetailModal({ job, isOpen, onClose }: { job: Job; isOpen: boolean; onClose: () => void }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{job.title}</DialogTitle>
          <DialogDescription>
            <Badge className={JOB_STATUS_COLORS[job.status]}>{STATUS_LABELS[job.status]}</Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Category</p>
              <p className="font-medium capitalize">{job.roleCategory}</p>
            </div>
            <div>
              <p className="text-gray-500">Type</p>
              <p className="font-medium capitalize">{job.employmentType}</p>
            </div>
            <div>
              <p className="text-gray-500">Mode</p>
              <p className="font-medium capitalize">{job.workMode}</p>
            </div>
          </div>

          <div className="text-sm">
            <p className="text-gray-500">Hiring Progress</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div 
                  className="h-2 rounded-full" 
                  style={{ 
                    width: `${job.hiringQuota ? (job.hiredCount / job.hiringQuota) * 100 : 0}%`,
                    backgroundColor: brand.accent
                  }} 
                />
              </div>
              <span className="font-medium">{job.hiredCount}/{job.hiringQuota || '∞'}</span>
            </div>
          </div>

          <div className="text-sm">
            <p className="text-gray-500">Created</p>
            <p className="font-medium">{new Date(job.createdAt).toLocaleString()}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApprovalWorkflow({ jobs }: { jobs: Job[] }) {
  const queryClient = useQueryClient();
  const [reviewNotes, setReviewNotes] = useState('');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const approveMutation = useMutation({
    mutationFn: async ({ jobId, approved, notes }: any) => {
      const endpoint = approved ? 'approve' : 'reject';
      const response = await fetch(`/api/hr/jobs/${jobId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ notes, reason: notes })
      });
      if (!response.ok) throw new Error('Failed to process approval');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/hr/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/hr/dashboard/stats'] });
      setSelectedJob(null);
      setReviewNotes('');
    }
  });

  const getReviewEndpoint = (_status: string) => {
    return 'approve';
  };

  const handleApproval = (approved: boolean) => {
    if (!selectedJob) return;
    approveMutation.mutate({
      jobId: selectedJob.id,
      approved,
      notes: reviewNotes
    });
  };

  const hrReview = jobs.filter(j => j.status === 'hr_review');
  const legalReview = jobs.filter(j => j.status === 'legal_review');
  const leadershipApproval = jobs.filter(j => j.status === 'leadership_approval');

  const WorkflowColumn = ({ title, items, icon: Icon, color }: any) => (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={18} style={{ color }} />
        <h3 className="font-semibold">{title}</h3>
        <Badge variant="secondary">{items.length}</Badge>
      </div>
      <div className="space-y-3">
        {items.map((job: Job) => (
          <Card key={job.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedJob(job)}>
            <CardContent className="p-3">
              <p className="font-medium text-sm">{job.title}</p>
              <p className="text-xs text-gray-500 capitalize">{job.roleCategory}</p>
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">No items</p>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <WorkflowColumn title="HR Review" items={hrReview} icon={Users} color={brand.warning} />
        <WorkflowColumn title="Legal Review" items={legalReview} icon={Shield} color="#7C3AED" />
        <WorkflowColumn title="Leadership Approval" items={leadershipApproval} icon={Building2} color={brand.primary} />
      </div>

      {selectedJob && (
        <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Review: {selectedJob.title}</DialogTitle>
              <DialogDescription>
                Stage: <Badge className={JOB_STATUS_COLORS[selectedJob.status]}>{STATUS_LABELS[selectedJob.status]}</Badge>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Review Notes</Label>
                <Textarea 
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add your review comments..."
                  rows={4}
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setSelectedJob(null)}>Cancel</Button>
              <Button 
                variant="destructive" 
                onClick={() => handleApproval(false)}
                disabled={approveMutation.isPending}
              >
                <XCircle size={14} className="mr-1" /> Reject
              </Button>
              <Button 
                onClick={() => handleApproval(true)}
                disabled={approveMutation.isPending}
                style={{ backgroundColor: brand.accent }}
              >
                <CheckCircle size={14} className="mr-1" /> Approve
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function MentorManagement() {
  const { data: mentors = [], isLoading, isError } = useQuery<Mentor[]>({
    queryKey: ['/api/hr/mentors'],
  });

  const { data: stats = [] } = useQuery<{ status: string; count: number }[]>({
    queryKey: ['/api/hr/mentors/stats'],
  });

  const getStatusCount = (status: string) => stats.find(s => s.status === status)?.count || 0;

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
        {['pending_training', 'training', 'assessment', 'active', 'warning', 'suspended', 'deactivated'].map(status => (
          <Card key={status}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{getStatusCount(status)}</p>
              <p className="text-xs text-gray-500 capitalize">{status.replace('_', ' ')}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Mentors</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-8 text-gray-500">Loading mentors...</p>
          ) : isError ? (
            <p className="text-center py-8 text-red-600">Failed to load mentors. Please refresh to try again.</p>
          ) : mentors.length === 0 ? (
            <p className="text-center py-8 text-gray-500">No mentors found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Mentor</th>
                    <th className="text-left py-3 px-4">Code</th>
                    <th className="text-left py-3 px-4">Status</th>
                    <th className="text-left py-3 px-4">PHI</th>
                    <th className="text-left py-3 px-4">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {mentors.map(mentor => (
                    <tr key={mentor.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">{mentor.fullName}</td>
                      <td className="py-3 px-4 font-mono text-xs">{mentor.mentorCode}</td>
                      <td className="py-3 px-4">
                        <Badge className={MENTOR_STATUS_COLORS[mentor.status]}>
                          {mentor.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <span className={mentor.performanceHealthIndex < 40 ? 'text-red-600' : mentor.performanceHealthIndex < 70 ? 'text-yellow-600' : 'text-teal-600'}>
                          {mentor.performanceHealthIndex?.toFixed(1) || 0}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-500">
                        {new Date(mentor.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ComplianceDashboard() {
  const { data: violations = [], isLoading, isError } = useQuery<any[]>({
    queryKey: ['/api/hr/compliance/violations'],
  });

  const SEVERITY_COLORS: Record<string, string> = {
    minor: 'bg-yellow-100 text-yellow-700',
    moderate: 'bg-orange-100 text-orange-700',
    major: 'bg-red-100 text-red-700',
    critical: 'bg-red-200 text-red-800'
  };

  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield size={18} /> Pending Violations
          </CardTitle>
          <CardDescription>Compliance issues requiring investigation or resolution</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-8 text-gray-500">Loading violations...</p>
          ) : isError ? (
            <div className="text-center py-12">
              <AlertTriangle size={48} className="mx-auto mb-4 text-red-500" />
              <p className="text-red-600">Failed to load violations. Please refresh to try again.</p>
            </div>
          ) : violations.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle size={48} className="mx-auto mb-4 text-teal-500" />
              <p className="text-gray-500">No pending violations</p>
            </div>
          ) : (
            <div className="space-y-4">
              {violations.map((violation: any) => (
                <Card key={violation.id} className="border-l-4" style={{ borderLeftColor: violation.severity === 'critical' ? brand.danger : brand.warning }}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={SEVERITY_COLORS[violation.severity]}>
                            {violation.severity}
                          </Badge>
                          <Badge variant="outline">{violation.violationType}</Badge>
                        </div>
                        <p className="text-sm text-gray-700">{violation.description}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          Reported: {new Date(violation.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant="secondary">{violation.status}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default HRDashboard;
