import { useState, useEffect } from 'react';
import { Screen } from '../App';
import { AppTopBar } from './AppTopBar';
import { GlobalSearch } from './GlobalSearch';
import { QuickTour } from './QuickTour';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  QuickStartGuide, 
  FeatureHighlights, 
  ContextualHelp, 
  HelpCenter, 
  FloatingHelpButton,
  HelpTooltip,
  SupportContact,
  StatusIndicator
} from "@/components/ui/HelpSystem";
import {
  Building2,
  Users,
  GraduationCap,
  Heart,
  Brain,
  TrendingUp,
  TrendingDown,
  Target,
  Award,
  BookOpen,
  Calendar,
  BarChart3,
  PieChart,
  Activity,
  UserPlus,
  Search,
  Download,
  ChevronRight,
  Plus,
  CheckCircle,
  Clock,
  AlertCircle,
  Shield,
  Sparkles,
  MapPin,
  FileText,
  RefreshCw,
  Eye,
  Play,
  LogOut,
  HelpCircle,
  Lightbulb,
  Zap,
  Video,
  MessageCircle,
  Globe,
  Layers
} from 'lucide-react';

const brand = {
  primary: '#0B3C5D',
  accent: '#4ECDC4',
};

interface BeneficiaryChild {
  id: string;
  name: string;
  age: number;
  grade: string;
  location: string;
  enrolledDate: string;
  lbiConsent: boolean;
  status: 'Active' | 'Inactive' | 'Graduated';
  assessmentsCompleted: number;
  lastAssessmentDate?: string;
  avgScore?: number;
  improvementRate?: number;
}

interface Program {
  id: string;
  name: string;
  description: string;
  beneficiariesCount: number;
  activeCount: number;
  completedCount: number;
  startDate: string;
  endDate?: string;
  status: 'Active' | 'Completed' | 'Planned';
  locations: string[];
}

interface NGOStats {
  totalBeneficiaries: number;
  activeBeneficiaries: number;
  totalPrograms: number;
  activePrograms: number;
  assessmentsCompleted: number;
  avgImprovementRate: number;
  consentRate: number;
  locationsCovered: number;
}

interface Props {
  onNavigate: (screen: Screen) => void;
}

