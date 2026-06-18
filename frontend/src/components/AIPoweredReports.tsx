import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Sparkles,
  Brain,
  Heart,
  TrendingUp,
  Target,
  FileText,
  Download,
  RefreshCw,
  ChevronRight,
  CheckCircle,
  AlertTriangle,
  Lightbulb,
  BarChart3,
  Clock,
  ArrowRight,
  Loader2,
  Shield,
  Zap,
  Users,
  BookOpen,
  GraduationCap,
  Play,
  Eye,
  Layers,
  Lock,
  Award,
  Search,
  FileDown,
  Printer,
  PieChart,
  Activity,
  X,
} from "lucide-react";

const brand = {
  primary: '#0B3C5D',
  accent: '#4ECDC4',
};

interface ReportSection {
  name: string;
  score?: number;
  findings: string[];
  recommendation: string;
}

interface ReportDimension {
  key: string;
  label: string;
  score: number;
}

interface AIReport {
  title: string;
  summary: string;
  overallScore: number | null;
  sections: ReportSection[];
  keyInsights: string[];
  actionPlan: string[];
  reportType: string;
  generatedAt: string;
  childName?: string;
  dimensions?: ReportDimension[] | null;
  learningStyle?: string | null;
  sessionsAnalyzed?: number | null;
  dataAvailable?: boolean;
  preview?: boolean;
  scoreSource?: string | null;
  disclaimer?: string | null;
}

