import { useState, useEffect } from 'react';

function authFetch(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem('metryx_token');
  return fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) },
  });
}
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, BookOpen, Clock, CheckCircle, AlertCircle, Calendar, Target, Trash2, GraduationCap, Layers, AlertTriangle, FileText, Play, PenTool, RotateCcw, Video, Zap, ClipboardList, ChevronRight, Check } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { QuickScheduleButton } from '@/components/SchedulerNotification';

interface EducationBoard {
  id: string;
  boardCode?: string;
  boardName: string;
}

interface AcademicClass {
  id: string;
  classNumber: number;
  className: string;
}

interface AcademicSubject {
  id: string;
  subjectCode: string;
  subjectName: string;
}

interface AcademicChapter {
  id: string;
  chapterCode: string;
  chapterName: string;
  chapterNumber: number;
}

interface StudyTask {
  id: string;
  title: string;
  description: string;
  taskType: string;
  status: string;
  priority: string;
  dueDate?: string;
  estimatedMinutes?: number;
  subjectId?: string;
  chapterId?: string;
  createdAt: string;
}

interface Props {
  childId: string;
  childName: string;
  childGrade?: string;
  childBoard?: string;
}

interface StudyPlanTemplate {
  id: string;
  name: string;
  description: string;
  category: 'exam_prep' | 'daily_study' | 'revision' | 'skill_building';
  icon: string;
  tasks: {
    title: string;
    description: string;
    taskType: string;
    estimatedMinutes: number;
    priority: string;
    dayOffset: number;
  }[];
  totalDays: number;
  totalMinutes: number;
}

const STUDY_PLAN_TEMPLATES: StudyPlanTemplate[] = [
  {
    id: 'board-exam-prep', name: 'Board Exam Preparation', description: 'Structured 7-day plan for board exam revision with daily targets', category: 'exam_prep', icon: 'GraduationCap',
    tasks: [
      { title: 'Chapter-wise Summary Notes', description: 'Create concise notes for each chapter covering key formulas, definitions, and diagrams', taskType: 'revision', estimatedMinutes: 60, priority: 'High', dayOffset: 0 },
      { title: 'Previous Year Questions Practice', description: 'Solve last 5 years board exam questions topic-wise', taskType: 'practice', estimatedMinutes: 90, priority: 'High', dayOffset: 1 },
      { title: 'Important Formulas & Theorems Review', description: 'Revise all important formulas, theorems, and derivations', taskType: 'revision', estimatedMinutes: 45, priority: 'High', dayOffset: 2 },
      { title: 'Sample Paper Practice', description: 'Attempt full-length sample paper under timed conditions', taskType: 'practice', estimatedMinutes: 180, priority: 'High', dayOffset: 3 },
      { title: 'Weak Areas Focused Study', description: 'Identify and work on weak topics from sample paper analysis', taskType: 'study', estimatedMinutes: 60, priority: 'High', dayOffset: 4 },
      { title: 'Quick Revision & Mind Maps', description: 'Create mind maps for quick revision of all chapters', taskType: 'revision', estimatedMinutes: 45, priority: 'Medium', dayOffset: 5 },
      { title: 'Final Mock Test', description: 'Full-length mock test with self-evaluation and scoring', taskType: 'practice', estimatedMinutes: 180, priority: 'High', dayOffset: 6 },
    ],
    totalDays: 7, totalMinutes: 660,
  },
  {
    id: 'chapter-deep-dive', name: 'Chapter Deep Dive', description: '3-day intensive study plan for mastering a single chapter', category: 'daily_study', icon: 'BookOpen',
    tasks: [
      { title: 'Read & Understand Concepts', description: 'Read the chapter thoroughly, highlight key points, and note down doubts', taskType: 'study', estimatedMinutes: 45, priority: 'High', dayOffset: 0 },
      { title: 'NCERT/Textbook Exercises', description: 'Solve all in-text and back-of-chapter exercises', taskType: 'practice', estimatedMinutes: 60, priority: 'High', dayOffset: 0 },
      { title: 'Additional Reference Problems', description: 'Practice problems from reference books', taskType: 'practice', estimatedMinutes: 45, priority: 'Medium', dayOffset: 1 },
      { title: 'Concept Map Creation', description: 'Create a visual concept map connecting all topics in the chapter', taskType: 'revision', estimatedMinutes: 30, priority: 'Medium', dayOffset: 1 },
      { title: 'Self-Assessment Quiz', description: 'Take a self-quiz on key concepts and solve tricky questions', taskType: 'practice', estimatedMinutes: 30, priority: 'High', dayOffset: 2 },
    ],
    totalDays: 3, totalMinutes: 210,
  },
  {
    id: 'weekly-revision', name: 'Weekly Revision Cycle', description: '5-day weekly revision plan to reinforce learning across subjects', category: 'revision', icon: 'RotateCcw',
    tasks: [
      { title: 'Monday: Subject 1 Revision', description: 'Revise 2 chapters from primary subject with formula practice', taskType: 'revision', estimatedMinutes: 45, priority: 'High', dayOffset: 0 },
      { title: 'Tuesday: Subject 2 Revision', description: 'Revise 2 chapters from second subject with concept review', taskType: 'revision', estimatedMinutes: 45, priority: 'High', dayOffset: 1 },
      { title: 'Wednesday: Problem Solving Day', description: 'Mixed practice problems from all subjects studied this week', taskType: 'practice', estimatedMinutes: 60, priority: 'Medium', dayOffset: 2 },
      { title: 'Thursday: Subject 3 Revision', description: 'Revise language/social science chapters with note-making', taskType: 'revision', estimatedMinutes: 45, priority: 'High', dayOffset: 3 },
      { title: 'Friday: Weekly Assessment', description: 'Self-test covering all topics revised this week', taskType: 'practice', estimatedMinutes: 45, priority: 'High', dayOffset: 4 },
    ],
    totalDays: 5, totalMinutes: 240,
  },
  {
    id: 'competitive-prep', name: 'Competitive Exam Sprint', description: '5-day intensive prep plan for JEE/NEET/Olympiad aspirants', category: 'exam_prep', icon: 'Zap',
    tasks: [
      { title: 'Topic-wise Theory Revision', description: 'Revise theory from standard textbooks with important derivations', taskType: 'study', estimatedMinutes: 60, priority: 'High', dayOffset: 0 },
      { title: 'Level 1: Foundation Problems', description: 'Solve basic to moderate level problems for concept clarity', taskType: 'practice', estimatedMinutes: 60, priority: 'High', dayOffset: 1 },
      { title: 'Level 2: Advanced Problems', description: 'Attempt previous year competition questions and advanced problems', taskType: 'practice', estimatedMinutes: 90, priority: 'High', dayOffset: 2 },
      { title: 'Error Analysis & Weak Areas', description: 'Review mistakes, analyze error patterns, revise weak concepts', taskType: 'revision', estimatedMinutes: 45, priority: 'High', dayOffset: 3 },
      { title: 'Full Mock Test with Analysis', description: 'Take full-length mock test and detailed analysis of performance', taskType: 'practice', estimatedMinutes: 180, priority: 'High', dayOffset: 4 },
    ],
    totalDays: 5, totalMinutes: 435,
  },
  {
    id: 'homework-routine', name: 'Daily Homework Routine', description: 'Structured daily homework completion plan', category: 'daily_study', icon: 'ClipboardList',
    tasks: [
      { title: 'Complete Classwork Notes', description: 'Organize and complete any pending classwork from today', taskType: 'homework', estimatedMinutes: 20, priority: 'High', dayOffset: 0 },
      { title: 'Subject Homework', description: 'Complete assigned homework for the day', taskType: 'homework', estimatedMinutes: 45, priority: 'High', dayOffset: 0 },
      { title: 'Reading & Comprehension', description: 'Read prescribed chapters or reference material', taskType: 'study', estimatedMinutes: 30, priority: 'Medium', dayOffset: 0 },
    ],
    totalDays: 1, totalMinutes: 95,
  },
  {
    id: 'project-work', name: 'Project / Assignment', description: 'Multi-day project or assignment completion plan', category: 'skill_building', icon: 'Layers',
    tasks: [
      { title: 'Research & Gather Material', description: 'Research the topic, gather reference material, and create outline', taskType: 'project', estimatedMinutes: 60, priority: 'High', dayOffset: 0 },
      { title: 'Draft Content / Build', description: 'Write first draft or build the core of the project', taskType: 'project', estimatedMinutes: 90, priority: 'High', dayOffset: 1 },
      { title: 'Review & Polish', description: 'Review, edit, add diagrams/charts, and finalize the project', taskType: 'project', estimatedMinutes: 45, priority: 'Medium', dayOffset: 2 },
      { title: 'Final Submission Prep', description: 'Format, proofread, and prepare for submission', taskType: 'project', estimatedMinutes: 30, priority: 'High', dayOffset: 3 },
    ],
    totalDays: 4, totalMinutes: 225,
  },
  {
    id: 'skill-practice', name: 'Skill Building Focus', description: 'Targeted practice plan for specific skills like speed math, reading comprehension', category: 'skill_building', icon: 'Target',
    tasks: [
      { title: 'Timed Practice Set', description: 'Complete 20 questions in timed conditions to build speed', taskType: 'practice', estimatedMinutes: 30, priority: 'High', dayOffset: 0 },
      { title: 'Accuracy Analysis', description: 'Review answers, identify error patterns, and note weak areas', taskType: 'revision', estimatedMinutes: 20, priority: 'Medium', dayOffset: 0 },
      { title: 'Focused Weak Area Practice', description: 'Extra practice on identified weak spots with solved examples', taskType: 'practice', estimatedMinutes: 40, priority: 'High', dayOffset: 1 },
    ],
    totalDays: 2, totalMinutes: 90,
  },
  {
    id: 'video-learning', name: 'Video Learning Plan', description: 'Structured video-based learning with notes and practice', category: 'daily_study', icon: 'Video',
    tasks: [
      { title: 'Watch Video Lesson', description: 'Watch the assigned video lesson and take rough notes', taskType: 'study', estimatedMinutes: 40, priority: 'High', dayOffset: 0 },
      { title: 'Create Summary Notes', description: 'Organize video notes into a clean summary with key points', taskType: 'study', estimatedMinutes: 20, priority: 'Medium', dayOffset: 0 },
      { title: 'Practice Related Questions', description: 'Solve practice questions related to the video topic', taskType: 'practice', estimatedMinutes: 30, priority: 'High', dayOffset: 0 },
    ],
    totalDays: 1, totalMinutes: 90,
  },
];