export function NGODashboard({ onNavigate }: Props) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<NGOStats | null>(null);
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryChild[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProgram, setSelectedProgram] = useState<string>('all');
  const [isAddBeneficiaryOpen, setIsAddBeneficiaryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [showHelpCenter, setShowHelpCenter] = useState(false);
  const [showQuickStart, setShowQuickStart] = useState(true);
  const [isAddProgramOpen, setIsAddProgramOpen] = useState(false);
  const { toast } = useToast();

  const quickStartItems = [
    {
      id: 'program',
      title: 'Create Your First Program',
      description: 'Set up educational interventions',
      icon: BookOpen,
      completed: programs.length > 0,
      action: () => setIsAddProgramOpen(true)
    },
    {
      id: 'beneficiary',
      title: 'Add Beneficiaries',
      description: 'Register children in your programs',
      icon: Users,
      completed: beneficiaries.length > 0,
      action: () => setIsAddBeneficiaryOpen(true)
    },
    {
      id: 'consent',
      title: 'Collect Guardian Consent',
      description: 'DPDP Act compliance for assessments',
      icon: Shield,
      completed: (stats?.consentRate || 0) > 50,
      action: () => setActiveTab('beneficiaries')
    },
    {
      id: 'assessment',
      title: 'Start Assessments',
      description: 'Begin tracking educational impact',
      icon: Brain,
      completed: (stats?.assessmentsCompleted || 0) > 0,
      action: () => setActiveTab('impact')
    }
  ];

  const ngoFeatures = [
    { id: 'beneficiaries', title: 'Beneficiary Management', description: 'Register and track children with DPDP compliance', icon: Users },
    { id: 'programs', title: 'Program Management', description: 'Create and manage educational programs', icon: BookOpen },
    { id: 'assessments', title: 'LBI Assessments', description: 'Behavioral intelligence tracking for holistic development', icon: Brain, isPro: true },
    { id: 'impact', title: 'Impact Analytics', description: 'Measure and visualize program effectiveness', icon: Target, isNew: true },
    { id: 'consent', title: 'Consent Management', description: 'DPDP Act compliant guardian consent tracking', icon: Shield },
    { id: 'reports', title: 'Impact Reports', description: 'Generate donor-ready impact reports', icon: FileText },
    { id: 'locations', title: 'Geographic Coverage', description: 'Track beneficiaries across locations', icon: Globe },
    { id: 'resources', title: 'Resource Library', description: 'Educational materials and best practices', icon: Layers }
  ];

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Simulated data - replace with actual API calls
      setStats({
        totalBeneficiaries: 1250,
        activeBeneficiaries: 980,
        totalPrograms: 12,
        activePrograms: 8,
        assessmentsCompleted: 3420,
        avgImprovementRate: 23,
        consentRate: 94,
        locationsCovered: 45
      });

      setBeneficiaries([
        { id: '1', name: 'Priya Sharma', age: 12, grade: 'Grade 6', location: 'Mumbai', enrolledDate: '2024-01-15', lbiConsent: true, status: 'Active', assessmentsCompleted: 5, lastAssessmentDate: '2024-01-20', avgScore: 72, improvementRate: 15 },
        { id: '2', name: 'Rahul Kumar', age: 14, grade: 'Grade 8', location: 'Delhi', enrolledDate: '2024-02-10', lbiConsent: true, status: 'Active', assessmentsCompleted: 3, lastAssessmentDate: '2024-01-18', avgScore: 68, improvementRate: 20 },
        { id: '3', name: 'Ananya Patel', age: 11, grade: 'Grade 5', location: 'Ahmedabad', enrolledDate: '2024-01-20', lbiConsent: false, status: 'Active', assessmentsCompleted: 2, avgScore: 65 },
        { id: '4', name: 'Vikram Singh', age: 15, grade: 'Grade 9', location: 'Jaipur', enrolledDate: '2023-11-05', lbiConsent: true, status: 'Active', assessmentsCompleted: 8, lastAssessmentDate: '2024-01-22', avgScore: 78, improvementRate: 28 },
        { id: '5', name: 'Meera Reddy', age: 13, grade: 'Grade 7', location: 'Hyderabad', enrolledDate: '2024-01-08', lbiConsent: true, status: 'Active', assessmentsCompleted: 4, lastAssessmentDate: '2024-01-19', avgScore: 70, improvementRate: 12 },
      ]);

      setPrograms([
        { id: '1', name: 'Digital Literacy for All', description: 'Basic computer and internet skills for underprivileged children', beneficiariesCount: 450, activeCount: 380, completedCount: 70, startDate: '2023-06-01', status: 'Active', locations: ['Mumbai', 'Pune', 'Nagpur'] },
        { id: '2', name: 'STEM Excellence', description: 'Science and Mathematics coaching for grades 6-10', beneficiariesCount: 280, activeCount: 250, completedCount: 30, startDate: '2023-09-01', status: 'Active', locations: ['Delhi', 'Noida', 'Gurgaon'] },
        { id: '3', name: 'Career Guidance Program', description: 'Career counseling and skill development for high school students', beneficiariesCount: 320, activeCount: 200, completedCount: 120, startDate: '2023-03-01', status: 'Active', locations: ['Bangalore', 'Chennai', 'Hyderabad'] },
        { id: '4', name: 'English Proficiency', description: 'English communication skills development', beneficiariesCount: 200, activeCount: 150, completedCount: 50, startDate: '2024-01-01', status: 'Active', locations: ['Kolkata', 'Patna'] },
      ]);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredBeneficiaries = beneficiaries.filter(b => {
    const matchesSearch = b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProgram = selectedProgram === 'all' || true; // Add program filter logic
    return matchesSearch && matchesProgram;
  });

  const StatCard = ({ title, value, subtitle, icon: Icon, trend, color }: { 
    title: string; 
    value: string | number; 
    subtitle?: string;
    icon: any; 
    trend?: number;
    color: string;
  }) => (
    <Card className="border-0 shadow-md">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-gray-500">{title}</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold" style={{ color: brand.primary }}>{value}</span>
              {trend !== undefined && (
                <div className={`flex items-center text-xs ${trend >= 0 ? 'text-teal-600' : 'text-red-600'}`}>
                  {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  <span>{Math.abs(trend)}%</span>
                </div>
              )}
            </div>
            {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
          </div>
          <div className="p-3 rounded-xl" style={{ backgroundColor: `${color}15` }}>
            <Icon size={24} style={{ color }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 rounded-full animate-spin" style={{ borderColor: brand.accent, borderTopColor: 'transparent' }} />
          <p className="text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AppTopBar
        title="NGO Dashboard"
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        onSearch={() => setShowSearch(true)}
        onTour={() => setShowTour(true)}
        onLogout={() => onNavigate('landing')}
      />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        {/* Welcome Banner */}
        <Card className="mb-6 border-0 shadow-lg overflow-hidden" style={{ background: `${brand.primary}` }}>
          <CardContent className="p-6 text-white">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={18} />
                  <span className="text-sm font-medium opacity-90">Social Impact Platform</span>
                </div>
                <h2 className="text-xl font-bold mb-1">Welcome to MetryxOne for NGOs</h2>
                <p className="text-white/80 text-sm">Empowering underprivileged children through data-driven education insights</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button 
                  className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddProgramOpen(true)}
                  data-testid="btn-create-program"
                >
                  <Plus size={14} className="mr-1" /> Create Program
                </Button>
                <Button 
                  className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddBeneficiaryOpen(true)}
                  data-testid="btn-add-beneficiary"
                >
                  <UserPlus size={14} className="mr-1" /> Add Beneficiary
                </Button>
                <Button 
                  className="bg-white text-gray-800 hover:bg-gray-100"
                  size="sm"
                  onClick={() => setShowHelpCenter(true)}
                  data-testid="btn-get-help"
                >
                  <HelpCircle size={14} className="mr-1" /> Get Help
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard 
            title="Total Beneficiaries" 
            value={stats?.totalBeneficiaries || 0}
            subtitle={`${stats?.activeBeneficiaries || 0} active`}
            icon={Users}
            color={brand.primary}
          />
          <StatCard 
            title="Active Programs" 
            value={stats?.activePrograms || 0}
            subtitle={`${stats?.totalPrograms || 0} total programs`}
            icon={BookOpen}
            color={brand.accent}
          />
          <StatCard 
            title="Assessments Done" 
            value={stats?.assessmentsCompleted || 0}
            subtitle="LBI & Academic"
            icon={Brain}
            color="#8b5cf6"
          />
          <StatCard 
            title="Avg. Improvement" 
            value={`${stats?.avgImprovementRate || 0}%`}
            subtitle="Year over year"
            icon={TrendingUp}
            trend={stats?.avgImprovementRate}
            color="#f59e0b"
          />
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="overview" data-testid="tab-ngo-overview">Overview</TabsTrigger>
            <TabsTrigger value="beneficiaries" data-testid="tab-ngo-beneficiaries">Beneficiaries</TabsTrigger>
            <TabsTrigger value="programs" data-testid="tab-ngo-programs">Programs</TabsTrigger>
            <TabsTrigger value="impact" data-testid="tab-ngo-impact">Impact Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="space-y-6">
              {/* Quick Start Guide (shown until all steps completed) */}
              {showQuickStart && !quickStartItems.every(i => i.completed) && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <QuickStartGuide
                      title="Getting Started with MetryxOne"
                      subtitle="Complete these steps to maximize your social impact"
                      items={quickStartItems}
                      onDismiss={() => setShowQuickStart(false)}
                    />
                  </div>
                  <div className="space-y-4">
                    <SupportContact />
                  </div>
                </div>
              )}

              {/* Self-Service Feature Highlights */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap size={18} style={{ color: brand.accent }} />
                    <h3 className="font-semibold text-sm" style={{ color: brand.primary }}>Self-Service Features</h3>
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowHelpCenter(true)}>
                    View All Features <ChevronRight size={14} />
                  </Button>
                </div>
                <FeatureHighlights 
                  features={ngoFeatures}
                  onFeatureClick={(feature) => {
                    if (feature.id === 'beneficiaries') setActiveTab('beneficiaries');
                    else if (feature.id === 'programs') setActiveTab('programs');
                    else if (feature.id === 'impact' || feature.id === 'assessments') setActiveTab('impact');
                  }}
                />
              </div>

              {/* Impact Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: `${brand.accent}15` }}>
                        <Globe size={18} style={{ color: brand.accent }} />
                      </div>
                      <div>
                        <p className="text-xl font-bold" style={{ color: brand.primary }}>{stats?.locationsCovered || 0}</p>
                        <p className="text-xs text-gray-500">Locations Covered</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: `${brand.primary}15` }}>
                        <Shield size={18} style={{ color: brand.primary }} />
                      </div>
                      <div>
                        <p className="text-xl font-bold" style={{ color: brand.primary }}>{stats?.consentRate || 0}%</p>
                        <p className="text-xs text-gray-500">Consent Rate</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-purple-50">
                        <Brain size={18} className="text-purple-600" />
                      </div>
                      <div>
                        <p className="text-xl font-bold" style={{ color: brand.primary }}>{stats?.assessmentsCompleted || 0}</p>
                        <p className="text-xs text-gray-500">Assessments</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-amber-50">
                        <TrendingUp size={18} className="text-amber-600" />
                      </div>
                      <div>
                        <p className="text-xl font-bold text-teal-600">+{stats?.avgImprovementRate || 0}%</p>
                        <p className="text-xs text-gray-500">Avg Improvement</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Recent Beneficiaries */}
              <Card className="border-0 shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base" style={{ color: brand.primary }}>Recent Beneficiaries</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setActiveTab('beneficiaries')}>
                      View All <ChevronRight size={14} className="ml-1" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {beneficiaries.slice(0, 4).map((child) => (
                    <div key={child.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${brand.accent}20` }}>
                          <GraduationCap size={18} style={{ color: brand.accent }} />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{child.name}</p>
                          <p className="text-xs text-gray-500">{child.grade} • {child.location}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={child.status === 'Active' ? 'default' : 'secondary'}>
                          {child.status}
                        </Badge>
                        {child.avgScore && (
                          <p className="text-xs mt-1" style={{ color: brand.accent }}>Avg: {child.avgScore}%</p>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Active Programs */}
              <Card className="border-0 shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base" style={{ color: brand.primary }}>Active Programs</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setActiveTab('programs')}>
                      View All <ChevronRight size={14} className="ml-1" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {programs.filter(p => p.status === 'Active').slice(0, 4).map((program) => (
                    <div key={program.id} className="p-3 rounded-lg bg-gray-50">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-sm">{program.name}</p>
                          <p className="text-xs text-gray-500">{program.locations.join(', ')}</p>
                        </div>
                        <Badge style={{ backgroundColor: `${brand.accent}20`, color: brand.accent }}>
                          {program.activeCount} active
                        </Badge>
                      </div>
                      <Progress 
                        value={(program.completedCount / program.beneficiariesCount) * 100} 
                        className="h-1.5"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        {program.completedCount} of {program.beneficiariesCount} completed
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* DPDP Compliance */}
              <Card className="border-0 shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2" style={{ color: brand.primary }}>
                    <Shield size={18} style={{ color: brand.accent }} />
                    DPDP Act Compliance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Guardian Consent Rate</span>
                      <span className="font-bold" style={{ color: brand.accent }}>{stats?.consentRate}%</span>
                    </div>
                    <Progress value={stats?.consentRate || 0} className="h-2" />
                    <div className="p-3 rounded-lg" style={{ backgroundColor: `${brand.primary}08` }}>
                      <p className="text-xs text-gray-600">
                        <strong>Note:</strong> All beneficiary data is collected with proper guardian consent as per India's Digital Personal Data Protection Act, 2023. Behavioral assessments require explicit consent.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="p-3 rounded-lg bg-teal-50">
                        <CheckCircle size={20} className="mx-auto text-teal-600 mb-1" />
                        <p className="text-xs text-teal-700 font-medium">Consented</p>
                        <p className="text-lg font-bold text-teal-600">{beneficiaries.filter(b => b.lbiConsent).length}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-amber-50">
                        <Clock size={20} className="mx-auto text-amber-600 mb-1" />
                        <p className="text-xs text-amber-700 font-medium">Pending</p>
                        <p className="text-lg font-bold text-amber-600">{beneficiaries.filter(b => !b.lbiConsent).length}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card className="border-0 shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base" style={{ color: brand.primary }}>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    className="w-full justify-start text-white"
                    style={{ backgroundColor: brand.accent }}
                    onClick={() => setIsAddBeneficiaryOpen(true)}
                    data-testid="btn-quick-add-beneficiary"
                  >
                    <UserPlus size={16} className="mr-3" />
                    Add New Beneficiary
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    style={{ borderColor: brand.primary, color: brand.primary }}
                    data-testid="btn-bulk-assessment"
                  >
                    <Brain size={16} className="mr-3" />
                    Start Bulk Assessment
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    data-testid="btn-generate-report"
                  >
                    <FileText size={16} className="mr-3" />
                    Generate Impact Report
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    data-testid="btn-export-data"
                  >
                    <Download size={16} className="mr-3" />
                    Export Data (DPDP Compliant)
                  </Button>
                </CardContent>
              </Card>
            </div>
            </div>
          </TabsContent>

          <TabsContent value="beneficiaries">
            <Card className="border-0 shadow-md">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle style={{ color: brand.primary }}>All Beneficiaries</CardTitle>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <Input 
                        placeholder="Search beneficiaries..." 
                        className="pl-9 w-64"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        data-testid="input-search-beneficiaries"
                      />
                    </div>
                    <Select value={selectedProgram} onValueChange={setSelectedProgram}>
                      <SelectTrigger className="w-40" data-testid="select-program-filter">
                        <SelectValue placeholder="All Programs" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Programs</SelectItem>
                        {programs.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredBeneficiaries.map((child) => (
                    <div key={child.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: `${brand.accent}15` }}>
                          <GraduationCap size={20} style={{ color: brand.accent }} />
                        </div>
                        <div>
                          <p className="font-medium">{child.name}</p>
                          <p className="text-sm text-gray-500">{child.grade} • Age {child.age}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <MapPin size={12} className="text-gray-400" />
                            <span className="text-xs text-gray-400">{child.location}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <p className="text-xs text-gray-500">Assessments</p>
                          <p className="font-semibold" style={{ color: brand.primary }}>{child.assessmentsCompleted}</p>
                        </div>
                        {child.avgScore && (
                          <div className="text-center">
                            <p className="text-xs text-gray-500">Avg Score</p>
                            <p className="font-semibold" style={{ color: brand.accent }}>{child.avgScore}%</p>
                          </div>
                        )}
                        {child.improvementRate && (
                          <div className="text-center">
                            <p className="text-xs text-gray-500">Improvement</p>
                            <div className="flex items-center justify-center text-teal-600">
                              <TrendingUp size={12} />
                              <span className="font-semibold ml-1">{child.improvementRate}%</span>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          {child.lbiConsent ? (
                            <Badge className="bg-teal-100 text-teal-700">Consented</Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-600 border-amber-300">Pending Consent</Badge>
                          )}
                          <Button variant="ghost" size="sm" data-testid={`btn-view-beneficiary-${child.id}`}>
                            <Eye size={14} />
                          </Button>
                          <Button 
                            size="sm" 
                            style={{ backgroundColor: brand.accent }}
                            className="text-white"
                            disabled={!child.lbiConsent}
                            data-testid={`btn-assess-${child.id}`}
                          >
                            <Play size={14} className="mr-1" />
                            Assess
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="programs">
            <div className="grid md:grid-cols-2 gap-6">
              {programs.map((program) => (
                <Card key={program.id} className="border-0 shadow-md">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg" style={{ color: brand.primary }}>{program.name}</CardTitle>
                        <CardDescription className="mt-1">{program.description}</CardDescription>
                      </div>
                      <Badge 
                        style={{ 
                          backgroundColor: program.status === 'Active' ? `${brand.accent}20` : '#f3f4f6',
                          color: program.status === 'Active' ? brand.accent : '#6b7280'
                        }}
                      >
                        {program.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <MapPin size={14} />
                        <span>{program.locations.join(', ')}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="p-3 rounded-lg bg-gray-50">
                          <p className="text-2xl font-bold" style={{ color: brand.primary }}>{program.beneficiariesCount}</p>
                          <p className="text-xs text-gray-500">Total</p>
                        </div>
                        <div className="p-3 rounded-lg" style={{ backgroundColor: `${brand.accent}10` }}>
                          <p className="text-2xl font-bold" style={{ color: brand.accent }}>{program.activeCount}</p>
                          <p className="text-xs text-gray-500">Active</p>
                        </div>
                        <div className="p-3 rounded-lg bg-teal-50">
                          <p className="text-2xl font-bold text-teal-600">{program.completedCount}</p>
                          <p className="text-xs text-gray-500">Completed</p>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Progress</span>
                          <span>{Math.round((program.completedCount / program.beneficiariesCount) * 100)}%</span>
                        </div>
                        <Progress value={(program.completedCount / program.beneficiariesCount) * 100} className="h-2" />
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" data-testid={`btn-view-program-${program.id}`}>
                          <Eye size={14} className="mr-2" />
                          View Details
                        </Button>
                        <Button 
                          size="sm" 
                          className="flex-1 text-white"
                          style={{ backgroundColor: brand.accent }}
                          data-testid={`btn-manage-program-${program.id}`}
                        >
                          Manage
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="impact">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2" style={{ color: brand.primary }}>
                    <BarChart3 size={20} style={{ color: brand.accent }} />
                    Impact Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg" style={{ backgroundColor: `${brand.accent}10` }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Average Score Improvement</span>
                        <span className="text-2xl font-bold" style={{ color: brand.accent }}>+23%</span>
                      </div>
                      <Progress value={75} className="h-2" />
                      <p className="text-xs text-gray-500 mt-2">Compared to enrollment baseline</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-blue-50 text-center">
                        <Brain size={24} className="mx-auto text-blue-600 mb-2" />
                        <p className="text-2xl font-bold text-blue-600">85%</p>
                        <p className="text-xs text-blue-700">LBI Completion Rate</p>
                      </div>
                      <div className="p-4 rounded-lg bg-purple-50 text-center">
                        <Award size={24} className="mx-auto text-purple-600 mb-2" />
                        <p className="text-2xl font-bold text-purple-600">342</p>
                        <p className="text-xs text-purple-700">Children Graduated</p>
                      </div>
                    </div>
                    <div className="p-4 rounded-lg bg-gray-50">
                      <h4 className="font-medium mb-3" style={{ color: brand.primary }}>Key Improvements</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Confidence Level</span>
                          <div className="flex items-center text-teal-600">
                            <TrendingUp size={14} />
                            <span className="ml-1">+28%</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Focus & Attention</span>
                          <div className="flex items-center text-teal-600">
                            <TrendingUp size={14} />
                            <span className="ml-1">+22%</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Emotional Intelligence</span>
                          <div className="flex items-center text-teal-600">
                            <TrendingUp size={14} />
                            <span className="ml-1">+18%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2" style={{ color: brand.primary }}>
                    <MapPin size={20} style={{ color: brand.accent }} />
                    Geographic Reach
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center p-4 rounded-lg" style={{ backgroundColor: `${brand.primary}08` }}>
                      <p className="text-4xl font-bold" style={{ color: brand.primary }}>{stats?.locationsCovered}</p>
                      <p className="text-sm text-gray-500">Cities & Towns Covered</p>
                    </div>
                    <div className="space-y-3">
                      {['Maharashtra', 'Delhi NCR', 'Karnataka', 'Tamil Nadu', 'Gujarat'].map((state, i) => (
                        <div key={state} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                          <span className="text-sm">{state}</span>
                          <div className="flex items-center gap-2">
                            <Progress value={100 - (i * 15)} className="w-20 h-1.5" />
                            <span className="text-xs text-gray-500 w-8">{250 - (i * 40)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button variant="outline" className="w-full" data-testid="btn-view-full-map">
                      <MapPin size={14} className="mr-2" />
                      View Full Map
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Add Beneficiary Dialog */}
      <Dialog open={isAddBeneficiaryOpen} onOpenChange={setIsAddBeneficiaryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ color: brand.primary }}>Add New Beneficiary</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Child's Name *</Label>
              <Input placeholder="Enter full name" data-testid="input-beneficiary-name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Age *</Label>
                <Input type="number" placeholder="Age" data-testid="input-beneficiary-age" />
              </div>
              <div className="space-y-2">
                <Label>Grade *</Label>
                <Select>
                  <SelectTrigger data-testid="select-beneficiary-grade">
                    <SelectValue placeholder="Select grade" />
                  </SelectTrigger>
                  <SelectContent>
                    {['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'].map(g => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Location *</Label>
              <Input placeholder="City/Village" data-testid="input-beneficiary-location" />
            </div>
            <div className="space-y-2">
              <Label>Program</Label>
              <Select>
                <SelectTrigger data-testid="select-beneficiary-program">
                  <SelectValue placeholder="Select program" />
                </SelectTrigger>
                <SelectContent>
                  {programs.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Guardian Name *</Label>
              <Input placeholder="Parent/Guardian name" data-testid="input-guardian-name" />
            </div>
            <div className="space-y-2">
              <Label>Guardian Contact</Label>
              <Input placeholder="Phone number" data-testid="input-guardian-contact" />
            </div>
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="text-amber-600 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Guardian consent for behavioral assessments will be collected separately as per DPDP Act 2023 requirements.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddBeneficiaryOpen(false)}>
              Cancel
            </Button>
            <Button 
              style={{ backgroundColor: brand.accent }}
              className="text-white"
              onClick={() => {
                toast({ title: 'Beneficiary Added', description: 'The child has been added to the program.' });
                setIsAddBeneficiaryOpen(false);
              }}
              data-testid="btn-confirm-add-beneficiary"
            >
              Add Beneficiary
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Program Modal */}
      <Dialog open={isAddProgramOpen} onOpenChange={setIsAddProgramOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ color: brand.primary }}>Create New Program</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <ContextualHelp 
              topic="What is a Program?"
              description="Programs are educational interventions you run for beneficiaries. Examples: Digital Literacy, STEM Excellence, Career Guidance. Each program can have multiple beneficiaries and track their progress over time."
              icon={Lightbulb}
            />
            <div className="space-y-2">
              <Label>Program Name *</Label>
              <Input placeholder="e.g., Digital Literacy Program" data-testid="input-program-name" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input placeholder="Brief description of the program objectives" data-testid="input-program-description" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" data-testid="input-program-start" />
              </div>
              <div className="space-y-2">
                <Label>End Date (Optional)</Label>
                <Input type="date" data-testid="input-program-end" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Locations</Label>
              <Input placeholder="e.g., Mumbai, Delhi, Bangalore" data-testid="input-program-locations" />
              <p className="text-xs text-gray-500">Comma-separated list of locations where this program operates</p>
            </div>
            <div className="space-y-2">
              <Label>Target Beneficiaries</Label>
              <Input type="number" placeholder="Expected number of beneficiaries" data-testid="input-program-target" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddProgramOpen(false)}>
              Cancel
            </Button>
            <Button 
              style={{ backgroundColor: brand.accent }}
              className="text-white"
              onClick={() => {
                toast({ title: 'Program Created', description: 'Your new program has been created successfully.' });
                setIsAddProgramOpen(false);
              }}
              data-testid="btn-confirm-create-program"
            >
              Create Program
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Help Center Dialog */}
      <HelpCenter 
        isOpen={showHelpCenter} 
        onClose={() => setShowHelpCenter(false)} 
        portalType="ngo"
      />

      {/* Floating Help Button */}
      <FloatingHelpButton 
        onClick={() => setShowHelpCenter(true)}
        label="Need Help?"
      />

      {showTour && (
        <QuickTour
          type="ngo"
          onClose={() => setShowTour(false)}
          onNavigate={(tab) => setActiveTab(tab)}
        />
      )}

      {showSearch && (
        <GlobalSearch
          role="ngo"
          onNavigate={(screen) => onNavigate(screen as any)}
          onMenuSelect={(item) => setActiveTab(item)}
          onClose={() => setShowSearch(false)}
          onShowTour={() => setShowTour(true)}
        />
      )}

    </div>
  );
}
