import { BRAND_NAVY as BRAND } from '@/design-system/tokens';
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, MessageSquare, ThumbsUp, AlertTriangle, CheckCircle, Clock,
  User, Eye, Send, Flag, Shield, HelpCircle, BookOpen, ChevronRight,
  MessageCircle, Search, TrendingUp, Flame, Star, Filter, Hash,
  Sparkles, Award, Users, Zap, Brain, Calculator, FlaskConical,
  Globe, Music, Palette, Dumbbell, X, ChevronDown, BarChart3,
  Lightbulb, GraduationCap
} from "lucide-react";



const SUBJECTS = [
  { key: 'math',      label: 'Mathematics',  icon: Calculator,    color: '#0B3C5D' },
  { key: 'science',   label: 'Science',       icon: FlaskConical,  color: '#4ECDC4' },
  { key: 'english',   label: 'English',       icon: BookOpen,      color: '#f59e0b' },
  { key: 'history',   label: 'History',       icon: Globe,         color: '#0B3C5D' },
  { key: 'computer',  label: 'Computers',     icon: Brain,         color: '#1B6B9A' },
  { key: 'art',       label: 'Arts',          icon: Palette,       color: '#4ECDC4' },
  { key: 'sports',    label: 'Sports',        icon: Dumbbell,      color: '#D97706' },
  { key: 'general',   label: 'General',       icon: Sparkles,      color: '#6b7280' },
];

const POST_TYPES = [
  { key: 'doubt',      label: 'Doubt',       color: '#0B3C5D', bg: 'bg-blue-50',   text: 'text-blue-700',   icon: HelpCircle },
  { key: 'discussion', label: 'Discussion',  color: '#4ECDC4', bg: 'bg-teal-50',  text: 'text-teal-700',  icon: MessageSquare },
  { key: 'resource',   label: 'Resource',    color: '#0B3C5D', bg: 'bg-[rgba(11,60,93,0.08)]', text: 'text-[#0B3C5D]', icon: BookOpen },
];

interface ForumPost {
  id: string;
  title: string;
  content: string;
  postType: string;
  authorId: string;
  authorName?: string;
  isAnonymous: boolean;
  upvotes: number;
  replyCount: number;
  viewCount: number;
  isResolved: boolean;
  status: string;
  createdAt: string;
  subject?: string;
  tags?: string[];
}

interface ForumReply {
  id: string;
  content: string;
  authorType: string;
  authorName?: string;
  isAnonymous: boolean;
  isAcceptedAnswer: boolean;
  upvotes: number;
  createdAt: string;
}