interface ReportType {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

interface Props {
  childName?: string;
  childAge?: number;
  childGrade?: string;
  childId?: string;
  role?: 'parent' | 'institute';
  onNavigate?: (screen: string) => void;
}

const REPORT_TYPES: ReportType[] = [
  { id: 'learning-analysis', name: 'Learning Analysis', description: 'Comprehensive analysis of learning patterns, cognitive strengths, and knowledge retention across academic subjects', icon: 'brain', color: '#0B3C5D' },
  { id: 'behavioral-insights', name: 'Behavioral Insights', description: 'Deep dive into emotional regulation, social interaction, motivation drivers, and discipline patterns', icon: 'heart', color: '#4ECDC4' },
  { id: 'performance-prediction', name: 'Performance Prediction', description: 'AI-powered forecast of academic trajectory, risk indicators, and growth opportunity mapping', icon: 'trending-up', color: '#0B3C5D' },
  { id: 'exam-readiness', name: 'Exam Readiness', description: 'Assessment of content mastery, test-taking confidence, stress management, and time management readiness', icon: 'target', color: '#4ECDC4' },
  { id: 'lbi-comprehensive', name: 'LBI Comprehensive', description: 'Full Learning Behavior Index report covering all 19 domains (D01-D19) and 97 subdomains with cross-domain analysis', icon: 'sparkles', color: '#0B3C5D' },
];

const getIconForType = (iconName: string) => {
  switch (iconName) {
    case 'brain': return Brain;
    case 'heart': return Heart;
    case 'trending-up': return TrendingUp;
    case 'target': return Target;
    case 'sparkles': return Sparkles;
    default: return FileText;
  }
};

const getScoreColor = (score: number) => {
  if (score >= 80) return '#4ECDC4';
  if (score >= 60) return '#0B3C5D';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
};

const getScoreLabel = (score: number) => {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Strong';
  if (score >= 70) return 'Good';
  if (score >= 60) return 'Average';
  if (score >= 40) return 'Below Average';
  return 'Needs Improvement';
};

interface StudentReport {
  id: string;
  studentName: string;
  studentCode: string;
  class: string;
  section: string;
  batch: string;
  ageBand: 'A (6-10)' | 'B (11-14)' | 'C (15-18)';
  reportType: string;
  overallScore: number;
  assessmentDate: string;
  status: 'Completed' | 'Pending' | 'In Progress';
  domainScores: { domain: string; code: string; score: number }[];
  keyFindings: string[];
  recommendations: string[];
}

const SAMPLE_STUDENT_REPORTS: StudentReport[] = [
  {
    id: 'sr-1', studentName: 'Aarav Sharma', studentCode: 'STU-001', class: 'Class 8', section: 'A', batch: 'Grade 8 - Section A', ageBand: 'B (11-14)',
    reportType: 'LBI Comprehensive', overallScore: 78, assessmentDate: '2026-02-05', status: 'Completed',
    domainScores: [
      { domain: 'Learning Engagement', code: 'D01', score: 82 }, { domain: 'Cognitive Processing', code: 'D02', score: 75 },
      { domain: 'Emotional Regulation', code: 'D03', score: 68 }, { domain: 'Social Interaction', code: 'D04', score: 85 },
      { domain: 'Motivation & Drive', code: 'D05', score: 72 }, { domain: 'Attention & Focus', code: 'D06', score: 79 },
      { domain: 'Memory & Retention', code: 'D07', score: 81 }, { domain: 'Problem Solving', code: 'D08', score: 77 },
      { domain: 'Creative Thinking', code: 'D09', score: 83 }, { domain: 'Self-Awareness', code: 'D10', score: 65 },
      { domain: 'Time Management', code: 'D11', score: 70 }, { domain: 'Stress Response', code: 'D12', score: 58 },
      { domain: 'Help-Seeking', code: 'D13', score: 44 }, { domain: 'Discipline', code: 'D14', score: 89 },
      { domain: 'Confidence', code: 'D15', score: 71 }, { domain: 'Peer Collaboration', code: 'D16', score: 86 },
      { domain: 'Exam Readiness', code: 'D17', score: 76 }, { domain: 'Adaptability', code: 'D18', score: 80 },
      { domain: 'Communication', code: 'D19', score: 74 },
    ],
    keyFindings: ['Strong creative thinking and peer collaboration skills', 'Help-seeking behavior is significantly below average', 'Stress response needs attention during exam periods'],
    recommendations: ['Introduce structured check-ins to normalize help-seeking', 'Stress management workshops before exams', 'Leverage strong discipline for self-paced learning modules'],
  },
  {
    id: 'sr-2', studentName: 'Priya Patel', studentCode: 'STU-002', class: 'Class 10', section: 'B', batch: 'Grade 10 - Section B', ageBand: 'B (11-14)',
    reportType: 'Learning Analysis', overallScore: 85, assessmentDate: '2026-02-04', status: 'Completed',
    domainScores: [
      { domain: 'Learning Engagement', code: 'D01', score: 88 }, { domain: 'Cognitive Processing', code: 'D02', score: 90 },
      { domain: 'Emotional Regulation', code: 'D03', score: 82 }, { domain: 'Motivation & Drive', code: 'D05', score: 86 },
      { domain: 'Attention & Focus', code: 'D06', score: 84 }, { domain: 'Memory & Retention', code: 'D07', score: 87 },
    ],
    keyFindings: ['Exceptional cognitive processing and memory retention', 'Consistently high engagement across all subjects', 'Strong internal motivation'],
    recommendations: ['Provide advanced learning materials to challenge further', 'Consider mentorship role for peer support programs'],
  },
  {
    id: 'sr-3', studentName: 'Rahul Gupta', studentCode: 'STU-003', class: 'Class 7', section: 'A', batch: 'Grade 7 - Section A', ageBand: 'B (11-14)',
    reportType: 'Behavioral Insights', overallScore: 62, assessmentDate: '2026-02-03', status: 'Completed',
    domainScores: [
      { domain: 'Emotional Regulation', code: 'D03', score: 55 }, { domain: 'Social Interaction', code: 'D04', score: 68 },
      { domain: 'Self-Awareness', code: 'D10', score: 60 }, { domain: 'Stress Response', code: 'D12', score: 52 },
      { domain: 'Discipline', code: 'D14', score: 72 }, { domain: 'Confidence', code: 'D15', score: 58 },
    ],
    keyFindings: ['Emotional regulation needs significant support', 'Stress response below benchmark for age band', 'Discipline is a relative strength'],
    recommendations: ['Weekly counselor check-ins for emotional support', 'Gradual exposure therapy for test anxiety', 'Build confidence through small wins and positive reinforcement'],
  },
  {
    id: 'sr-4', studentName: 'Ananya Singh', studentCode: 'STU-004', class: 'Class 9', section: 'A', batch: 'Grade 9 - Section A', ageBand: 'C (15-18)',
    reportType: 'Exam Readiness', overallScore: 74, assessmentDate: '2026-02-06', status: 'Completed',
    domainScores: [
      { domain: 'Exam Readiness', code: 'D17', score: 76 }, { domain: 'Time Management', code: 'D11', score: 68 },
      { domain: 'Stress Response', code: 'D12', score: 70 }, { domain: 'Confidence', code: 'D15', score: 78 },
      { domain: 'Memory & Retention', code: 'D07', score: 80 },
    ],
    keyFindings: ['Good confidence level for exam scenarios', 'Time management needs improvement', 'Memory retention is strong'],
    recommendations: ['Practice timed tests regularly', 'Teach prioritization techniques for exam preparation'],
  },
  {
    id: 'sr-5', studentName: 'Vikram Reddy', studentCode: 'STU-005', class: 'Class 8', section: 'B', batch: 'Grade 8 - Section B', ageBand: 'B (11-14)',
    reportType: 'Performance Prediction', overallScore: 56, assessmentDate: '2026-02-01', status: 'Completed',
    domainScores: [
      { domain: 'Learning Engagement', code: 'D01', score: 52 }, { domain: 'Motivation & Drive', code: 'D05', score: 48 },
      { domain: 'Attention & Focus', code: 'D06', score: 55 }, { domain: 'Problem Solving', code: 'D08', score: 62 },
      { domain: 'Adaptability', code: 'D18', score: 58 },
    ],
    keyFindings: ['At-risk: declining engagement and motivation', 'Attention span below age-band benchmark', 'Problem solving shows potential'],
    recommendations: ['Immediate intervention: motivation coaching sessions', 'Structured daily learning schedule', 'Gamified learning modules to boost engagement'],
  },
  {
    id: 'sr-6', studentName: 'Meera Joshi', studentCode: 'STU-006', class: 'Class 10', section: 'A', batch: 'Grade 10 - Section A', ageBand: 'C (15-18)',
    reportType: 'LBI Comprehensive', overallScore: 91, assessmentDate: '2026-02-05', status: 'Completed',
    domainScores: [
      { domain: 'Learning Engagement', code: 'D01', score: 94 }, { domain: 'Cognitive Processing', code: 'D02', score: 92 },
      { domain: 'Emotional Regulation', code: 'D03', score: 88 }, { domain: 'Social Interaction', code: 'D04', score: 90 },
      { domain: 'Motivation & Drive', code: 'D05', score: 93 }, { domain: 'Attention & Focus', code: 'D06', score: 89 },
      { domain: 'Memory & Retention', code: 'D07', score: 91 }, { domain: 'Problem Solving', code: 'D08', score: 87 },
      { domain: 'Creative Thinking', code: 'D09', score: 95 }, { domain: 'Self-Awareness', code: 'D10', score: 90 },
      { domain: 'Time Management', code: 'D11', score: 86 }, { domain: 'Stress Response', code: 'D12', score: 85 },
      { domain: 'Help-Seeking', code: 'D13', score: 92 }, { domain: 'Discipline', code: 'D14', score: 94 },
      { domain: 'Confidence', code: 'D15', score: 91 }, { domain: 'Peer Collaboration', code: 'D16', score: 93 },
      { domain: 'Exam Readiness', code: 'D17', score: 88 }, { domain: 'Adaptability', code: 'D18', score: 90 },
      { domain: 'Communication', code: 'D19', score: 89 },
    ],
    keyFindings: ['Top performer across all 19 domains', 'Exceptional creative thinking and discipline', 'Leadership potential identified'],
    recommendations: ['Advanced enrichment programs', 'Leadership role in peer mentoring', 'Prepare for competitive academic opportunities'],
  },
  {
    id: 'sr-7', studentName: 'Arjun Kumar', studentCode: 'STU-007', class: 'Class 7', section: 'B', batch: 'Grade 7 - Section B', ageBand: 'B (11-14)',
    reportType: 'Behavioral Insights', overallScore: 0, assessmentDate: '2026-02-07', status: 'Pending',
    domainScores: [], keyFindings: [], recommendations: [],
  },
  {
    id: 'sr-8', studentName: 'Kavya Nair', studentCode: 'STU-008', class: 'Class 9', section: 'B', batch: 'Grade 9 - Section B', ageBand: 'C (15-18)',
    reportType: 'Learning Analysis', overallScore: 0, assessmentDate: '2026-02-07', status: 'In Progress',
    domainScores: [], keyFindings: [], recommendations: [],
  },
];

const downloadCSV = (data: StudentReport[], filename: string) => {
  const headers = ['Student Name', 'Student Code', 'Class', 'Section', 'Batch', 'Age Band', 'Report Type', 'Overall Score', 'Assessment Date', 'Status'];
  const rows = data.map(r => [r.studentName, r.studentCode, r.class, r.section, r.batch, r.ageBand, r.reportType, r.status === 'Completed' ? r.overallScore : '', r.assessmentDate, r.status]);
  const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const downloadStudentReport = (sr: StudentReport) => {
  const lines: string[] = [
    `LBI Assessment Report - ${sr.studentName}`,
    `Student Code: ${sr.studentCode}`,
    `Class: ${sr.class} ${sr.section} | Batch: ${sr.batch} | Age Band: ${sr.ageBand}`,
    `Report Type: ${sr.reportType}`,
    `Assessment Date: ${sr.assessmentDate}`,
    `Overall LBI Score: ${sr.overallScore}/100 (${getScoreLabel(sr.overallScore)})`,
    '',
    '--- Domain Scores ---',
    ...sr.domainScores.map(d => `${d.code} - ${d.domain}: ${d.score}/100 (${getScoreLabel(d.score)})`),
    '',
    '--- Key Findings ---',
    ...sr.keyFindings.map((f, i) => `${i + 1}. ${f}`),
    '',
    '--- Recommendations ---',
    ...sr.recommendations.map((r, i) => `${i + 1}. ${r}`),
    '',
    `Generated by MetryxOne | DPDP Compliant | SOC2 Certified`,
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `LBI_Report_${sr.studentName.replace(/\s+/g, '_')}_${sr.assessmentDate}.txt`;
  a.click();
  URL.revokeObjectURL(url);
};

const printStudentReport = (sr: StudentReport) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  const html = `<html><head><title>LBI Report - ${sr.studentName}</title><style>body{font-family:Inter,sans-serif;padding:40px;color:#1e293b}h1{color:#0B3C5D;font-size:24px}h2{color:#0B3C5D;font-size:16px;margin-top:24px;border-bottom:2px solid #4ECDC4;padding-bottom:4px}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #e2e8f0;padding:8px 12px;text-align:left;font-size:13px}th{background:#0B3C5D;color:white}li{margin-bottom:6px;font-size:13px}.score{font-size:48px;font-weight:bold;color:#0B3C5D;text-align:center}.meta{color:#64748b;font-size:13px;margin-bottom:4px}</style></head><body>
  <h1>LBI Assessment Report</h1>
  <p class="meta"><strong>${sr.studentName}</strong> (${sr.studentCode}) | ${sr.class} ${sr.section} | ${sr.batch}</p>
  <p class="meta">Age Band: ${sr.ageBand} | Report Type: ${sr.reportType} | Date: ${sr.assessmentDate}</p>
  <div class="score">${sr.overallScore}/100</div>
  <p style="text-align:center;color:#64748b;font-size:14px">${getScoreLabel(sr.overallScore)}</p>
  <h2>Domain Scores</h2>
  <table><tr><th>Code</th><th>Domain</th><th>Score</th><th>Rating</th></tr>${sr.domainScores.map(d => `<tr><td>${d.code}</td><td>${d.domain}</td><td>${d.score}/100</td><td>${getScoreLabel(d.score)}</td></tr>`).join('')}</table>
  <h2>Key Findings</h2><ul>${sr.keyFindings.map(f => `<li>${f}</li>`).join('')}</ul>
  <h2>Recommendations</h2><ul>${sr.recommendations.map(r => `<li>${r}</li>`).join('')}</ul>
  <hr style="margin-top:30px"><p style="font-size:11px;color:#94a3b8">Generated by MetryxOne | DPDP Compliant | SOC2 Type II Certified</p>
  </body></html>`;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.print();
};

const CLASSES = ['All Classes', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'];
const BATCHES = ['All Batches', 'Grade 7 - Section A', 'Grade 7 - Section B', 'Grade 8 - Section A', 'Grade 8 - Section B', 'Grade 9 - Section A', 'Grade 9 - Section B', 'Grade 10 - Section A', 'Grade 10 - Section B'];
const AGE_BANDS = ['All Age Bands', 'A (6-10)', 'B (11-14)', 'C (15-18)'];
const REPORT_TYPE_FILTERS = ['All Types', 'LBI Comprehensive', 'Learning Analysis', 'Behavioral Insights', 'Performance Prediction', 'Exam Readiness'];
const STATUS_FILTERS = ['All Status', 'Completed', 'Pending', 'In Progress'];

export function AIPoweredReports({ childName, childAge, childGrade, childId, role = 'parent', onNavigate }: Props) {
  const [showLanding, setShowLanding] = useState(true);
  const [selectedReportType, setSelectedReportType] = useState<string | null>(null);
  const [generatedReport, setGeneratedReport] = useState<AIReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportHistory, setReportHistory] = useState<AIReport[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState('All Classes');
  const [filterBatch, setFilterBatch] = useState('All Batches');
  const [filterAgeBand, setFilterAgeBand] = useState('All Age Bands');
  const [filterReportType, setFilterReportType] = useState('All Types');
  const [filterStatus, setFilterStatus] = useState('All Status');
  const [selectedStudentReport, setSelectedStudentReport] = useState<StudentReport | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'analytics'>('list');

  const handleGenerateReport = async (reportType: string) => {
    setIsGenerating(true);
    setError(null);
    setSelectedReportType(reportType);

    try {
      const response = await fetch('/api/ai-reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType,
          childName: childName || 'Student',
          childAge: childAge || 14,
          childGrade: childGrade || 'Grade 9',
          childId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      const report = await response.json();
      setGeneratedReport(report);
      setReportHistory(prev => [report, ...prev.slice(0, 4)]);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBackToTypes = () => {
    setGeneratedReport(null);
    setSelectedReportType(null);
    setError(null);
  };

  const filteredReports = SAMPLE_STUDENT_REPORTS.filter(r => {
    const matchSearch = !searchQuery || r.studentName.toLowerCase().includes(searchQuery.toLowerCase()) || r.studentCode.toLowerCase().includes(searchQuery.toLowerCase());
    const matchClass = filterClass === 'All Classes' || r.class === filterClass;
    const matchBatch = filterBatch === 'All Batches' || r.batch === filterBatch;
    const matchAge = filterAgeBand === 'All Age Bands' || r.ageBand === filterAgeBand;
    const matchType = filterReportType === 'All Types' || r.reportType === filterReportType;
    const matchStatus = filterStatus === 'All Status' || r.status === filterStatus;
    return matchSearch && matchClass && matchBatch && matchAge && matchType && matchStatus;
  });

  const completedReports = SAMPLE_STUDENT_REPORTS.filter(r => r.status === 'Completed');
  const avgScore = completedReports.length > 0 ? Math.round(completedReports.reduce((s, r) => s + r.overallScore, 0) / completedReports.length) : 0;
  const atRiskCount = completedReports.filter(r => r.overallScore < 60).length;
  const topPerformers = completedReports.filter(r => r.overallScore >= 85).length;

  if (role === 'institute') {
    if (selectedStudentReport) {
      const sr = selectedStudentReport;
      return (
        <div className="space-y-4" data-testid="student-report-detail">
          <Card className="border-0 shadow-sm" style={{ backgroundColor: brand.primary }}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <FileText size={20} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">{sr.studentName} — LBI Report</h3>
                    <p className="text-white/70 text-xs">{sr.studentCode} · {sr.class} {sr.section} · {sr.batch} · Age Band {sr.ageBand}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10 text-xs gap-1" onClick={() => downloadStudentReport(sr)} data-testid="btn-download-student-pdf">
                    <Download size={14} /> Download
                  </Button>
                  <Button size="sm" variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10 text-xs gap-1" onClick={() => printStudentReport(sr)} data-testid="btn-print-student">
                    <Printer size={14} /> Print
                  </Button>
                  <Button size="sm" className="bg-white/20 hover:bg-white/30 text-white text-xs" onClick={() => setSelectedStudentReport(null)} data-testid="btn-back-to-list">
                    <X size={14} className="mr-1" /> Back to List
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <div className="h-14 w-14 rounded-2xl mx-auto flex items-center justify-center mb-2" style={{ backgroundColor: `${getScoreColor(sr.overallScore)}15` }}>
                  <span className="text-xl font-bold" style={{ color: getScoreColor(sr.overallScore) }}>{sr.overallScore}</span>
                </div>
                <p className="text-[10px] font-semibold" style={{ color: getScoreColor(sr.overallScore) }}>{getScoreLabel(sr.overallScore)}</p>
                <p className="text-[9px] text-gray-400 mt-0.5">Overall LBI Score</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <p className="text-xl font-bold" style={{ color: brand.primary }}>{sr.domainScores.length}</p>
                <p className="text-[10px] text-gray-500 mt-1">Domains Assessed</p>
                <p className="text-[9px] text-gray-400">of 19 total</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <p className="text-xl font-bold" style={{ color: brand.accent }}>{sr.reportType}</p>
                <p className="text-[10px] text-gray-500 mt-1">Report Type</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 text-center">
                <p className="text-xl font-bold" style={{ color: brand.primary }}>{new Date(sr.assessmentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                <p className="text-[10px] text-gray-500 mt-1">Assessment Date</p>
              </CardContent>
            </Card>
          </div>

          {sr.domainScores.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ color: brand.primary }}>
                  <BarChart3 size={16} style={{ color: brand.accent }} /> Domain Scorecard ({sr.domainScores.length} Domains)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {sr.domainScores.map((ds, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2.5 rounded-lg border" data-testid={`domain-score-${ds.code}`}>
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold text-white" style={{ backgroundColor: getScoreColor(ds.score) }}>
                        {ds.code}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary, #1e293b)' }}>{ds.domain}</span>
                          <span className="text-xs font-bold shrink-0 ml-2" style={{ color: getScoreColor(ds.score) }}>{ds.score}/100</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100">
                          <div className="h-full rounded-full transition-all" style={{ width: `${ds.score}%`, backgroundColor: getScoreColor(ds.score) }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sr.keyFindings.length > 0 && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ color: brand.primary }}>
                    <Lightbulb size={16} style={{ color: brand.accent }} /> Key Findings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {sr.keyFindings.map((f, i) => (
                      <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg" style={{ backgroundColor: `${brand.primary}06` }}>
                        <div className="h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: brand.accent, color: 'white' }}>
                          <span className="text-[9px] font-bold">{i + 1}</span>
                        </div>
                        <p className="text-xs text-gray-600">{f}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {sr.recommendations.length > 0 && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ color: brand.primary }}>
                    <Target size={16} style={{ color: brand.accent }} /> Recommendations & Action Plan
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {sr.recommendations.map((r, i) => (
                      <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg border">
                        <ArrowRight size={14} className="mt-0.5 shrink-0" style={{ color: brand.accent }} />
                        <p className="text-xs text-gray-600">{r}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <Card className="border-0 shadow-sm" style={{ backgroundColor: `${brand.accent}05` }}>
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield size={14} style={{ color: brand.accent }} />
                  <span className="text-[10px] text-gray-500">DPDP Compliant · SOC2 Certified · Parental Consent Verified · Report ID: {sr.id}</span>
                </div>
                <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => downloadStudentReport(sr)} data-testid="btn-download-full-report">
                  <FileDown size={12} /> Download Full Report
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-4" data-testid="institute-reports-dashboard">
        <Card className="border-0 shadow-sm" style={{ backgroundColor: brand.primary }}>
          <CardContent className="py-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <Sparkles size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">LBI Assessment Reports</h2>
                  <p className="text-white/70 text-xs">{SAMPLE_STUDENT_REPORTS.length} students assessed · View & download reports by student, class, or batch</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-white/10 rounded-lg p-1">
                  <Button
                    size="sm"
                    className={`text-xs px-3 h-7 ${viewMode === 'list' ? 'bg-white text-gray-900' : 'bg-transparent text-white/70 hover:text-white'}`}
                    onClick={() => setViewMode('list')}
                    data-testid="btn-view-list"
                  >
                    <FileText size={12} className="mr-1" /> Reports
                  </Button>
                  <Button
                    size="sm"
                    className={`text-xs px-3 h-7 ${viewMode === 'analytics' ? 'bg-white text-gray-900' : 'bg-transparent text-white/70 hover:text-white'}`}
                    onClick={() => setViewMode('analytics')}
                    data-testid="btn-view-analytics"
                  >
                    <PieChart size={12} className="mr-1" /> Analytics
                  </Button>
                </div>
                <Button size="sm" className="bg-white/20 hover:bg-white/30 text-white text-xs gap-1" onClick={() => downloadCSV(filteredReports, 'LBI_Assessment_Reports')} data-testid="btn-export-all">
                  <Download size={14} /> Export All
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Total Assessed', value: SAMPLE_STUDENT_REPORTS.length, icon: Users, color: brand.primary },
            { label: 'Completed', value: completedReports.length, icon: CheckCircle, color: '#4ECDC4' },
            { label: 'Avg LBI Score', value: avgScore, icon: BarChart3, color: brand.accent },
            { label: 'At Risk (<60)', value: atRiskCount, icon: AlertTriangle, color: '#ef4444' },
            { label: 'Top Performers (85+)', value: topPerformers, icon: Award, color: '#0B3C5D' },
          ].map((stat, i) => (
            <Card key={i} className="border-0 shadow-sm" data-testid={`stat-report-${i}`}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${stat.color}12` }}>
                    <stat.icon size={16} style={{ color: stat.color }} />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-gray-900">{stat.value}</p>
                    <p className="text-[9px] text-gray-500">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {viewMode === 'analytics' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ color: brand.primary }}>
                  <PieChart size={14} style={{ color: brand.accent }} /> Score Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { range: '90-100 (Excellent)', count: completedReports.filter(r => r.overallScore >= 90).length, color: '#4ECDC4', pct: 0 },
                    { range: '80-89 (Strong)', count: completedReports.filter(r => r.overallScore >= 80 && r.overallScore < 90).length, color: brand.accent, pct: 0 },
                    { range: '70-79 (Good)', count: completedReports.filter(r => r.overallScore >= 70 && r.overallScore < 80).length, color: brand.primary, pct: 0 },
                    { range: '60-69 (Average)', count: completedReports.filter(r => r.overallScore >= 60 && r.overallScore < 70).length, color: '#f59e0b', pct: 0 },
                    { range: 'Below 60 (At Risk)', count: completedReports.filter(r => r.overallScore < 60).length, color: '#ef4444', pct: 0 },
                  ].map((d, i) => {
                    const pct = completedReports.length > 0 ? Math.round((d.count / completedReports.length) * 100) : 0;
                    return (
                      <div key={i} data-testid={`dist-row-${i}`}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-600">{d.range}</span>
                          <span className="font-bold" style={{ color: d.color }}>{d.count} ({pct}%)</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: d.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ color: brand.primary }}>
                  <Activity size={14} style={{ color: brand.accent }} /> Weakest Domains (Across All Students)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const domainAgg: Record<string, { total: number; count: number; code: string }> = {};
                  completedReports.forEach(r => {
                    r.domainScores.forEach(ds => {
                      if (!domainAgg[ds.domain]) domainAgg[ds.domain] = { total: 0, count: 0, code: ds.code };
                      domainAgg[ds.domain].total += ds.score;
                      domainAgg[ds.domain].count += 1;
                    });
                  });
                  const sorted = Object.entries(domainAgg)
                    .map(([name, { total, count, code }]) => ({ name, avg: Math.round(total / count), code }))
                    .sort((a, b) => a.avg - b.avg)
                    .slice(0, 6);

                  return (
                    <div className="space-y-2.5">
                      {sorted.map((d, i) => (
                        <div key={i} className="flex items-center gap-3" data-testid={`weak-domain-${d.code}`}>
                          <div className="h-7 w-7 rounded-md flex items-center justify-center shrink-0 text-[9px] font-bold text-white" style={{ backgroundColor: getScoreColor(d.avg) }}>
                            {d.code}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between text-xs mb-0.5">
                              <span className="font-medium text-gray-700 truncate">{d.name}</span>
                              <span className="font-bold" style={{ color: getScoreColor(d.avg) }}>{d.avg}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-gray-100">
                              <div className="h-full rounded-full" style={{ width: `${d.avg}%`, backgroundColor: getScoreColor(d.avg) }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ color: brand.primary }}>
                  <Layers size={14} style={{ color: brand.accent }} /> Reports by Class
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {['Class 7', 'Class 8', 'Class 9', 'Class 10'].map(cls => {
                    const classReports = completedReports.filter(r => r.class === cls);
                    const classAvg = classReports.length > 0 ? Math.round(classReports.reduce((s, r) => s + r.overallScore, 0) / classReports.length) : 0;
                    return (
                      <div key={cls} className="flex items-center justify-between p-2.5 rounded-lg border cursor-pointer hover:shadow-sm" onClick={() => setFilterClass(cls)} data-testid={`class-row-${cls.replace(' ', '-')}`}>
                        <div className="flex items-center gap-2">
                          <GraduationCap size={14} style={{ color: brand.primary }} />
                          <span className="text-xs font-medium">{cls}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-gray-500">{classReports.length} students</span>
                          <Badge className="text-[10px]" style={{ backgroundColor: `${getScoreColor(classAvg)}15`, color: getScoreColor(classAvg) }}>
                            Avg: {classAvg}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ color: brand.primary }}>
                  <Users size={14} style={{ color: brand.accent }} /> Report Type Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {REPORT_TYPES.map(rt => {
                    const Icon = getIconForType(rt.icon);
                    const count = SAMPLE_STUDENT_REPORTS.filter(r => r.reportType === rt.name).length;
                    return (
                      <div key={rt.id} className="flex items-center justify-between p-2.5 rounded-lg border cursor-pointer hover:shadow-sm" onClick={() => { setFilterReportType(rt.name); setViewMode('list'); }} data-testid={`type-row-${rt.id}`}>
                        <div className="flex items-center gap-2">
                          <Icon size={14} style={{ color: rt.color }} />
                          <span className="text-xs font-medium">{rt.name}</span>
                        </div>
                        <Badge variant="outline" className="text-[10px]">{count}</Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {viewMode === 'list' && (
          <>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-3">
                <div className="flex flex-col md:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by student name or code..."
                      className="h-8 text-xs pl-8"
                      data-testid="input-search-reports"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)} className="h-8 text-xs border rounded-md px-2 bg-white" data-testid="select-filter-class">
                      {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={filterBatch} onChange={(e) => setFilterBatch(e.target.value)} className="h-8 text-xs border rounded-md px-2 bg-white" data-testid="select-filter-batch">
                      {BATCHES.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <select value={filterAgeBand} onChange={(e) => setFilterAgeBand(e.target.value)} className="h-8 text-xs border rounded-md px-2 bg-white" data-testid="select-filter-age">
                      {AGE_BANDS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <select value={filterReportType} onChange={(e) => setFilterReportType(e.target.value)} className="h-8 text-xs border rounded-md px-2 bg-white" data-testid="select-filter-type">
                      {REPORT_TYPE_FILTERS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="h-8 text-xs border rounded-md px-2 bg-white" data-testid="select-filter-status">
                      {STATUS_FILTERS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {(filterClass !== 'All Classes' || filterBatch !== 'All Batches' || filterAgeBand !== 'All Age Bands' || filterReportType !== 'All Types' || filterStatus !== 'All Status' || searchQuery) && (
                      <Button variant="ghost" size="sm" className="h-8 text-xs text-red-500 hover:text-red-700" onClick={() => { setFilterClass('All Classes'); setFilterBatch('All Batches'); setFilterAgeBand('All Age Bands'); setFilterReportType('All Types'); setFilterStatus('All Status'); setSearchQuery(''); }} data-testid="btn-clear-filters">
                        <X size={12} className="mr-1" /> Clear
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b" style={{ backgroundColor: `${brand.primary}06` }}>
                        <th className="text-left py-2.5 px-3 font-semibold text-gray-600">Student</th>
                        <th className="text-left py-2.5 px-3 font-semibold text-gray-600">Class / Batch</th>
                        <th className="text-left py-2.5 px-3 font-semibold text-gray-600">Age Band</th>
                        <th className="text-left py-2.5 px-3 font-semibold text-gray-600">Report Type</th>
                        <th className="text-center py-2.5 px-3 font-semibold text-gray-600">LBI Score</th>
                        <th className="text-left py-2.5 px-3 font-semibold text-gray-600">Date</th>
                        <th className="text-center py-2.5 px-3 font-semibold text-gray-600">Status</th>
                        <th className="text-center py-2.5 px-3 font-semibold text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReports.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-10 text-gray-400">
                            <FileText size={32} className="mx-auto mb-2 opacity-30" />
                            <p className="text-sm font-medium text-gray-500">No reports match the filters</p>
                            <p className="text-[10px] text-gray-400">Try adjusting your search or filter criteria</p>
                          </td>
                        </tr>
                      ) : (
                        filteredReports.map((r) => {
                          const statusStyles: Record<string, { bg: string; text: string }> = {
                            'Completed': { bg: 'bg-teal-50', text: 'text-teal-600' },
                            'Pending': { bg: 'bg-amber-50', text: 'text-amber-600' },
                            'In Progress': { bg: 'bg-blue-50', text: 'text-blue-600' },
                          };
                          const st = statusStyles[r.status] || statusStyles['Pending'];
                          return (
                            <tr key={r.id} className="border-b hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => r.status === 'Completed' && setSelectedStudentReport(r)} data-testid={`report-row-${r.id}`}>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-2">
                                  <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold text-white" style={{ backgroundColor: brand.primary }}>
                                    {r.studentName.split(' ').map(n => n[0]).join('')}
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium text-gray-900">{r.studentName}</p>
                                    <p className="text-[10px] text-gray-400">{r.studentCode}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                <p className="text-xs text-gray-700">{r.class} - {r.section}</p>
                                <p className="text-[10px] text-gray-400">{r.batch}</p>
                              </td>
                              <td className="py-2.5 px-3">
                                <Badge variant="outline" className="text-[10px]">{r.ageBand}</Badge>
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="text-xs text-gray-700">{r.reportType}</span>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {r.status === 'Completed' ? (
                                  <span className="text-sm font-bold" style={{ color: getScoreColor(r.overallScore) }}>{r.overallScore}</span>
                                ) : (
                                  <span className="text-xs text-gray-400">—</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="text-xs text-gray-500">{new Date(r.assessmentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <Badge className={`${st.bg} ${st.text} text-[10px]`}>{r.status}</Badge>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {r.status === 'Completed' && (
                                    <>
                                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); setSelectedStudentReport(r); }} data-testid={`btn-view-${r.id}`}>
                                        <Eye size={13} className="text-gray-500" />
                                      </Button>
                                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); downloadStudentReport(r); }} data-testid={`btn-download-${r.id}`}>
                                        <Download size={13} className="text-gray-500" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm" style={{ backgroundColor: `${brand.accent}05` }}>
              <CardContent className="py-3">
                <div className="flex items-center gap-2">
                  <Shield size={12} style={{ color: brand.accent }} />
                  <span className="text-[10px] text-gray-500">All reports are DPDP Act compliant with verified parental consent · SOC2 Type II Certified · Data encrypted at rest</span>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className="space-y-6" data-testid="ai-reports-generating">
        <Card className="border-0 shadow-lg overflow-hidden" style={{ backgroundColor: brand.primary }}>
          <CardContent className="py-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Sparkles size={24} className="text-white animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">AI-Powered Reports</h3>
                <p className="text-white/70 text-sm">Generating your report...</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="py-16 text-center">
            <div className="relative inline-block mb-6">
              <div className="h-20 w-20 rounded-full flex items-center justify-center mx-auto" style={{ backgroundColor: `${brand.accent}15` }}>
                <Loader2 size={40} className="animate-spin" style={{ color: brand.accent }} />
              </div>
              <div className="absolute -top-1 -right-1">
                <Sparkles size={20} className="animate-pulse" style={{ color: brand.accent }} />
              </div>
            </div>
            <h4 className="text-lg font-semibold mb-2" style={{ color: brand.primary }}>
              Generating {REPORT_TYPES.find(r => r.id === selectedReportType)?.name}
            </h4>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              Our AI is analyzing learning patterns and generating personalized insights for {childName || 'the student'}. This usually takes 10-15 seconds.
            </p>
            <div className="max-w-xs mx-auto">
              <Progress value={65} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">Analyzing data...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6" data-testid="ai-reports-error">
        <Card className="border-0 shadow-lg overflow-hidden" style={{ backgroundColor: brand.primary }}>
          <CardContent className="py-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Sparkles size={24} className="text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">AI-Powered Reports</h3>
                <p className="text-white/70 text-sm">Report generation encountered an issue</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="py-12 text-center">
            <AlertTriangle size={48} className="mx-auto mb-4 text-amber-500" />
            <h4 className="text-lg font-semibold mb-2" style={{ color: brand.primary }}>Unable to Generate Report</h4>
            <p className="text-sm text-muted-foreground mb-6">{error}</p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={handleBackToTypes} data-testid="btn-back-to-types">
                Choose Different Report
              </Button>
              <Button
                style={{ backgroundColor: brand.accent }}
                className="text-white"
                onClick={() => selectedReportType && handleGenerateReport(selectedReportType)}
                data-testid="btn-retry-report"
              >
                <RefreshCw size={16} className="mr-2" /> Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (generatedReport) {
    const reportTypeInfo = REPORT_TYPES.find(r => r.id === generatedReport.reportType);
    const ReportIcon = getIconForType(reportTypeInfo?.icon || 'sparkles');

    return (
      <div className="space-y-4" data-testid="ai-report-result">
        <Card className="border-0 shadow-lg overflow-hidden" style={{ backgroundColor: brand.primary }}>
          <CardContent className="py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <ReportIcon size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{generatedReport.title}</h3>
                  <p className="text-white/70 text-xs">
                    Generated for {generatedReport.childName || childName || 'Student'} · {new Date(generatedReport.generatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white/80 hover:text-white hover:bg-white/10"
                  onClick={handleBackToTypes}
                  data-testid="btn-new-report"
                >
                  <RefreshCw size={14} className="mr-1" /> New Report
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {generatedReport.preview && (
          <Card className="border shadow-sm" style={{ borderColor: '#f59e0b66', backgroundColor: '#fffbeb' }}>
            <CardContent className="py-3.5 flex items-start gap-2.5">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: '#b45309' }} />
              <div>
                <p className="text-xs font-semibold" style={{ color: '#92400e' }}>Preview — no measured scores yet</p>
                <p className="text-[11px] mt-0.5" style={{ color: '#92400e' }}>
                  {generatedReport.disclaimer ||
                    'This report contains qualitative guidance only. Numeric LBI scores appear once a measured assessment is completed.'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border shadow-sm">
            <CardContent className="py-5 text-center">
              {typeof generatedReport.overallScore === 'number' ? (
                <>
                  <div
                    className="h-16 w-16 rounded-full mx-auto flex items-center justify-center mb-3"
                    style={{ backgroundColor: `${getScoreColor(generatedReport.overallScore)}15` }}
                  >
                    <span className="text-2xl font-bold" style={{ color: getScoreColor(generatedReport.overallScore) }}>
                      {generatedReport.overallScore}
                    </span>
                  </div>
                  <p className="text-xs font-medium" style={{ color: getScoreColor(generatedReport.overallScore) }}>
                    {getScoreLabel(generatedReport.overallScore)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Overall LBI Score{generatedReport.scoreSource === 'lbi_engine' ? ' · measured' : ''}
                  </p>
                </>
              ) : (
                <>
                  <div className="h-16 w-16 rounded-full mx-auto flex items-center justify-center mb-3 bg-muted">
                    <span className="text-2xl font-bold text-muted-foreground">—</span>
                  </div>
                  <p className="text-xs font-medium text-muted-foreground">Not yet measured</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Overall LBI Score</p>
                </>
              )}
            </CardContent>
          </Card>
          <Card className="border shadow-sm md:col-span-2">
            <CardContent className="py-5">
              <h4 className="text-sm font-semibold mb-2" style={{ color: brand.primary }}>Executive Summary</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{generatedReport.summary}</p>
            </CardContent>
          </Card>
        </div>

        {generatedReport.dimensions && generatedReport.dimensions.length > 0 && (
          <Card className="border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ color: brand.primary }}>
                <BarChart3 size={16} style={{ color: brand.accent }} /> Measured Behavioural Dimensions
                <Badge className="text-[9px] h-5 px-1.5 bg-emerald-100 text-emerald-700">auditable engine</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {generatedReport.dimensions.map((dim) => (
                  <div key={dim.key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium" style={{ color: brand.primary }}>{dim.label}</span>
                      <span className="text-xs font-bold" style={{ color: getScoreColor(dim.score) }}>{dim.score}/100</span>
                    </div>
                    <Progress value={dim.score} className="h-1.5" />
                  </div>
                ))}
              </div>
              {generatedReport.learningStyle && (
                <p className="text-[11px] text-muted-foreground mt-3">
                  Dominant learning style: <span className="font-medium">{generatedReport.learningStyle}</span>
                  {typeof generatedReport.sessionsAnalyzed === 'number' && ` · ${generatedReport.sessionsAnalyzed} session(s) analysed`}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ color: brand.primary }}>
              <BarChart3 size={16} style={{ color: brand.accent }} /> Detailed Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {generatedReport.sections.map((section, idx) => (
                <div key={idx} className="border rounded-lg p-4" data-testid={`report-section-${idx}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-sm font-semibold" style={{ color: brand.primary }}>{section.name}</h5>
                    {typeof section.score === 'number' && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold" style={{ color: getScoreColor(section.score) }}>
                          {section.score}/100
                        </span>
                        <Badge
                          className="text-[9px] h-5 px-1.5"
                          style={{
                            backgroundColor: `${getScoreColor(section.score)}15`,
                            color: getScoreColor(section.score),
                          }}
                        >
                          {getScoreLabel(section.score)}
                        </Badge>
                      </div>
                    )}
                  </div>
                  {typeof section.score === 'number' && <Progress value={section.score} className="h-1.5 mb-3" />}
                  <div className="space-y-1.5 mb-3">
                    {section.findings.map((finding, fIdx) => (
                      <div key={fIdx} className="flex items-start gap-2">
                        <CheckCircle size={12} className="mt-0.5 shrink-0" style={{ color: brand.accent }} />
                        <p className="text-xs text-muted-foreground">{finding}</p>
                      </div>
                    ))}
                  </div>
                  <div className="p-2.5 rounded-md" style={{ backgroundColor: `${brand.accent}08` }}>
                    <div className="flex items-start gap-2">
                      <Lightbulb size={12} className="mt-0.5 shrink-0" style={{ color: brand.accent }} />
                      <p className="text-xs" style={{ color: brand.primary }}>
                        <span className="font-medium">Recommendation:</span> {section.recommendation}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ color: brand.primary }}>
                <Sparkles size={16} style={{ color: brand.accent }} /> Key Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {generatedReport.keyInsights.map((insight, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-2.5 rounded-lg" style={{ backgroundColor: `${brand.primary}06` }}>
                    <div className="h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: brand.accent, color: 'white' }}>
                      <span className="text-[9px] font-bold">{idx + 1}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{insight}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ color: brand.primary }}>
                <Target size={16} style={{ color: brand.accent }} /> Action Plan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {generatedReport.actionPlan.map((action, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-2.5 rounded-lg border">
                    <ArrowRight size={14} className="mt-0.5 shrink-0" style={{ color: brand.accent }} />
                    <p className="text-xs text-muted-foreground">{action}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border shadow-sm">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Report generated on {new Date(generatedReport.generatedAt).toLocaleString()}
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => {
                  const lines = [
                    `AI-Powered Report: ${generatedReport.title}`,
                    `Generated for: ${generatedReport.childName || childName || 'Student'}`,
                    `Report Type: ${generatedReport.reportType}`,
                    `Date: ${new Date(generatedReport.generatedAt).toLocaleString()}`,
                    typeof generatedReport.overallScore === 'number'
                      ? `Overall LBI Score: ${generatedReport.overallScore}/100 (${getScoreLabel(generatedReport.overallScore)})`
                      : `Overall LBI Score: Not yet measured (preview — qualitative guidance only)`,
                    ...(generatedReport.dimensions && generatedReport.dimensions.length > 0
                      ? ['', '--- Measured Behavioural Dimensions ---', ...generatedReport.dimensions.map(d => `${d.label}: ${d.score}/100`)]
                      : []),
                    '',
                    '--- Executive Summary ---',
                    generatedReport.summary,
                    '',
                    '--- Detailed Analysis ---',
                    ...generatedReport.sections.flatMap(s => [`\n${s.name}${typeof s.score === 'number' ? `: ${s.score}/100 (${getScoreLabel(s.score)})` : ''}`, ...s.findings.map(f => `  - ${f}`), `  Recommendation: ${s.recommendation}`]),
                    '',
                    '--- Key Insights ---',
                    ...generatedReport.keyInsights.map((k, i) => `${i + 1}. ${k}`),
                    '',
                    '--- Action Plan ---',
                    ...generatedReport.actionPlan.map((a, i) => `${i + 1}. ${a}`),
                    '',
                    'Generated by MetryxOne | DPDP Compliant | SOC2 Certified',
                  ];
                  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `AI_Report_${generatedReport.reportType}_${new Date(generatedReport.generatedAt).toISOString().slice(0,10)}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }} data-testid="btn-download-report">
                  <Download size={12} className="mr-1" /> Download Report
                </Button>
                <Button
                  size="sm"
                  className="text-xs h-8 text-white"
                  style={{ backgroundColor: brand.accent }}
                  onClick={handleBackToTypes}
                  data-testid="btn-generate-another"
                >
                  <Sparkles size={12} className="mr-1" /> Generate Another
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showLanding) {
    const FEATURES = [
      { icon: Brain, title: 'Learning Pattern Analysis', desc: 'AI identifies unique learning styles, cognitive strengths, and areas where students absorb information most effectively.' },
      { icon: Heart, title: 'Behavioral & Emotional Insights', desc: 'Understand emotional regulation, motivation drivers, social interaction patterns, and stress responses.' },
      { icon: TrendingUp, title: 'Performance Prediction', desc: 'Data-driven forecasts of academic trajectory with early risk detection and growth opportunity mapping.' },
      { icon: Target, title: 'Exam Readiness Assessment', desc: 'Evaluate content mastery, test-taking confidence, time management, and stress preparedness before exams.' },
      { icon: BookOpen, title: 'LBI Comprehensive Report', desc: 'Full Learning Behavior Index covering all 19 domains (D01-D19) and 97 subdomains for complete profiling.' },
      { icon: Shield, title: 'Privacy & Consent Compliant', desc: 'All assessments follow DPDP Act guidelines with full parental consent and secure data handling.' },
    ];

    const HOW_IT_WORKS = [
      { step: '1', title: 'Select Report Type', desc: 'Choose from 5 specialized AI report categories based on your assessment needs and student goals.', icon: FileText },
      { step: '2', title: 'AI Analyzes Data', desc: 'Our AI engine processes learning patterns, behavioral signals, and academic metrics in real time.', icon: Brain },
      { step: '3', title: 'Get Actionable Insights', desc: 'Receive a detailed report with scores, findings, recommendations, and a personalized action plan.', icon: Lightbulb },
    ];

    return (
      <div className="space-y-8" data-testid="ai-reports-landing">
        <section className="relative overflow-hidden rounded-xl" style={{ backgroundColor: brand.primary }} data-testid="ai-reports-hero">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full opacity-[0.04] bg-white" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full opacity-[0.03] bg-white" />
          </div>

          <div className="relative p-6 md:p-8">
            <div className="grid lg:grid-cols-2 gap-8 items-center">
              <div className="text-white">
                <div className="flex items-center gap-2 mb-4">
                  <Badge className="bg-white/15 text-white border-0 text-xs px-3 py-1 font-medium" data-testid="badge-ai-powered">
                    <Sparkles size={12} className="mr-1" /> AI-Powered
                  </Badge>
                  <Badge className="bg-white/15 text-white border-0 text-xs px-3 py-1 font-medium">
                    5 Report Types
                  </Badge>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold mb-3 leading-tight tracking-tight" data-testid="text-ai-reports-title">
                  AI-Powered<br />
                  <span style={{ color: brand.accent }}>Reports</span>
                </h1>
                <p className="text-sm font-medium mb-2 text-white/90">
                  Intelligent Insights That Drive Student Growth
                </p>
                <p className="text-xs text-white/60 mb-5 leading-relaxed max-w-md">
                  Generate data-driven reports that provide deep insights into student learning behaviors, 
                  academic performance, and emotional well-being — all powered by advanced AI and the 
                  LBI framework covering 19 domains and 97 subdomains.
                </p>
                <div className="flex gap-3 mb-5">
                  <Button 
                    className="text-white font-medium text-xs h-9 px-5 rounded-lg"
                    style={{ backgroundColor: brand.accent }}
                    onClick={() => setShowLanding(false)}
                    data-testid="btn-get-started"
                  >
                    <Sparkles size={14} className="mr-1" /> Generate Report
                    <ArrowRight size={14} className="ml-1" />
                  </Button>
                  <Button 
                    variant="outline"
                    className="border-white/30 text-white hover:bg-white/10 text-xs h-9 px-5 rounded-lg"
                    onClick={() => onNavigate?.('request-demo')}
                    data-testid="btn-ai-reports-demo"
                  >
                    Request Demo
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-white/70">
                  <span className="flex items-center gap-1.5"><Zap size={12} style={{ color: brand.accent }} /> Real-Time Generation</span>
                  <span className="flex items-center gap-1.5"><Shield size={12} style={{ color: brand.accent }} /> DPDP Compliant</span>
                  <span className="flex items-center gap-1.5"><Brain size={12} style={{ color: brand.accent }} /> 19 LBI Domains</span>
                  <span className="flex items-center gap-1.5"><Lock size={12} style={{ color: brand.accent }} /> SOC2 Certified</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: '5', label: 'Report Types', sub: 'Specialized categories' },
                  { value: '19', label: 'LBI Domains', sub: 'Comprehensive coverage' },
                  { value: '97', label: 'Subdomains', sub: 'Granular analysis' },
                  { value: '3', label: 'Age Bands', sub: '6-10, 11-14, 15-18' },
                ].map((stat, idx) => (
                  <div key={idx} className="bg-white/[0.07] rounded-xl px-4 py-3 text-center" data-testid={`ai-report-stat-${idx}`}>
                    <p className="text-xl font-bold text-white tracking-tight">{stat.value}</p>
                    <p className="text-[11px] font-semibold text-white/75 mt-0.5">{stat.label}</p>
                    <p className="text-[10px] text-white/35">{stat.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-100 rounded-lg border border-gray-100" data-testid="ai-reports-value-strip">
          {[
            { icon: Sparkles, label: 'AI-Generated', text: 'Reports crafted by AI in seconds' },
            { icon: Layers, label: 'Multi-Dimensional', text: 'Cognitive, emotional & behavioral' },
            { icon: Eye, label: 'Actionable Insights', text: 'Recommendations & action plans' },
            { icon: Shield, label: 'Privacy Compliant', text: 'DPDP, GDPR, SOC2 certified' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2.5 px-3 py-3" data-testid={`value-item-${i}`}>
              <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: `${brand.primary}08` }}>
                <item.icon size={14} style={{ color: brand.primary }} />
              </div>
              <div>
                <p className="text-xs font-bold" style={{ color: brand.primary }}>{item.label}</p>
                <p className="text-[10px] text-gray-400 leading-snug">{item.text}</p>
              </div>
            </div>
          ))}
        </div>

        <section className="py-8 px-4" style={{ backgroundColor: 'var(--bg-secondary, #f8fafc)' }} data-testid="ai-reports-types-section">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-8">
              <div>
                <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${brand.primary}15`, color: brand.primary }}>
                  5 Specialized Reports
                </Badge>
                <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: brand.primary }}>
                  Available Report Types
                </h2>
                <p className="mt-1.5 text-sm max-w-2xl text-gray-500">
                  Each report type focuses on different aspects of student development, powered by the full LBI framework
                </p>
              </div>
              <Button 
                className="font-medium px-5 h-9 rounded-lg text-white text-xs shrink-0"
                style={{ backgroundColor: brand.accent }}
                onClick={() => setShowLanding(false)}
                data-testid="btn-try-now"
              >
                <Play size={14} className="mr-1" /> Try Now
              </Button>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {REPORT_TYPES.map((report, idx) => {
                const Icon = getIconForType(report.icon);
                return (
                  <Card 
                    key={report.id} 
                    className="border-0 shadow-md hover:shadow-lg transition-all cursor-pointer group overflow-hidden"
                    onClick={() => setShowLanding(false)}
                    data-testid={`landing-report-${report.id}`}
                  >
                    <div className="h-1.5" style={{ backgroundColor: report.color }} />
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div 
                          className="h-10 w-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                          style={{ backgroundColor: `${report.color}12` }}
                        >
                          <Icon size={20} style={{ color: report.color }} />
                        </div>
                        <div className="flex items-center gap-1.5">
                          {report.id === 'lbi-comprehensive' && (
                            <Badge className="text-[9px] font-bold px-1.5 py-0.5" style={{ backgroundColor: `${brand.accent}20`, color: brand.accent }}>
                              Premium
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0.5" style={{ borderColor: `${report.color}40`, color: report.color }}>
                            {idx + 1}/5
                          </Badge>
                        </div>
                      </div>
                      <h4 className="text-sm font-bold mb-1.5" style={{ color: 'var(--text-primary, #1e293b)' }}>
                        {report.name}
                      </h4>
                      <p className="text-xs leading-relaxed mb-3 text-gray-500">
                        {report.description}
                      </p>
                      <div className="flex items-center gap-1 text-xs font-semibold group-hover:gap-2 transition-all" style={{ color: report.color }}>
                        Generate Report <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              <Card className="border-2 border-dashed shadow-none flex items-center justify-center cursor-pointer hover:shadow-md transition-all group" style={{ borderColor: `${brand.accent}40` }} onClick={() => setShowLanding(false)} data-testid="landing-report-all">
                <CardContent className="p-5 text-center">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center mx-auto mb-3 transition-transform group-hover:scale-110" style={{ backgroundColor: `${brand.accent}12` }}>
                    <Sparkles size={20} style={{ color: brand.accent }} />
                  </div>
                  <h4 className="text-sm font-bold mb-1" style={{ color: brand.primary }}>Explore All Reports</h4>
                  <p className="text-xs text-gray-500 mb-3">View all 5 report types and generate your first AI-powered report</p>
                  <div className="flex items-center gap-1 justify-center text-xs font-semibold group-hover:gap-2 transition-all" style={{ color: brand.accent }}>
                    Get Started <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-8 px-4" data-testid="ai-reports-features-section">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${brand.accent}20`, color: brand.accent }}>
                Comprehensive Analysis
              </Badge>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: brand.primary }}>
                What You Get
              </h2>
              <p className="mt-1.5 text-sm max-w-2xl mx-auto text-gray-500">
                Each report delivers actionable intelligence across multiple dimensions of student development
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {FEATURES.map((feature) => (
                <Card key={feature.title} className="border-0 shadow-sm hover:shadow-md transition-all group" data-testid={`feature-${feature.title.toLowerCase().replace(/\s+/g, '-')}`}>
                  <CardContent className="p-5">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110" style={{ backgroundColor: `${brand.primary}10` }}>
                      <feature.icon size={20} style={{ color: brand.primary }} />
                    </div>
                    <h4 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary, #1e293b)' }}>{feature.title}</h4>
                    <p className="text-xs leading-relaxed text-gray-500">{feature.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-8 px-4" style={{ backgroundColor: 'var(--bg-secondary, #f8fafc)' }} data-testid="ai-reports-sample-section">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-8">
              <div>
                <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${brand.primary}15`, color: brand.primary }}>
                  Sample Output
                </Badge>
                <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: brand.primary }}>
                  What a Report Looks Like
                </h2>
                <p className="mt-1.5 text-sm max-w-2xl text-gray-500">
                  See the kind of deep, actionable intelligence every AI-powered report delivers
                </p>
              </div>
              <Button 
                variant="outline"
                className="font-medium px-4 rounded-lg text-xs shrink-0 h-9"
                style={{ borderColor: brand.primary, color: brand.primary }}
                onClick={() => setShowLanding(false)}
                data-testid="btn-try-sample"
              >
                <Play size={14} className="mr-1" /> Generate Your Own
              </Button>
            </div>

            <div className="grid lg:grid-cols-5 gap-4">
              <div className="lg:col-span-3">
                <Card className="border-0 shadow-md h-full">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${brand.primary}10` }}>
                        <BarChart3 size={16} style={{ color: brand.primary }} />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm" style={{ color: brand.primary }}>Domain Scorecard</h3>
                        <p className="text-[9px] text-gray-400">Sample data for illustration</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {[
                        { domain: 'Learning Pattern Analysis', score: 82, color: brand.accent },
                        { domain: 'Emotional Regulation', score: 58, color: '#f59e0b' },
                        { domain: 'Confidence & Self-Concept', score: 71, color: brand.primary },
                        { domain: 'Exam Readiness', score: 76, color: '#0B3C5D' },
                        { domain: 'Help-Seeking Behavior', score: 44, color: '#ef4444' },
                        { domain: 'Discipline & Consistency', score: 89, color: '#4ECDC4' },
                      ].map((item, idx) => (
                        <div key={idx}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium text-gray-700">{item.domain}</span>
                            <span className="font-bold" style={{ color: item.color }}>
                              {item.score}<span className="text-[10px] text-gray-400">/100</span>
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-gray-100">
                            <div className="h-full rounded-full" style={{ width: `${item.score}%`, backgroundColor: item.color }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-2 space-y-3">
                <Card className="border-0 shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${brand.accent}15` }}>
                        <Lightbulb size={16} style={{ color: brand.accent }} />
                      </div>
                      <h3 className="font-bold text-xs" style={{ color: brand.primary }}>Key Insights</h3>
                    </div>
                    <div className="space-y-2">
                      {[
                        { label: 'Root Cause', text: 'Help-seeking hesitation suppresses recovery, creating silent struggle cycles.', color: '#ef4444', bg: '#fef2f2' },
                        { label: 'Strength', text: 'Exceptional discipline and consistency indicate strong study habits.', color: '#4ECDC4', bg: '#f0fdf4' },
                        { label: 'Action Plan', text: 'Structured check-ins to normalize help-seeking. 30-day recovery window.', color: brand.primary, bg: 'rgba(11,60,93,0.06)' },
                      ].map((insight, idx) => (
                        <div key={idx} className="p-2.5 rounded-lg border-l-3" style={{ backgroundColor: insight.bg, borderLeftColor: insight.color, borderLeftWidth: '3px' }}>
                          <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5" style={{ color: insight.color }}>{insight.label}</p>
                          <p className="text-[10px] leading-relaxed text-gray-500">{insight.text}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-14 w-14 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${brand.accent}12` }}>
                        <span className="text-xl font-bold" style={{ color: brand.accent }}>72</span>
                      </div>
                      <div>
                        <p className="text-xs font-bold" style={{ color: brand.primary }}>Good Performance</p>
                        <p className="text-[10px] text-gray-500">Above average with clear areas for targeted improvement</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <section className="py-8 px-4" data-testid="ai-reports-how-section">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <Badge className="mb-2 font-medium text-xs" style={{ backgroundColor: `${brand.accent}20`, color: brand.accent }}>
                Simple Process
              </Badge>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: brand.primary }}>
                How It Works
              </h2>
              <p className="mt-1.5 text-sm max-w-2xl mx-auto text-gray-500">
                From selection to actionable insights in three simple steps
              </p>
            </div>

            <div className="relative">
              <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5" style={{ backgroundColor: `${brand.accent}25` }} />
              <div className="grid md:grid-cols-3 gap-6">
                {HOW_IT_WORKS.map((step) => (
                  <div key={step.step} className="relative text-center" data-testid={`how-step-${step.step}`}>
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold text-sm relative z-10"
                      style={{ backgroundColor: brand.primary }}
                    >
                      {step.step}
                    </div>
                    <Card className="border-0 shadow-md hover:shadow-lg transition-all group">
                      <CardContent className="p-5 text-center">
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3 transition-transform group-hover:scale-110"
                          style={{ backgroundColor: `${brand.accent}12` }}
                        >
                          <step.icon size={20} style={{ color: brand.accent }} />
                        </div>
                        <h4 className="text-sm font-bold mb-1.5" style={{ color: 'var(--text-primary, #1e293b)' }}>{step.title}</h4>
                        <p className="text-xs leading-relaxed text-gray-500">{step.desc}</p>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-8 px-4 rounded-xl" style={{ backgroundColor: brand.primary }} data-testid="ai-reports-cta">
          <div className="max-w-4xl mx-auto text-center">
            <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center mx-auto mb-4">
              <Sparkles size={20} className="text-white" />
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white mb-3 tracking-tight">
              Ready to Generate Your <span style={{ color: brand.accent }}>First AI Report?</span>
            </h2>
            <p className="text-white/60 text-xs mb-5 max-w-lg mx-auto leading-relaxed">
              Select a report type and get personalized, AI-driven insights about your student's 
              learning behaviors, strengths, and areas for growth — in seconds.
            </p>
            <div className="flex gap-3 justify-center mb-5">
              <Button 
                className="h-9 px-6 font-medium text-xs rounded-lg text-white"
                style={{ backgroundColor: brand.accent }}
                onClick={() => setShowLanding(false)}
                data-testid="btn-generate-now"
              >
                <Sparkles size={14} className="mr-1" /> Generate Report
                <ArrowRight size={14} className="ml-1" />
              </Button>
              <Button 
                variant="outline"
                className="h-9 px-6 text-xs border-white/30 text-white hover:bg-white/10 rounded-lg"
                onClick={() => onNavigate?.('request-demo')}
              >
                Request a Demo
              </Button>
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-white/50 text-xs">
              <span className="flex items-center gap-1.5"><Zap size={12} /> Instant generation</span>
              <span className="flex items-center gap-1.5"><Shield size={12} /> 100% privacy compliant</span>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="ai-powered-reports">
      <Card className="border-0 shadow-lg overflow-hidden" style={{ backgroundColor: brand.primary }}>
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Sparkles size={24} className="text-white animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">AI-Powered Reports</h3>
                <p className="text-white/70 text-sm">
                  Generate intelligent reports for {childName || 'your student'} powered by MetryAI
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="text-white/80 hover:text-white hover:bg-white/10 text-xs"
                onClick={() => setShowLanding(true)}
                data-testid="btn-back-to-overview"
              >
                Overview
              </Button>
              <Badge className="bg-white/20 text-white border-0 text-xs">
                <Sparkles size={10} className="mr-1" /> AI
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORT_TYPES.map((report) => {
          const Icon = getIconForType(report.icon);
          return (
            <Card
              key={report.id}
              className="border shadow-sm hover:shadow-lg transition-all cursor-pointer group"
              onClick={() => handleGenerateReport(report.id)}
              data-testid={`report-card-${report.id}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="h-12 w-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                    style={{ backgroundColor: `${report.color}15` }}
                  >
                    <Icon size={24} style={{ color: report.color }} />
                  </div>
                  {report.id === 'lbi-comprehensive' && (
                    <Badge className="text-[9px] h-5 px-1.5" style={{ backgroundColor: `${brand.accent}20`, color: brand.accent }}>
                      Premium
                    </Badge>
                  )}
                </div>
                <h4 className="font-semibold text-sm mb-1.5" style={{ color: brand.primary }}>
                  {report.name}
                </h4>
                <p className="text-xs text-muted-foreground mb-4 line-clamp-2">
                  {report.description}
                </p>
                <Button
                  size="sm"
                  className="w-full text-xs h-8 text-white group-hover:shadow-md transition-all"
                  style={{ backgroundColor: report.color }}
                  data-testid={`btn-generate-${report.id}`}
                >
                  <Sparkles size={12} className="mr-1" /> Generate Report
                  <ChevronRight size={12} className="ml-1 group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {reportHistory.length > 0 && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ color: brand.primary }}>
              <Clock size={14} style={{ color: brand.accent }} /> Recent Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {reportHistory.map((report, idx) => {
                const typeInfo = REPORT_TYPES.find(r => r.id === report.reportType);
                const TypeIcon = getIconForType(typeInfo?.icon || 'sparkles');
                return (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:shadow-sm transition-all cursor-pointer"
                    onClick={() => setGeneratedReport(report)}
                    data-testid={`history-report-${idx}`}
                  >
                    <div
                      className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${typeInfo?.color || brand.accent}15` }}
                    >
                      <TypeIcon size={18} style={{ color: typeInfo?.color || brand.accent }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="text-xs font-semibold truncate" style={{ color: brand.primary }}>
                        {report.title}
                      </h5>
                      <p className="text-[10px] text-muted-foreground">
                        Score: {report.overallScore}/100 · {new Date(report.generatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge
                      className="text-[9px] h-5 px-1.5 shrink-0"
                      style={{
                        backgroundColor: `${getScoreColor(report.overallScore)}15`,
                        color: getScoreColor(report.overallScore),
                      }}
                    >
                      {getScoreLabel(report.overallScore)}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border shadow-sm" style={{ backgroundColor: `${brand.accent}05` }}>
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <Sparkles size={16} style={{ color: brand.accent }} />
            <p className="text-xs text-muted-foreground">
              Reports are generated using advanced AI models analyzing learning patterns, behavioral data, and academic performance metrics. Each report provides actionable insights and personalized recommendations.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