const TASK_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  'study': { label: 'Study', color: '#0B3C5D' },
  'practice': { label: 'Practice', color: '#E88D67' },
  'revision': { label: 'Revision', color: '#9B59B6' },
  'homework': { label: 'Homework', color: '#F39C12' },
  'project': { label: 'Project', color: '#2ECC71' },
  'reading': { label: 'Reading', color: '#3498DB' },
  'assessment': { label: 'Self-Assessment', color: '#E74C3C' },
};

const TEMPLATE_ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  GraduationCap, BookOpen, RotateCcw, Zap, ClipboardList, Layers, Target, Video,
};

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }> = {
  exam_prep: { label: 'Exam Prep', icon: GraduationCap },
  daily_study: { label: 'Daily Study', icon: BookOpen },
  revision: { label: 'Revision', icon: RotateCcw },
  skill_building: { label: 'Skill Building', icon: Target },
};

export function ParentEducationPlanner({ childId, childName, childGrade, childBoard }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  const [boards, setBoards] = useState<EducationBoard[]>([]);
  const [classes, setClasses] = useState<AcademicClass[]>([]);
  const [subjects, setSubjects] = useState<AcademicSubject[]>([]);
  const [chapters, setChapters] = useState<AcademicChapter[]>([]);
  
  const [selectedBoard, setSelectedBoard] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedChapter, setSelectedChapter] = useState<string>('');
  
  const [studyTasks, setStudyTasks] = useState<StudyTask[]>([]);
  
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskType, setNewTaskType] = useState('study');
  const [newTaskPriority, setNewTaskPriority] = useState('Medium');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskEstimatedMinutes, setNewTaskEstimatedMinutes] = useState('30');
  
  const [loading, setLoading] = useState(true);
  const [creatingTask, setCreatingTask] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState<StudyPlanTemplate | null>(null);
  const [templateTasks, setTemplateTasks] = useState<StudyPlanTemplate['tasks']>([]);
  const [selectedTaskIndices, setSelectedTaskIndices] = useState<number[]>([]);
  const [startDate, setStartDate] = useState('');
  
  useEffect(() => {
    fetchBoards();
    fetchStudyTasks();
  }, [childId]);
  
  useEffect(() => {
    if (boards.length > 0 && !selectedBoard) {
      const childBoardMatch = boards.find(b => 
        b.boardName.toLowerCase().includes((childBoard || '').toLowerCase()) ||
        b.boardCode?.toLowerCase() === (childBoard || '').toLowerCase()
      );
      const cbseBoard = boards.find(b => b.boardCode === 'CBSE' || b.boardName.includes('Central'));
      const defaultBoard = childBoardMatch || cbseBoard || boards[0];
      if (defaultBoard) {
        setSelectedBoard(defaultBoard.id);
      }
    }
  }, [boards, childBoard]);
  
  useEffect(() => {
    if (selectedBoard) {
      setSelectedClass('');
      setSelectedSubject('');
      setSelectedChapter('');
      fetchClasses(selectedBoard);
    }
  }, [selectedBoard]);

  useEffect(() => {
    if (childGrade && classes.length > 0 && !selectedClass) {
      const gradeNumber = parseInt(childGrade.replace(/\D/g, ''));
      const matchingClass = classes.find(c => c.classNumber === gradeNumber || c.className.includes(childGrade));
      if (matchingClass) {
        setSelectedClass(matchingClass.id);
      }
    }
  }, [childGrade, classes]);
  
  useEffect(() => {
    if (selectedClass) {
      setSelectedSubject('');
      setSelectedChapter('');
      fetchSubjects(selectedClass);
    }
  }, [selectedClass]);
  
  useEffect(() => {
    if (selectedSubject) {
      setSelectedChapter('');
      fetchChapters(selectedSubject);
    }
  }, [selectedSubject]);
  
  const fetchBoards = async () => {
    try {
      const response = await fetch('/api/curriculum/boards');
      if (response.ok) {
        const data = await response.json();
        setBoards(data);
      }
    } catch (error) {
      console.error('Failed to fetch boards:', error);
    }
    setLoading(false);
  };
  
  const fetchClasses = async (boardId: string) => {
    try {
      const response = await fetch(`/api/curriculum/boards/${boardId}/classes`);
      if (response.ok) {
        const data = await response.json();
        setClasses(data);
      }
    } catch (error) {
      console.error('Failed to fetch classes:', error);
    }
  };
  
  const fetchSubjects = async (classId: string) => {
    try {
      const response = await fetch(`/api/curriculum/classes/${classId}/subjects`);
      if (response.ok) {
        const data = await response.json();
        setSubjects(data);
      }
    } catch (error) {
      console.error('Failed to fetch subjects:', error);
    }
  };
  
  const fetchChapters = async (subjectId: string) => {
    try {
      const response = await fetch(`/api/curriculum/subjects/${subjectId}/chapters`);
      if (response.ok) {
        const data = await response.json();
        setChapters(data);
      }
    } catch (error) {
      console.error('Failed to fetch chapters:', error);
    }
  };
  
  const fetchStudyTasks = async () => {
    try {
      const response = await authFetch(`/api/children/${childId}/study-tasks`);
      if (response.ok) {
        const data = await response.json();
        setStudyTasks(data);
      }
    } catch (error) {
      console.error('Failed to fetch study tasks:', error);
    }
  };
  
  const createStudyTask = async () => {
    if (!newTaskTitle.trim()) {
      toast({ title: 'Error', description: 'Please enter a task title', variant: 'destructive' });
      return;
    }
    
    setCreatingTask(true);
    try {
      const response = await authFetch(`/api/children/${childId}/study-tasks`, {
        method: 'POST',
        body: JSON.stringify({
          title: newTaskTitle,
          description: newTaskDescription,
          taskType: newTaskType,
          priority: newTaskPriority,
          dueDate: newTaskDueDate || undefined,
          estimatedMinutes: parseInt(newTaskEstimatedMinutes) || 30,
          subject: selectedSubject || undefined,
          chapter: selectedChapter || undefined
        })
      });
      
      if (response.ok) {
        toast({ title: 'Success', description: 'Study task created successfully' });
        setIsAddTaskOpen(false);
        resetTaskForm();
        fetchStudyTasks();
      } else {
        throw new Error('Failed to create task');
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create study task', variant: 'destructive' });
    }
    setCreatingTask(false);
  };
  
  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      const statusMap: Record<string, string> = { 'Completed': 'done', 'In Progress': 'in_progress', 'Pending': 'pending' };
      const response = await authFetch(`/api/student/study-tasks/${taskId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: statusMap[newStatus] ?? 'pending' })
      });
      if (response.ok) {
        toast({ title: 'Success', description: 'Task updated' });
        fetchStudyTasks();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update task', variant: 'destructive' });
    }
  };
  
  const deleteTask = async (taskId: string) => {
    try {
      const response = await authFetch(`/api/children/${childId}/study-tasks/${taskId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        toast({ title: 'Success', description: 'Task deleted' });
        fetchStudyTasks();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete task', variant: 'destructive' });
    }
  };
  
  const resetTaskForm = () => {
    setNewTaskTitle('');
    setNewTaskDescription('');
    setNewTaskType('study');
    setNewTaskPriority('Medium');
    setNewTaskDueDate('');
    setNewTaskEstimatedMinutes('30');
    setCreateStep(1);
    setSelectedTemplate(null);
    setTemplateTasks([]);
    setSelectedTaskIndices([]);
    setStartDate('');
  };

  const selectTemplate = (template: StudyPlanTemplate) => {
    setSelectedTemplate(template);
    setTemplateTasks([...template.tasks]);
    setSelectedTaskIndices(template.tasks.map((_, i) => i));
    setStartDate(new Date().toISOString().split('T')[0]);
    setCreateStep(2);
  };

  const createBatchStudyTasks = async () => {
    setCreatingTask(true);
    const tasksToCreate = selectedTemplate
      ? selectedTaskIndices.map(idx => {
          const t = templateTasks[idx];
          const dueDate = startDate ? new Date(new Date(startDate).getTime() + t.dayOffset * 86400000).toISOString().split('T')[0] : undefined;
          return { title: t.title, description: t.description, taskType: t.taskType, priority: t.priority, estimatedMinutes: t.estimatedMinutes, dueDate, subjectId: selectedSubject || undefined, chapterId: selectedChapter || undefined };
        })
      : [];
    try {
      for (const task of tasksToCreate) {
        await authFetch(`/api/children/${childId}/study-tasks`, { method: 'POST', body: JSON.stringify(task) });
      }
      toast({ title: 'Success', description: `${tasksToCreate.length} study tasks created successfully` });
      setIsAddTaskOpen(false);
      resetTaskForm();
      fetchStudyTasks();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create study tasks', variant: 'destructive' });
    }
    setCreatingTask(false);
  };
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Completed':
        return <CheckCircle className="h-4 w-4" style={{ color: '#4ECDC4' }} />;
      case 'In Progress':
        return <Clock className="h-4 w-4" style={{ color: '#0B3C5D' }} />;
      default:
        return <AlertCircle className="h-4 w-4" style={{ color: '#d97706' }} />;
    }
  };
  
  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'High':
        return { backgroundColor: 'rgba(220, 38, 38, 0.08)', color: '#dc2626' };
      case 'Medium':
        return { backgroundColor: 'rgba(217, 119, 6, 0.08)', color: '#d97706' };
      case 'Low':
        return { backgroundColor: 'rgba(78, 205, 196, 0.08)', color: '#4ECDC4' };
      default:
        return { backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' };
    }
  };
  
  const pendingTasks = studyTasks.filter(t => t.status === 'Pending');
  const inProgressTasks = studyTasks.filter(t => t.status === 'In Progress');
  const completedTasks = studyTasks.filter(t => t.status === 'Completed');

  const now = new Date();
  const overdueTasks = studyTasks.filter(t => t.status !== 'Completed' && t.dueDate && new Date(t.dueDate) < now);

  const getWeekDays = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const days: { label: string; date: Date }[] = [];
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push({ label: labels[i], date: d });
    }
    return days;
  };

  const weekDays = getWeekDays();
  const weekStart = weekDays[0].date;
  const weekEnd = new Date(weekDays[6].date);
  weekEnd.setHours(23, 59, 59, 999);

  const weekTasks = studyTasks.filter(t => {
    if (!t.dueDate) return false;
    const d = new Date(t.dueDate);
    return d >= weekStart && d <= weekEnd;
  });

  const weekCompletedCount = weekTasks.filter(t => t.status === 'Completed').length;
  const weekTotalMinutes = weekTasks.reduce((sum, t) => sum + (t.estimatedMinutes || 0), 0);
  const weekProgressPercent = weekTasks.length > 0 ? Math.round((weekCompletedCount / weekTasks.length) * 100) : 0;

  const getTaskCountForDay = (date: Date) => {
    const dayStr = date.toISOString().split('T')[0];
    return studyTasks.filter(t => t.dueDate && t.dueDate.startsWith(dayStr)).length;
  };

  const getDayColor = (count: number) => {
    if (count === 0) return { bg: '#e5e7eb', text: '#9ca3af' };
    if (count <= 2) return { bg: '#4ECDC4', text: '#ffffff' };
    return { bg: '#0B3C5D', text: '#ffffff' };
  };

  const taskPresets = [
    { label: 'Practice Problems', title: 'Practice Problems', description: 'Solve practice problems for the chapter', type: 'practice', minutes: '45', icon: PenTool },
    { label: 'Chapter Review', title: 'Chapter Review', description: 'Review key concepts and summaries', type: 'revision', minutes: '30', icon: FileText },
    { label: 'Mock Test Prep', title: 'Mock Test Prep', description: 'Prepare and attempt mock test questions', type: 'practice', minutes: '60', icon: Target },
    { label: 'Revision Notes', title: 'Revision Notes', description: 'Create or review revision notes', type: 'revision', minutes: '25', icon: RotateCcw },
    { label: 'Video Lesson', title: 'Video Lesson', description: 'Watch and take notes from video lesson', type: 'study', minutes: '40', icon: Video },
  ];

  const applyPreset = (preset: typeof taskPresets[0]) => {
    setNewTaskTitle(preset.title);
    setNewTaskDescription(preset.description);
    setNewTaskType(preset.type);
    setNewTaskEstimatedMinutes(preset.minutes);
    setSelectedTemplate(null);
    setCreateStep(2);
    setIsAddTaskOpen(true);
  };

  const scrollToOverdue = () => {
    const firstOverdue = overdueTasks[0];
    if (firstOverdue) {
      const el = document.querySelector(`[data-testid="task-card-${firstOverdue.id}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="space-y-5" data-testid="parent-education-planner">
      {/* Overdue Alert Banner */}
      {overdueTasks.length > 0 && (
        <div
          className="flex items-center justify-between px-4 py-2.5 rounded-xl border"
          style={{ backgroundColor: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.3)' }}
          data-testid="overdue-alert-banner"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" style={{ color: '#d97706' }} />
            <span className="text-xs font-semibold" style={{ color: '#d97706' }} data-testid="overdue-count">
              {overdueTasks.length} overdue {overdueTasks.length === 1 ? 'task' : 'tasks'}
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 rounded-lg font-semibold"
            style={{ color: '#d97706', borderColor: '#d97706' }}
            onClick={scrollToOverdue}
            data-testid="btn-review-overdue"
          >
            Review Overdue Tasks
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#0B3C5D' }}>
          <BookOpen className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold" style={{ color: '#0B3C5D', fontFamily: "'Inter', sans-serif" }} data-testid="planner-title">
            Education Planner for {childName}
          </h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Create study tasks based on curriculum</p>
        </div>
      </div>

      {/* Weekly Plan Overview */}
      <Card className="border" data-testid="weekly-plan-overview">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-4 w-4" style={{ color: '#0B3C5D' }} />
            <h3 className="text-sm font-bold" style={{ color: '#0B3C5D', fontFamily: "'Inter', sans-serif" }}>This Week</h3>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-1.5" data-testid="week-day-circles">
              {weekDays.map((day) => {
                const count = getTaskCountForDay(day.date);
                const colors = getDayColor(count);
                return (
                  <div key={day.label} className="flex flex-col items-center gap-1">
                    <span className="text-[9px] font-semibold" style={{ color: 'var(--text-muted)' }}>{day.label}</span>
                    <div
                      className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{ backgroundColor: colors.bg, color: colors.text }}
                      data-testid={`week-day-${day.label.toLowerCase()}`}
                    >
                      {count}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }} data-testid="week-study-hours">
                  <Clock className="h-3 w-3 inline mr-1" />
                  {(weekTotalMinutes / 60).toFixed(1)} hrs planned
                </span>
                <span className="text-xs font-semibold" style={{ color: '#4ECDC4' }} data-testid="week-progress-text">
                  {weekCompletedCount}/{weekTasks.length} done
                </span>
              </div>
              <Progress value={weekProgressPercent} className="h-2" data-testid="week-progress-bar" />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Academic Profile Card - NO gradient */}
      <Card className="border" style={{ backgroundColor: '#0B3C5D' }}>
        <CardContent className="py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white" style={{ fontFamily: "'Inter', sans-serif" }}>{childName}'s Academic Profile</h3>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <Badge className="text-[10px] font-semibold border-0" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'white' }}>
                    <Layers className="h-3 w-3 mr-1" />
                    {childGrade || 'Grade not set'}
                  </Badge>
                  <Badge className="text-[10px] font-semibold border-0" style={{ backgroundColor: 'rgba(78, 205, 196, 0.2)', color: '#4ECDC4' }}>
                    <BookOpen className="h-3 w-3 mr-1" />
                    {childBoard || 'Board not set'}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="text-left md:text-right">
              <p className="text-[10px] text-white/60 uppercase tracking-wider font-semibold">Available Questions</p>
              <p className="text-2xl font-bold text-white" style={{ fontFamily: "'Inter', sans-serif" }}>275+</p>
              <p className="text-[10px] text-white/50">Across all subjects</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Curriculum Selection */}
      <Card className="border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2" style={{ color: '#0B3C5D', fontFamily: "'Inter', sans-serif" }}>
            <GraduationCap className="h-4 w-4" style={{ color: '#0B3C5D' }} />
            Curriculum Selection
          </CardTitle>
          <CardDescription className="text-xs">Select board, class, subject, and chapter to create targeted study plans</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Education Board</Label>
              <Select value={selectedBoard} onValueChange={setSelectedBoard}>
                <SelectTrigger className="h-10 rounded-lg text-sm" data-testid="select-board">
                  <SelectValue placeholder="Select Board" />
                </SelectTrigger>
                <SelectContent>
                  {boards.map(board => (
                    <SelectItem key={board.id} value={board.id}>{board.boardName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Class</Label>
              <Select value={selectedClass} onValueChange={setSelectedClass} disabled={!selectedBoard}>
                <SelectTrigger className="h-10 rounded-lg text-sm" data-testid="select-class">
                  <SelectValue placeholder="Select Class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map(cls => (
                    <SelectItem key={cls.id} value={cls.id}>{cls.className}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Subject</Label>
              <Select value={selectedSubject} onValueChange={setSelectedSubject} disabled={!selectedClass}>
                <SelectTrigger className="h-10 rounded-lg text-sm" data-testid="select-subject">
                  <SelectValue placeholder="Select Subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map(subject => (
                    <SelectItem key={subject.id} value={subject.id}>{subject.subjectName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Chapter</Label>
              <Select value={selectedChapter} onValueChange={setSelectedChapter} disabled={!selectedSubject}>
                <SelectTrigger className="h-10 rounded-lg text-sm" data-testid="select-chapter">
                  <SelectValue placeholder="Select Chapter" />
                </SelectTrigger>
                <SelectContent>
                  {chapters.map(chapter => (
                    <SelectItem key={chapter.id} value={chapter.id}>{chapter.chapterNumber}. {chapter.chapterName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Study Tasks Only - No Tests Tab */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-sm font-bold" style={{ color: '#0B3C5D', fontFamily: "'Inter', sans-serif" }}>
              Study Tasks ({studyTasks.length})
            </h3>
            <div className="flex gap-2 mt-1.5">
              <Badge variant="outline" className="text-[10px] font-semibold" style={{ backgroundColor: 'rgba(217, 119, 6, 0.06)', color: '#d97706', borderColor: '#d97706' }}>
                {pendingTasks.length} Pending
              </Badge>
              <Badge variant="outline" className="text-[10px] font-semibold" style={{ backgroundColor: 'rgba(11, 60, 93, 0.06)', color: '#0B3C5D', borderColor: '#0B3C5D' }}>
                {inProgressTasks.length} In Progress
              </Badge>
              <Badge variant="outline" className="text-[10px] font-semibold" style={{ backgroundColor: 'rgba(78, 205, 196, 0.06)', color: '#4ECDC4', borderColor: '#4ECDC4' }}>
                {completedTasks.length} Completed
              </Badge>
            </div>
          </div>
          
          <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
            <DialogTrigger asChild>
              <Button 
                className="text-white text-xs font-semibold rounded-lg h-9"
                style={{ backgroundColor: '#4ECDC4' }}
                data-testid="btn-add-task"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add Study Task
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl" data-testid="wizard-dialog">
              <DialogHeader>
                <DialogTitle className="text-base font-bold" style={{ color: '#0B3C5D', fontFamily: "'Inter', sans-serif" }}>
                  {createStep === 1 ? 'Choose Study Plan' : createStep === 2 ? 'Configure Tasks' : 'Review & Create'}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {createStep === 1 ? 'Select a study plan template or create a custom task' : createStep === 2 ? 'Customize your study tasks' : 'Review your study plan before creating'}
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-center justify-center gap-0 py-3" data-testid="wizard-stepper">
                {[{ step: 1, label: 'Choose Plan' }, { step: 2, label: 'Configure' }, { step: 3, label: 'Review & Create' }].map((s, i) => (
                  <div key={s.step} className="flex items-center">
                    <div className="flex items-center gap-1.5">
                      <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: createStep >= s.step ? '#0B3C5D' : '#e5e7eb', color: createStep >= s.step ? '#fff' : '#9ca3af' }} data-testid={`wizard-step-${s.step}`}>
                        {createStep > s.step ? <Check className="h-3.5 w-3.5" /> : s.step}
                      </div>
                      <span className="text-[11px] font-semibold hidden sm:inline" style={{ color: createStep >= s.step ? '#0B3C5D' : '#9ca3af' }}>{s.label}</span>
                    </div>
                    {i < 2 && <div className="w-8 h-0.5 mx-2" style={{ backgroundColor: createStep > s.step ? '#0B3C5D' : '#e5e7eb' }} />}
                  </div>
                ))}
              </div>

              <ScrollArea className="max-h-[60vh]">
                {createStep === 1 && (
                  <div className="space-y-4 py-2" data-testid="wizard-step1-content">
                    <button
                      className="w-full p-3 rounded-xl border-2 border-dashed text-left flex items-center gap-3 hover:border-[#4ECDC4] transition-colors"
                      style={{ borderColor: 'rgba(78, 205, 196, 0.4)' }}
                      onClick={() => { setSelectedTemplate(null); setCreateStep(2); }}
                      data-testid="btn-custom-task"
                    >
                      <div className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(78, 205, 196, 0.1)' }}>
                        <Plus className="h-5 w-5" style={{ color: '#4ECDC4' }} />
                      </div>
                      <div>
                        <p className="text-sm font-bold" style={{ color: '#0B3C5D', fontFamily: "'Inter', sans-serif" }}>Custom Task</p>
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Create a single custom study task</p>
                      </div>
                    </button>

                    {(['exam_prep', 'daily_study', 'revision', 'skill_building'] as const).map(cat => {
                      const catTemplates = STUDY_PLAN_TEMPLATES.filter(t => t.category === cat);
                      if (catTemplates.length === 0) return null;
                      const catCfg = CATEGORY_CONFIG[cat];
                      const CatIcon = catCfg.icon;
                      return (
                        <div key={cat}>
                          <div className="flex items-center gap-1.5 mb-2">
                            <CatIcon className="h-3.5 w-3.5" style={{ color: '#0B3C5D' }} />
                            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#0B3C5D' }}>{catCfg.label}</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {catTemplates.map(tmpl => {
                              const TmplIcon = TEMPLATE_ICON_MAP[tmpl.icon] || BookOpen;
                              return (
                                <button
                                  key={tmpl.id}
                                  className="p-3 rounded-xl border text-left hover:shadow-md transition-shadow"
                                  style={{ borderColor: 'rgba(11, 60, 93, 0.15)' }}
                                  onClick={() => selectTemplate(tmpl)}
                                  data-testid={`btn-template-${tmpl.id}`}
                                >
                                  <div className="flex items-start gap-2.5">
                                    <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(11, 60, 93, 0.08)' }}>
                                      <TmplIcon className="h-4 w-4" style={{ color: '#0B3C5D' }} />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold truncate" style={{ color: '#0B3C5D', fontFamily: "'Inter', sans-serif" }}>{tmpl.name}</p>
                                      <p className="text-[10px] mt-0.5 line-clamp-2" style={{ color: 'var(--text-muted)' }}>{tmpl.description}</p>
                                      <div className="flex gap-2 mt-1.5">
                                        <span className="text-[9px] font-semibold" style={{ color: '#4ECDC4' }}>{tmpl.tasks.length} tasks</span>
                                        <span className="text-[9px] font-semibold" style={{ color: 'var(--text-muted)' }}>{tmpl.totalDays}d</span>
                                        <span className="text-[9px] font-semibold" style={{ color: 'var(--text-muted)' }}>{Math.round(tmpl.totalMinutes / 60)}h {tmpl.totalMinutes % 60}m</span>
                                      </div>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {createStep === 2 && !selectedTemplate && (
                  <div className="space-y-4 py-2" data-testid="wizard-step2-custom">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Task Title *</Label>
                      <Input value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="e.g., Complete Chapter 3 exercises" className="h-10 rounded-lg text-sm" data-testid="input-task-title" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Description</Label>
                      <Textarea value={newTaskDescription} onChange={(e) => setNewTaskDescription(e.target.value)} placeholder="Add details about the task..." className="rounded-lg text-sm" data-testid="input-task-description" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Task Type</Label>
                        <Select value={newTaskType} onValueChange={setNewTaskType}>
                          <SelectTrigger className="h-10 rounded-lg text-sm" data-testid="select-task-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(TASK_TYPE_CONFIG).map(([key, cfg]) => (
                              <SelectItem key={key} value={key}>
                                <span className="flex items-center gap-2">
                                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                                  {cfg.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Priority</Label>
                        <Select value={newTaskPriority} onValueChange={setNewTaskPriority}>
                          <SelectTrigger className="h-10 rounded-lg text-sm" data-testid="select-task-priority"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="High">High</SelectItem>
                            <SelectItem value="Medium">Medium</SelectItem>
                            <SelectItem value="Low">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Due Date</Label>
                        <Input type="date" value={newTaskDueDate} onChange={(e) => setNewTaskDueDate(e.target.value)} className="h-10 rounded-lg text-sm" data-testid="input-task-due-date" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Est. Minutes</Label>
                        <Input type="number" value={newTaskEstimatedMinutes} onChange={(e) => setNewTaskEstimatedMinutes(e.target.value)} className="h-10 rounded-lg text-sm" data-testid="input-task-minutes" />
                      </div>
                    </div>
                  </div>
                )}

                {createStep === 2 && selectedTemplate && (
                  <div className="space-y-4 py-2" data-testid="wizard-step2-template">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold" style={{ color: '#0B3C5D', fontFamily: "'Inter', sans-serif" }}>{selectedTemplate.name}</p>
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{selectedTemplate.description}</p>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                        <span style={{ color: '#4ECDC4' }}>{selectedTaskIndices.length}/{templateTasks.length} selected</span>
                        <span>{selectedTaskIndices.reduce((s, i) => s + templateTasks[i].estimatedMinutes, 0)} min</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Start Date</Label>
                      <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 rounded-lg text-sm w-48" data-testid="input-start-date" />
                    </div>

                    <div className="space-y-2">
                      {templateTasks.map((task, idx) => {
                        const isSelected = selectedTaskIndices.includes(idx);
                        const typeConfig = TASK_TYPE_CONFIG[task.taskType];
                        return (
                          <div key={idx} className="flex items-start gap-2.5 p-2.5 rounded-lg border" style={{ borderColor: isSelected ? 'rgba(11, 60, 93, 0.2)' : 'rgba(0,0,0,0.06)', backgroundColor: isSelected ? 'rgba(11, 60, 93, 0.02)' : 'transparent' }} data-testid={`template-task-${idx}`}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                setSelectedTaskIndices(prev => checked ? [...prev, idx] : prev.filter(i => i !== idx));
                              }}
                              className="mt-0.5"
                              data-testid={`checkbox-task-${idx}`}
                            />
                            <div className="flex-1 min-w-0">
                              <Input
                                value={task.title}
                                onChange={(e) => {
                                  const updated = [...templateTasks];
                                  updated[idx] = { ...updated[idx], title: e.target.value };
                                  setTemplateTasks(updated);
                                }}
                                className="h-7 text-xs font-semibold border-0 p-0 shadow-none focus-visible:ring-0"
                                style={{ color: '#0B3C5D', fontFamily: "'Inter', sans-serif" }}
                                data-testid={`input-template-task-title-${idx}`}
                              />
                              <Input
                                value={task.description}
                                onChange={(e) => {
                                  const updated = [...templateTasks];
                                  updated[idx] = { ...updated[idx], description: e.target.value };
                                  setTemplateTasks(updated);
                                }}
                                className="h-6 text-[10px] border-0 p-0 shadow-none focus-visible:ring-0 mt-0.5"
                                style={{ color: 'var(--text-muted)' }}
                                data-testid={`input-template-task-desc-${idx}`}
                              />
                              <div className="flex gap-1.5 mt-1">
                                <Badge className="text-[9px] font-semibold border-0 h-4" style={{ backgroundColor: `${typeConfig?.color || '#0B3C5D'}15`, color: typeConfig?.color || '#0B3C5D' }}>
                                  {typeConfig?.label || task.taskType}
                                </Badge>
                                <Badge className="text-[9px] font-semibold border-0 h-4" style={getPriorityStyle(task.priority)}>
                                  {task.priority}
                                </Badge>
                                <span className="text-[9px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                                  <Clock className="h-2.5 w-2.5 inline mr-0.5" />{task.estimatedMinutes}m
                                </span>
                                <span className="text-[9px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                                  Day {task.dayOffset + 1}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {createStep === 3 && (
                  <div className="space-y-4 py-2" data-testid="wizard-step3-content">
                    {selectedTemplate ? (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div className="p-3 rounded-xl border text-center" style={{ borderColor: 'rgba(11, 60, 93, 0.15)' }}>
                            <p className="text-lg font-bold" style={{ color: '#0B3C5D', fontFamily: "'Inter', sans-serif" }}>{selectedTaskIndices.length}</p>
                            <p className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>Total Tasks</p>
                          </div>
                          <div className="p-3 rounded-xl border text-center" style={{ borderColor: 'rgba(11, 60, 93, 0.15)' }}>
                            <p className="text-lg font-bold" style={{ color: '#4ECDC4', fontFamily: "'Inter', sans-serif" }}>
                              {Math.round(selectedTaskIndices.reduce((s, i) => s + templateTasks[i].estimatedMinutes, 0) / 60)}h {selectedTaskIndices.reduce((s, i) => s + templateTasks[i].estimatedMinutes, 0) % 60}m
                            </p>
                            <p className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>Study Time</p>
                          </div>
                          <div className="p-3 rounded-xl border text-center" style={{ borderColor: 'rgba(11, 60, 93, 0.15)' }}>
                            <p className="text-lg font-bold" style={{ color: '#0B3C5D', fontFamily: "'Inter', sans-serif" }}>
                              {selectedTaskIndices.length > 0 ? Math.max(...selectedTaskIndices.map(i => templateTasks[i].dayOffset)) + 1 : 0}
                            </p>
                            <p className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>Duration (days)</p>
                          </div>
                          <div className="p-3 rounded-xl border text-center" style={{ borderColor: 'rgba(11, 60, 93, 0.15)' }}>
                            <p className="text-lg font-bold" style={{ color: '#E88D67', fontFamily: "'Inter', sans-serif" }}>
                              {selectedTaskIndices.filter(i => templateTasks[i].priority === 'High').length}
                            </p>
                            <p className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>High Priority</p>
                          </div>
                        </div>

                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#0B3C5D' }}>Schedule Preview</p>
                          <div className="space-y-1.5">
                            {selectedTaskIndices.map(idx => {
                              const task = templateTasks[idx];
                              const dueDate = startDate ? new Date(new Date(startDate).getTime() + task.dayOffset * 86400000) : null;
                              const typeConfig = TASK_TYPE_CONFIG[task.taskType];
                              return (
                                <div key={idx} className="flex items-center gap-2.5 p-2 rounded-lg border" style={{ borderColor: 'rgba(11, 60, 93, 0.1)' }} data-testid={`review-task-${idx}`}>
                                  <div className="h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${typeConfig?.color || '#0B3C5D'}15` }}>
                                    <Check className="h-3 w-3" style={{ color: typeConfig?.color || '#0B3C5D' }} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold truncate" style={{ color: '#0B3C5D', fontFamily: "'Inter', sans-serif" }}>{task.title}</p>
                                    <div className="flex gap-2 mt-0.5">
                                      <Badge className="text-[8px] font-semibold border-0 h-3.5" style={{ backgroundColor: `${typeConfig?.color || '#0B3C5D'}15`, color: typeConfig?.color || '#0B3C5D' }}>
                                        {typeConfig?.label || task.taskType}
                                      </Badge>
                                      <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{task.estimatedMinutes}m</span>
                                    </div>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <p className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                                      {dueDate ? dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : `Day ${task.dayOffset + 1}`}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#0B3C5D' }}>Task Preview</p>
                        <div className="p-4 rounded-xl border" style={{ borderColor: 'rgba(11, 60, 93, 0.15)' }}>
                          <p className="text-sm font-bold" style={{ color: '#0B3C5D', fontFamily: "'Inter', sans-serif" }}>{newTaskTitle || 'Untitled Task'}</p>
                          {newTaskDescription && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{newTaskDescription}</p>}
                          <div className="flex gap-2 mt-2">
                            <Badge className="text-[9px] font-semibold border-0" style={{ backgroundColor: `${TASK_TYPE_CONFIG[newTaskType]?.color || '#0B3C5D'}15`, color: TASK_TYPE_CONFIG[newTaskType]?.color || '#0B3C5D' }}>
                              {TASK_TYPE_CONFIG[newTaskType]?.label || newTaskType}
                            </Badge>
                            <Badge className="text-[9px] font-semibold border-0" style={getPriorityStyle(newTaskPriority)}>{newTaskPriority}</Badge>
                            <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}><Clock className="h-2.5 w-2.5 inline mr-0.5" />{newTaskEstimatedMinutes}m</span>
                            {newTaskDueDate && <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}><Calendar className="h-2.5 w-2.5 inline mr-0.5" />{new Date(newTaskDueDate).toLocaleDateString()}</span>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>

              <DialogFooter className="flex items-center justify-between sm:justify-between">
                <div>
                  {createStep > 1 && (
                    <Button variant="outline" onClick={() => setCreateStep(createStep - 1)} className="rounded-lg text-sm" data-testid="btn-wizard-back">Back</Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setIsAddTaskOpen(false); resetTaskForm(); }} className="rounded-lg text-sm" data-testid="btn-wizard-cancel">Cancel</Button>
                  {createStep === 2 && (
                    <Button
                      onClick={() => setCreateStep(3)}
                      disabled={selectedTemplate ? selectedTaskIndices.length === 0 : !newTaskTitle.trim()}
                      className="text-white rounded-lg text-sm font-semibold"
                      style={{ backgroundColor: '#0B3C5D' }}
                      data-testid="btn-wizard-next"
                    >
                      Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  )}
                  {createStep === 3 && (
                    <Button
                      onClick={selectedTemplate ? createBatchStudyTasks : createStudyTask}
                      disabled={creatingTask}
                      className="text-white rounded-lg text-sm font-semibold"
                      style={{ backgroundColor: '#4ECDC4' }}
                      data-testid="btn-create-task"
                    >
                      {creatingTask ? 'Creating...' : selectedTemplate ? `Create ${selectedTaskIndices.length} Tasks` : 'Create Task'}
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Quick-Add Task Presets */}
        <div data-testid="quick-add-presets">
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Quick Add</p>
          <div className="flex flex-wrap gap-2">
            {taskPresets.map((preset) => {
              const Icon = preset.icon;
              return (
                <Button
                  key={preset.label}
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 rounded-lg font-semibold"
                  style={{ color: '#0B3C5D', borderColor: 'rgba(11, 60, 93, 0.25)' }}
                  onClick={() => applyPreset(preset)}
                  data-testid={`btn-preset-${preset.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <Icon className="h-3.5 w-3.5 mr-1.5" style={{ color: '#4ECDC4' }} />
                  {preset.label}
                </Button>
              );
            })}
          </div>
        </div>
        
        <ScrollArea className="h-[400px]">
          <div className="space-y-2">
            {studyTasks.length === 0 ? (
              <Card className="border border-dashed">
                <CardContent className="py-10 text-center">
                  <div className="h-14 w-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: 'rgba(11, 60, 93, 0.06)' }}>
                    <BookOpen className="h-7 w-7" style={{ color: '#0B3C5D', opacity: 0.4 }} />
                  </div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    No study tasks yet.
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Create your first task to help {childName} stay organized!
                  </p>
                </CardContent>
              </Card>
            ) : (
              studyTasks.map(task => (
                <Card key={task.id} className="border shadow-sm hover:shadow-md transition-shadow" data-testid={`task-card-${task.id}`}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {getStatusIcon(task.status)}
                        <div>
                          <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)', fontFamily: "'Inter', sans-serif" }}>{task.title}</h4>
                          {task.description && (
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{task.description}</p>
                          )}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <Badge variant="outline" className="text-[10px] font-semibold" style={{ color: '#0B3C5D', borderColor: 'rgba(11, 60, 93, 0.3)' }}>
                              {task.taskType}
                            </Badge>
                            <Badge className="text-[10px] font-semibold border-0" style={getPriorityStyle(task.priority)}>
                              {task.priority}
                            </Badge>
                            {task.estimatedMinutes && (
                              <Badge variant="outline" className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                <Clock className="h-2.5 w-2.5 mr-1" />{task.estimatedMinutes} min
                              </Badge>
                            )}
                            {task.dueDate && (
                              <Badge variant="outline" className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                <Calendar className="h-2.5 w-2.5 mr-1" />
                                {new Date(task.dueDate).toLocaleDateString()}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0 ml-2">
                        {task.status !== 'Completed' && (
                          <>
                            <QuickScheduleButton
                              eventType="study_session"
                              title={task.title}
                              description={`${task.taskType} · ${task.priority} priority${task.estimatedMinutes ? ` · ${task.estimatedMinutes} min` : ''}`}
                              referenceId={String(task.id)}
                              referenceType="study_task"
                              size="sm"
                              className="h-8 text-xs"
                            />
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="text-xs h-8 rounded-lg font-semibold"
                              style={{ color: '#0B3C5D', borderColor: 'rgba(11, 60, 93, 0.3)' }}
                              onClick={() => updateTaskStatus(task.id, task.status === 'Pending' ? 'In Progress' : 'Completed')}
                              data-testid={`btn-update-task-${task.id}`}
                            >
                              {task.status === 'Pending' ? 'Start' : 'Complete'}
                            </Button>
                          </>
                        )}
                        <Button 
                          size="sm" 
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => deleteTask(task.id)}
                          data-testid={`btn-delete-task-${task.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" style={{ color: '#dc2626' }} />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