interface Props {
  childId?: string;
  childName?: string;
  isStudentView?: boolean;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function StudentLearningForum({ childId, childName, isStudentView = false }: Props) {
  const { toast } = useToast();

  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<ForumPost | null>(null);
  const [replies, setReplies] = useState<ForumReply[]>([]);

  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [isViewPostOpen, setIsViewPostOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostType, setNewPostType] = useState('doubt');
  const [newPostSubject, setNewPostSubject] = useState('general');
  const [newPostTags, setNewPostTags] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [newReplyContent, setNewReplyContent] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [reportTarget, setReportTarget] = useState<{ type: 'post' | 'reply'; id: string } | null>(null);

  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSubject, setFilterSubject] = useState('all');
  const [activeTab, setActiveTab] = useState<'all' | 'trending' | 'unanswered' | 'resolved'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { fetchPosts(); }, [filterType, filterStatus]);

  const fetchPosts = async () => {
    try {
      let url = '/api/forum/posts?visibility=public';
      if (filterStatus !== 'all') {
        url += `&status=${filterStatus === 'resolved' ? 'Resolved' : 'Open'}`;
      }
      const response = await fetch(url);
      if (response.ok) {
        let data = await response.json();
        if (filterType !== 'all') {
          data = data.filter((p: ForumPost) => p.postType === filterType);
        }
        setPosts(data);
      }
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    }
    setLoading(false);
  };

  const fetchPostDetails = async (postId: string) => {
    try {
      const response = await fetch(`/api/forum/posts/${postId}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedPost(data.post);
        setReplies(data.replies);
      }
    } catch (error) {
      console.error('Failed to fetch post details:', error);
    }
  };

  const createPost = async () => {
    if (!newPostTitle.trim() || !newPostContent.trim()) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }
    setPosting(true);
    try {
      const response = await fetch('/api/forum/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: newPostTitle,
          content: newPostContent,
          postType: newPostType,
          isAnonymous,
          visibility: 'public',
          targetAudience: 'all',
          childId,
          subject: newPostSubject,
          tags: newPostTags.split(',').map(t => t.trim()).filter(Boolean),
        })
      });
      if (response.ok) {
        toast({ title: 'Posted!', description: 'Your question is live. Expect answers soon!' });
        setIsCreatePostOpen(false);
        resetPostForm();
        fetchPosts();
      } else {
        throw new Error('Failed');
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to post question', variant: 'destructive' });
    }
    setPosting(false);
  };

  const submitReply = async () => {
    if (!selectedPost || !newReplyContent.trim()) {
      toast({ title: 'Error', description: 'Please enter a reply', variant: 'destructive' });
      return;
    }
    setPosting(true);
    try {
      const response = await fetch(`/api/forum/posts/${selectedPost.id}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: newReplyContent, isAnonymous })
      });
      if (response.ok) {
        toast({ title: 'Reply posted!' });
        setNewReplyContent('');
        fetchPostDetails(selectedPost.id);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to post reply', variant: 'destructive' });
    }
    setPosting(false);
  };

  const voteOnPost = async (postId: string) => {
    try {
      await fetch(`/api/forum/posts/${postId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ voteType: 'upvote' })
      });
      fetchPosts();
    } catch { /* silent */ }
  };

  const reportContent = async () => {
    if (!reportTarget || !reportReason.trim()) {
      toast({ title: 'Error', description: 'Please provide a reason', variant: 'destructive' });
      return;
    }
    try {
      await fetch('/api/forum/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          postId: reportTarget.type === 'post' ? reportTarget.id : undefined,
          replyId: reportTarget.type === 'reply' ? reportTarget.id : undefined,
          reason: reportReason
        })
      });
      toast({ title: 'Reported', description: 'Our moderators will review it.' });
      setIsReportOpen(false);
      setReportReason('');
      setReportTarget(null);
    } catch {
      toast({ title: 'Error', description: 'Failed to submit report', variant: 'destructive' });
    }
  };

  const resetPostForm = () => {
    setNewPostTitle('');
    setNewPostContent('');
    setNewPostType('doubt');
    setNewPostSubject('general');
    setNewPostTags('');
    setIsAnonymous(true);
  };

  const filteredPosts = useMemo(() => {
    let list = [...posts];
    if (filterSubject !== 'all') list = list.filter(p => (p.subject || 'general') === filterSubject);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q));
    }
    if (activeTab === 'trending')   list = [...list].sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
    if (activeTab === 'unanswered') list = list.filter(p => (p.replyCount || 0) === 0 && !p.isResolved);
    if (activeTab === 'resolved')   list = list.filter(p => p.isResolved);
    return list;
  }, [posts, filterSubject, searchQuery, activeTab]);

  const stats = useMemo(() => ({
    total: posts.length,
    resolved: posts.filter(p => p.isResolved).length,
    unanswered: posts.filter(p => (p.replyCount || 0) === 0 && !p.isResolved).length,
    totalReplies: posts.reduce((acc, p) => acc + (p.replyCount || 0), 0),
  }), [posts]);

  const getSubject = (key: string) => SUBJECTS.find(s => s.key === key) || SUBJECTS[SUBJECTS.length - 1];
  const getPostType = (key: string) => POST_TYPES.find(t => t.key === key) || POST_TYPES[0];

  return (
    <div className="space-y-0" data-testid="student-learning-forum">

      {/* ── Hero Banner ── */}
      <div className="rounded-2xl overflow-hidden mb-6 relative" style={{ background: `#1a2d6a` }}>
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full border border-white/10" />
          <div className="absolute top-6 right-32 w-24 h-24 rounded-full border border-white/10" />
        </div>
        <div className="relative z-10 px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(78,205,196,0.25)' }}>
                <Users size={16} style={{ color: BRAND.accent }} />
              </div>
              <h2 className="text-xl font-extrabold text-white tracking-tight" data-testid="forum-title">Learning Forum</h2>
            </div>
            <p className="text-white/50 text-sm">Ask questions, share knowledge, and learn together</p>

            {/* Stats row */}
            <div className="flex items-center gap-4 mt-3">
              {[
                { label: 'Questions', value: stats.total,       icon: MessageSquare, color: BRAND.accent },
                { label: 'Answered',  value: stats.resolved,    icon: CheckCircle,   color: '#34d399' },
                { label: 'Waiting',   value: stats.unanswered,  icon: Clock,         color: '#f59e0b' },
                { label: 'Replies',   value: stats.totalReplies,icon: MessageCircle, color: '#a78bfa' },
              ].map((s, i) => {
                const SIcon = s.icon;
                return (
                  <div key={i} className="flex items-center gap-1.5">
                    <SIcon size={13} style={{ color: s.color }} />
                    <span className="text-white font-bold text-sm">{s.value}</span>
                    <span className="text-white/40 text-xs">{s.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <Dialog open={isCreatePostOpen} onOpenChange={setIsCreatePostOpen}>
            <DialogTrigger asChild>
              <Button
                className="shrink-0 font-bold text-sm shadow-lg"
                style={{ backgroundColor: BRAND.accent, color: '#0f172a' }}
                data-testid="btn-ask-question"
              >
                <Plus size={16} className="mr-2" />
                Ask a Question
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles size={18} style={{ color: BRAND.accent }} />
                  Ask the Community
                </DialogTitle>
                <DialogDescription>Get help from teachers and fellow students</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="rounded-xl p-3 flex items-start gap-2" style={{ backgroundColor: 'rgba(11,60,93,0.08)', border: `1px solid ${BRAND.primary}30` }}>
                  <Shield size={16} style={{ color: BRAND.primary }} className="mt-0.5 shrink-0" />
                  <p className="text-sm" style={{ color: BRAND.primary }}>
                    <strong>Your privacy is protected.</strong> By default, your identity is hidden from other students.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label>Question Title *</Label>
                  <Input
                    value={newPostTitle}
                    onChange={e => setNewPostTitle(e.target.value)}
                    placeholder="e.g., How to solve quadratic equations?"
                    data-testid="input-post-title"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Details *</Label>
                  <Textarea
                    value={newPostContent}
                    onChange={e => setNewPostContent(e.target.value)}
                    placeholder="Describe your question in detail. Include any attempts you've made..."
                    className="min-h-[100px]"
                    data-testid="input-post-content"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Post Type</Label>
                    <Select value={newPostType} onValueChange={setNewPostType}>
                      <SelectTrigger data-testid="select-post-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="doubt">&#x2753; Doubt / Question</SelectItem>
                        <SelectItem value="discussion">&#x1F4AC; Discussion</SelectItem>
                        <SelectItem value="resource">&#x1F4DA; Share Resource</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Subject</Label>
                    <Select value={newPostSubject} onValueChange={setNewPostSubject}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SUBJECTS.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Tags <span className="text-muted-foreground font-normal">(optional, comma-separated)</span></Label>
                  <Input
                    value={newPostTags}
                    onChange={e => setNewPostTags(e.target.value)}
                    placeholder="e.g., algebra, class-10, cbse"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="anonymous"
                    checked={isAnonymous}
                    onCheckedChange={c => setIsAnonymous(c as boolean)}
                    data-testid="checkbox-anonymous"
                  />
                  <label htmlFor="anonymous" className="text-sm text-muted-foreground cursor-pointer">
                    Post anonymously (recommended for sensitive questions)
                  </label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreatePostOpen(false)}>Cancel</Button>
                <Button
                  onClick={createPost}
                  disabled={posting}
                  style={{ backgroundColor: BRAND.primary }}
                  className="text-white"
                  data-testid="btn-submit-post"
                >
                  {posting ? 'Posting...' : <><Send size={14} className="mr-2" />Post Question</>}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex gap-6">
        {/* ── Main Content ── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Search + filters bar */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search questions, topics..."
                className="pl-9"
              />
              {searchQuery && (
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setSearchQuery('')}
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[140px]" data-testid="filter-type">
                <Filter size={13} className="mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="doubt">Doubts</SelectItem>
                <SelectItem value="discussion">Discussions</SelectItem>
                <SelectItem value="resource">Resources</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[130px]" data-testid="filter-status">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Subject tag chips */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterSubject('all')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${filterSubject === 'all' ? 'text-white border-transparent' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}
              style={filterSubject === 'all' ? { backgroundColor: BRAND.primary } : {}}
            >
              <Hash size={11} />
              All Subjects
            </button>
            {SUBJECTS.map(s => {
              const SIcon = s.icon;
              const active = filterSubject === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setFilterSubject(active ? 'all' : s.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${active ? 'text-white border-transparent' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}
                  style={active ? { backgroundColor: s.color } : {}}
                >
                  <SIcon size={11} />
                  {s.label}
                </button>
              );
            })}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl bg-gray-100" style={{ width: 'fit-content' }}>
            {([
              { key: 'all',        label: 'All',        icon: MessageSquare },
              { key: 'trending',   label: 'Trending',   icon: TrendingUp },
              { key: 'unanswered', label: 'Unanswered', icon: Clock },
              { key: 'resolved',   label: 'Resolved',   icon: CheckCircle },
            ] as const).map(tab => {
              const TIcon = tab.icon;
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${active ? 'text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  style={active ? { backgroundColor: BRAND.primary } : {}}
                >
                  <TIcon size={12} />
                  {tab.label}
                  {tab.key === 'unanswered' && stats.unanswered > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>
                      {stats.unanswered}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Posts list */}
          <div className="space-y-3">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="rounded-xl border bg-white p-4 animate-pulse">
                    <div className="h-4 bg-gray-100 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
                <div className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `${BRAND.primary}10` }}>
                  <MessageSquare size={28} style={{ color: BRAND.primary }} />
                </div>
                <h3 className="font-bold text-lg text-gray-700 mb-1">No questions yet</h3>
                <p className="text-gray-400 text-sm mb-5">
                  {searchQuery ? `No results for "${searchQuery}"` : 'Be the first to ask a question in this forum!'}
                </p>
                <Button
                  onClick={() => setIsCreatePostOpen(true)}
                  style={{ backgroundColor: BRAND.primary }}
                  className="text-white"
                >
                  <Plus size={14} className="mr-2" />
                  Ask the First Question
                </Button>
              </div>
            ) : (
              filteredPosts.map((post, idx) => {
                const pt = getPostType(post.postType);
                const sub = getSubject(post.subject || 'general');
                const SubIcon = sub.icon;
                const PtIcon = pt.icon;
                const isTrending = (post.upvotes || 0) >= 5 || (post.replyCount || 0) >= 3;

                return (
                  <div
                    key={post.id}
                    className="group rounded-xl border bg-white hover:border-blue-200 hover:shadow-md transition-all cursor-pointer relative overflow-hidden"
                    onClick={() => { fetchPostDetails(post.id); setIsViewPostOpen(true); }}
                    data-testid={`forum-post-${post.id}`}
                  >
                    {post.isResolved && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ backgroundColor: '#4ECDC4' }} />
                    )}
                    <div className="p-4 pl-5">
                      <div className="flex items-start gap-4">
                        {/* Vote column */}
                        <div className="flex flex-col items-center gap-0.5 shrink-0 min-w-[44px]">
                          <button
                            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-blue-50 transition-colors group/vote"
                            onClick={e => { e.stopPropagation(); voteOnPost(post.id); }}
                            data-testid={`btn-upvote-${post.id}`}
                          >
                            <ThumbsUp size={15} className="text-gray-400 group-hover/vote:text-blue-500 transition-colors" />
                          </button>
                          <span className="text-sm font-bold text-gray-700">{post.upvotes || 0}</span>
                          <span className="text-[9px] text-gray-400 uppercase tracking-wide">votes</span>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-2">
                            {/* Post type badge */}
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${pt.bg} ${pt.text}`}>
                              <PtIcon size={9} />
                              {pt.label}
                            </span>
                            {/* Subject badge */}
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: `${sub.color}15`, color: sub.color }}>
                              <SubIcon size={9} />
                              {sub.label}
                            </span>
                            {isTrending && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-600">
                                <Flame size={9} />
                                Hot
                              </span>
                            )}
                            {post.isResolved && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700">
                                <CheckCircle size={9} />
                                Resolved
                              </span>
                            )}
                          </div>

                          <h4 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1 mb-1">
                            {post.title}
                          </h4>
                          <p className="text-sm text-gray-500 line-clamp-2 mb-3">{post.content}</p>

                          {/* Tags if any */}
                          {post.tags && post.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {post.tags.slice(0, 4).map(tag => (
                                <span key={tag} className="px-2 py-0.5 rounded text-[10px] bg-gray-100 text-gray-500">#{tag}</span>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center gap-4 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                              <User size={11} />
                              {post.isAnonymous ? 'Anonymous' : (post.authorName || 'Student')}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageCircle size={11} />
                              {post.replyCount || 0} replies
                            </span>
                            <span className="flex items-center gap-1">
                              <Eye size={11} />
                              {post.viewCount || 0} views
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock size={11} />
                              {timeAgo(post.createdAt)}
                            </span>
                          </div>
                        </div>

                        <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 shrink-0 mt-1 transition-colors" />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div className="w-64 shrink-0 hidden lg:block space-y-4">

          {/* Community Stats */}
          <div className="rounded-xl border bg-white p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <BarChart3 size={14} style={{ color: BRAND.primary }} />
              Community Stats
            </h3>
            <div className="space-y-2">
              {[
                { label: 'Total Questions', value: stats.total,        color: BRAND.primary },
                { label: 'Answered',        value: stats.resolved,     color: '#4ECDC4' },
                { label: 'Awaiting Answer', value: stats.unanswered,   color: '#f59e0b' },
                { label: 'Total Replies',   value: stats.totalReplies, color: '#0B3C5D' },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{s.label}</span>
                  <span className="text-sm font-bold" style={{ color: s.color }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* How to participate */}
          <div className="rounded-xl border bg-white p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <Lightbulb size={14} style={{ color: '#f59e0b' }} />
              How to Participate
            </h3>
            <div className="space-y-2.5">
              {[
                { icon: HelpCircle, color: '#0B3C5D', label: 'Post a Doubt', desc: 'Ask about concepts you find tricky' },
                { icon: MessageSquare, color: '#4ECDC4', label: 'Start a Discussion', desc: 'Share ideas and explore topics' },
                { icon: BookOpen, color: '#0B3C5D', label: 'Share Resources', desc: 'Post helpful links or notes' },
                { icon: ThumbsUp, color: '#f59e0b', label: 'Vote & Reply', desc: 'Help others and earn XP' },
              ].map(item => {
                const IIcon = item.icon;
                return (
                  <div key={item.label} className="flex items-start gap-2">
                    <div className="h-6 w-6 rounded flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: `${item.color}15` }}>
                      <IIcon size={11} style={{ color: item.color }} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-700 leading-none mb-0.5">{item.label}</p>
                      <p className="text-[10px] text-gray-400 leading-tight">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Community Rules */}
          <div className="rounded-xl p-4" style={{ background: `${BRAND.primary}`, border: `1px solid ${BRAND.primary}20` }}>
            <h3 className="text-sm font-bold mb-2 flex items-center gap-1.5" style={{ color: BRAND.primary }}>
              <Shield size={13} />
              Community Rules
            </h3>
            <ul className="space-y-1.5">
              {[
                'Be kind and respectful',
                'No sharing of exam paper answers',
                'Credit sources when sharing resources',
                'Keep discussions on-topic',
                'Report inappropriate content',
              ].map((rule, i) => (
                <li key={i} className="text-[11px] text-gray-600 flex items-start gap-1.5">
                  <span className="text-[10px] font-bold mt-0.5" style={{ color: BRAND.accent }}>{i + 1}.</span>
                  {rule}
                </li>
              ))}
            </ul>
          </div>

          {/* Earn XP tip */}
          <div className="rounded-xl p-4 text-white relative overflow-hidden" style={{ background: `#0B3C5D` }}>
            <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full border border-white/20" />
            <Zap size={20} className="text-yellow-300 mb-2" />
            <p className="text-xs font-bold mb-1">Earn XP by helping!</p>
            <p className="text-[10px] text-white/70">Answer questions and get upvotes to earn XP and climb the leaderboard.</p>
          </div>
        </div>
      </div>

      {/* ── View Post Dialog ── */}
      <Dialog open={isViewPostOpen} onOpenChange={setIsViewPostOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedPost && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {(() => {
                    const pt = getPostType(selectedPost.postType);
                    const sub = getSubject(selectedPost.subject || 'general');
                    const PtIcon = pt.icon;
                    const SubIcon = sub.icon;
                    return (
                      <>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${pt.bg} ${pt.text}`}><PtIcon size={9} />{pt.label}</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: `${sub.color}15`, color: sub.color }}><SubIcon size={9} />{sub.label}</span>
                        {selectedPost.isResolved && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700"><CheckCircle size={9} />Resolved</span>}
                      </>
                    );
                  })()}
                </div>
                <DialogTitle className="text-xl leading-snug">{selectedPost.title}</DialogTitle>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><User size={11} />{selectedPost.isAnonymous ? 'Anonymous' : (selectedPost.authorName || 'Student')}</span>
                  <span className="flex items-center gap-1"><Clock size={11} />{timeAgo(selectedPost.createdAt)}</span>
                  <span className="flex items-center gap-1"><Eye size={11} />{selectedPost.viewCount || 0} views</span>
                </div>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="rounded-xl p-4 bg-gray-50 border">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{selectedPost.content}</p>
                  {selectedPost.tags && selectedPost.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {selectedPost.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 rounded text-[10px] bg-white border text-gray-500">#{tag}</span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <button
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium hover:bg-blue-50 hover:border-blue-300 transition-all"
                    onClick={() => voteOnPost(selectedPost.id)}
                    data-testid="btn-upvote-detail"
                  >
                    <ThumbsUp size={14} />
                    {selectedPost.upvotes || 0} Upvotes
                  </button>
                  <button
                    className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 transition-colors"
                    onClick={() => { setReportTarget({ type: 'post', id: selectedPost.id }); setIsReportOpen(true); }}
                    data-testid="btn-report-post"
                  >
                    <Flag size={12} />
                    Report
                  </button>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <MessageCircle size={14} style={{ color: BRAND.primary }} />
                    {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
                  </h4>

                  <div className="space-y-3 mb-4">
                    {replies.length === 0 ? (
                      <div className="text-center py-6 text-gray-400">
                        <MessageCircle size={28} className="mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No replies yet. Be the first to help!</p>
                      </div>
                    ) : replies.map(reply => (
                      <div
                        key={reply.id}
                        className={`p-3 rounded-xl border ${reply.isAcceptedAnswer ? 'bg-teal-50 border-teal-200' : 'bg-gray-50 border-gray-100'}`}
                        data-testid={`reply-${reply.id}`}
                      >
                        {reply.isAcceptedAnswer && (
                          <div className="flex items-center gap-1.5 mb-2">
                            <CheckCircle size={13} className="text-teal-600" />
                            <span className="text-xs font-bold text-teal-700">Accepted Answer</span>
                          </div>
                        )}
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{reply.content}</p>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-3 text-xs text-gray-400">
                            <span className="flex items-center gap-1"><User size={10} />{reply.isAnonymous ? 'Anonymous' : (reply.authorName || reply.authorType)}</span>
                            <span>{timeAgo(reply.createdAt)}</span>
                          </div>
                          <button
                            className="text-red-300 hover:text-red-500 transition-colors"
                            onClick={() => { setReportTarget({ type: 'reply', id: reply.id }); setIsReportOpen(true); }}
                          >
                            <Flag size={11} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Reply box */}
                  <div className="rounded-xl border p-3 space-y-2 bg-white">
                    <Textarea
                      value={newReplyContent}
                      onChange={e => setNewReplyContent(e.target.value)}
                      placeholder="Write a helpful reply..."
                      className="border-0 p-0 resize-none focus-visible:ring-0 min-h-[80px] text-sm"
                      data-testid="input-reply"
                    />
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-1.5">
                        <Checkbox
                          id="reply-anon"
                          checked={isAnonymous}
                          onCheckedChange={c => setIsAnonymous(c as boolean)}
                        />
                        <label htmlFor="reply-anon" className="text-xs text-gray-500 cursor-pointer">Reply anonymously</label>
                      </div>
                      <Button
                        size="sm"
                        onClick={submitReply}
                        disabled={posting || !newReplyContent.trim()}
                        style={{ backgroundColor: BRAND.primary }}
                        className="text-white"
                        data-testid="btn-submit-reply"
                      >
                        <Send size={13} className="mr-1.5" />
                        {posting ? 'Posting...' : 'Reply'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Report Dialog ── */}
      <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle size={18} />
              Report Content
            </DialogTitle>
            <DialogDescription>
              Let our moderators know why this content is inappropriate.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              {['Inappropriate language', 'Spam', 'Sharing answers', 'Bullying', 'Off-topic', 'Other'].map(r => (
                <button
                  key={r}
                  onClick={() => setReportReason(r)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border text-left transition-all ${reportReason === r ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}
                >
                  {r}
                </button>
              ))}
            </div>
            <Textarea
              value={reportReason}
              onChange={e => setReportReason(e.target.value)}
              placeholder="Or describe the issue in your own words..."
              className="min-h-[80px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReportOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={reportContent} disabled={!reportReason.trim()}>
              <Flag size={14} className="mr-2" />
              Submit Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
