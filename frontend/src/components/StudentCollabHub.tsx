import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Users, MessageCircle, BookOpen, UserPlus, UserX, Send,
  Search, Plus, Shield, CheckCheck, ArrowLeft, Trash2,
  Globe, Lock, MessageSquare, FlaskConical, Calculator,
  Palette, Brain, Dumbbell, X, Check, Bell,Reply,
  Smile, MoreHorizontal, Star, Hash, Award, TrendingUp,
  UserCheck, Filter, AtSign, Mic, Phone, Video,
  CheckCircle, Circle, Activity, ChevronRight, ImageIcon,
  PaperclipIcon, Info, LogOut, Settings, Eye
} from 'lucide-react';

const BRAND = { primary: '#0B3C5D', accent: '#4ECDC4' };

function collabFetch(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem('metryx_token');
  return fetch(url, {
    ...options,
    headers: {
      ...((options.headers as Record<string, string>) || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

const SUBJECT_COLORS: Record<string, string> = {
  math: '#0B3C5D', science: '#4ECDC4', english: '#f59e0b',
  history: '#0B3C5D', computer: '#1B6B9A', art: '#4ECDC4',
  sports: '#D97706', general: '#6b7280',
};
const SUBJECTS = [
  { key: 'general', label: 'General', icon: Globe },
  { key: 'math', label: 'Mathematics', icon: Calculator },
  { key: 'science', label: 'Science', icon: FlaskConical },
  { key: 'english', label: 'English', icon: BookOpen },
  { key: 'history', label: 'History', icon: Globe },
  { key: 'computer', label: 'Computers', icon: Brain },
  { key: 'art', label: 'Arts', icon: Palette },
  { key: 'sports', label: 'Sports', icon: Dumbbell },
];
const GROUP_COLORS = ['#0B3C5D','#0B3C5D','#0891b2','#4ECDC4','#d97706','#dc2626','#db2777'];
const QUICK_EMOJIS = ['👍','❤️','😂','🎉','🔥','👀','🙏','💯'];
const AVATAR_BG_POOL = ['#0B3C5D','#0B3C5D','#0891b2','#4ECDC4','#d97706','#db2777','#dc2626','#0f766e'];

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function msgTime(d: string) {
  const date = new Date(d);
  const diff = Date.now() - date.getTime();
  if (diff < 86400000) return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function colorFromName(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % AVATAR_BG_POOL.length;
  return AVATAR_BG_POOL[Math.abs(h)];
}

function isOnline(id: string) {
  return parseInt(id, 16) % 3 !== 0;
}

function Avatar({ name, avatar, color, size = 40, online, ring }: {
  name?: string; avatar?: string; color?: string; size?: number; online?: boolean; ring?: boolean;
}) {
  const initials = (name || 'S').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const bg = color || colorFromName(name || 'S');
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {ring && online && (
        <div className="absolute inset-0 rounded-full animate-pulse"
          style={{ boxShadow: `0 0 0 2px #4ECDC4`, borderRadius: '50%', zIndex: 0 }} />
      )}
      {avatar
        ? <img src={avatar} alt={name} className="rounded-full object-cover w-full h-full relative z-10" style={{ border: ring && online ? '2px solid #4ECDC4' : 'none' }} />
        : <div className="rounded-full flex items-center justify-center font-bold text-white w-full h-full relative z-10"
            style={{ backgroundColor: bg, fontSize: size * 0.35, border: ring && online ? '2px solid #4ECDC4' : 'none' }}>{initials}</div>
      }
      {online !== undefined && !ring && (
        <span className="absolute bottom-0 right-0 rounded-full border-2 border-white z-20"
          style={{ width: size * 0.28, height: size * 0.28, backgroundColor: online ? '#4ECDC4' : '#94a3b8' }} />
      )}
      {ring && online && (
        <span className="absolute bottom-0 right-0 rounded-full border-2 border-white z-20"
          style={{ width: size * 0.28, height: size * 0.28, backgroundColor: '#4ECDC4' }} />
      )}
    </div>
  );
}

function AvatarStack({ names, size = 24, max = 3 }: { names: string[]; size?: number; max?: number }) {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((n, i) => (
        <div key={i} className="rounded-full border-2 border-white" style={{ marginLeft: i > 0 ? -(size * 0.35) : 0 }}>
          <Avatar name={n} size={size} />
        </div>
      ))}
      {extra > 0 && (
        <div className="rounded-full border-2 border-white flex items-center justify-center text-white font-bold"
          style={{ width: size, height: size, backgroundColor: '#94a3b8', fontSize: size * 0.32, marginLeft: -(size * 0.35) }}>
          +{extra}
        </div>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 animate-pulse">
      <div className="w-10 h-10 rounded-full bg-gray-200 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-gray-200 rounded w-1/2" />
        <div className="h-2.5 bg-gray-100 rounded w-1/3" />
      </div>
      <div className="h-7 w-16 bg-gray-100 rounded-lg" />
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-end gap-1.5 px-4 py-3 max-w-[80px]">
      {[0, 1, 2].map(i => (
        <span key={i} className="w-2 h-2 rounded-full bg-gray-400 inline-block"
          style={{ animation: `typingBounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
      ))}
      <style>{`
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

type Tab = 'network' | 'groups' | 'messages';
interface Connection { id: string; peer_id: string; peer_name: string; peer_avatar?: string; status: string; created_at: string; }
interface Request { id: string; peer_name: string; peer_avatar?: string; direction: 'incoming' | 'outgoing'; message?: string; created_at: string; requester_id: string; addressee_id: string; }
interface Suggestion { id: string; name: string; avatar?: string; metadata?: any; }
interface Group { id: string; name: string; description?: string; subject?: string; tags?: string[]; visibility: string; member_count: number; my_role?: string; is_member: boolean; creator_name: string; avatar_color?: string; updated_at: string; max_members?: number; }
interface GroupMessage { id: string; content: string; sender_id: string; sender_name: string; sender_avatar?: string; created_at: string; is_deleted: boolean; reply_to_id?: string; reply_to_content?: string; }
interface DmThread { id: string; peer_id: string; peer_name: string; peer_avatar?: string; content: string; sender_id: string; created_at: string; unread_count: number; }
interface DmMessage { id: string; content: string; sender_id: string; sender_name: string; sender_avatar?: string; created_at: string; is_read: boolean; }
interface Reaction { emoji: string; count: number; mine: boolean; }

interface Props { currentUserId?: string; currentUserName?: string; }

export function StudentCollabHub({ currentUserId, currentUserName }: Props) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('network');

  const [connections, setConnections] = useState<Connection[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [networkSearch, setNetworkSearch] = useState('');
  const [suggSearch, setSuggSearch] = useState('');
  const [loadingNetwork, setLoadingNetwork] = useState(true);
  const [pendingRequests, setPendingRequests] = useState<Set<string>>(new Set());

  const [groups, setGroups] = useState<Group[]>([]);
  const [groupTab, setGroupTab] = useState<'mine' | 'discover'>('mine');
  const [groupSearch, setGroupSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [groupMyRole, setGroupMyRole] = useState('');
  const [groupInput, setGroupInput] = useState('');
  const [groupReplyTo, setGroupReplyTo] = useState<GroupMessage | null>(null);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '', description: '', subject: 'general', visibility: 'public', avatarColor: GROUP_COLORS[0] });
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [showGroupMembers, setShowGroupMembers] = useState(false);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);

  const [dmThreads, setDmThreads] = useState<DmThread[]>([]);
  const [selectedPeer, setSelectedPeer] = useState<{ id: string; name: string; avatar?: string } | null>(null);
  const [dmMessages, setDmMessages] = useState<DmMessage[]>([]);
  const [dmInput, setDmInput] = useState('');
  const [dmReplyTo, setDmReplyTo] = useState<DmMessage | null>(null);
  const [dmSearch, setDmSearch] = useState('');
  const [loadingDm, setLoadingDm] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [hoveredMsg, setHoveredMsg] = useState<string | null>(null);
  const [showEmojiBar, setShowEmojiBar] = useState<string | null>(null);

  const [msgReactions, setMsgReactions] = useState<Record<string, Reaction[]>>({});

  const chatEndRef = useRef<HTMLDivElement>(null);
  const groupChatEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dmInputRef = useRef<HTMLInputElement>(null);
  const groupInputRef = useRef<HTMLInputElement>(null);

  const fetchNetwork = useCallback(async () => {
    try {
      const [cRes, rRes, sRes] = await Promise.all([
        collabFetch('/api/collab/connections'),
        collabFetch('/api/collab/connections/requests'),
        collabFetch('/api/collab/connections/suggestions'),
      ]);
      if (cRes.ok) setConnections(await cRes.json());
      if (rRes.ok) setRequests(await rRes.json());
      if (sRes.ok) setSuggestions(await sRes.json());
    } catch { }
    setLoadingNetwork(false);
  }, []);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await collabFetch('/api/collab/groups');
      if (res.ok) setGroups(await res.json());
    } catch { }
    setLoadingGroups(false);
  }, []);

  const fetchDmInbox = useCallback(async () => {
    try {
      const res = await collabFetch('/api/collab/dm/inbox');
      if (res.ok) setDmThreads(await res.json());
    } catch { }
    setLoadingDm(false);
  }, []);

  const fetchDmThread = useCallback(async (peerId: string) => {
    try {
      const res = await collabFetch(`/api/collab/dm/${peerId}`);
      if (res.ok) {
        setDmMessages(await res.json());
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
      }
    } catch { }
  }, []);

  const fetchGroupMessages = useCallback(async (groupId: string) => {
    try {
      const res = await collabFetch(`/api/collab/groups/${groupId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setGroupMessages(data.messages);
        setGroupMyRole(data.myRole);
        setTimeout(() => groupChatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
      }
    } catch { }
  }, []);

  const fetchGroupMembers = useCallback(async (groupId: string) => {
    try {
      const res = await collabFetch(`/api/collab/groups/${groupId}/members`);
      if (res.ok) setGroupMembers(await res.json());
    } catch { }
  }, []);

  useEffect(() => { fetchNetwork(); fetchGroups(); fetchDmInbox(); }, []);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      if (selectedPeer) fetchDmThread(selectedPeer.id);
      if (selectedGroup) fetchGroupMessages(selectedGroup.id);
      fetchDmInbox();
    }, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selectedPeer, selectedGroup]);

  useEffect(() => {
    if (!selectedPeer) return;
    if (Math.random() > 0.7) {
      const t = setTimeout(() => {
        setIsTyping(true);
        setTimeout(() => setIsTyping(false), 2500 + Math.random() * 2000);
      }, 3000 + Math.random() * 5000);
      return () => clearTimeout(t);
    }
  }, [selectedPeer, dmMessages.length]);

  const sendConnectionRequest = async (addresseeId: string) => {
    setPendingRequests(s => new Set(s).add(addresseeId));
    try {
      const res = await collabFetch('/api/collab/connections/request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresseeId }),
      });
      if (res.ok) { toast({ title: 'Request sent!' }); fetchNetwork(); }
      else setPendingRequests(s => { const n = new Set(s); n.delete(addresseeId); return n; });
    } catch {
      setPendingRequests(s => { const n = new Set(s); n.delete(addresseeId); return n; });
    }
  };

  const handleRequest = async (reqId: string, action: 'accept' | 'decline') => {
    try {
      const res = await collabFetch(`/api/collab/connections/${reqId}/${action}`, { method: 'PATCH' });
      if (res.ok) { toast({ title: action === 'accept' ? 'Connected!' : 'Request declined' }); fetchNetwork(); }
    } catch { }
  };

  const removeConnection = async (connId: string) => {
    try {
      await collabFetch(`/api/collab/connections/${connId}`, { method: 'DELETE' });
      setConnections(c => c.filter(x => x.id !== connId));
      toast({ title: 'Connection removed' });
    } catch { }
  };

  const sendDm = async () => {
    if (!selectedPeer || !dmInput.trim()) return;
    const content = dmInput.trim();
    setDmInput('');
    setDmReplyTo(null);
    try {
      const res = await collabFetch(`/api/collab/dm/${selectedPeer.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (res.ok) { fetchDmThread(selectedPeer.id); fetchDmInbox(); }
    } catch { }
  };

  const sendGroupMessage = async () => {
    if (!selectedGroup || !groupInput.trim()) return;
    const content = groupInput.trim();
    setGroupInput('');
    setGroupReplyTo(null);
    try {
      const res = await collabFetch(`/api/collab/groups/${selectedGroup.id}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, replyToId: groupReplyTo?.id }),
      });
      if (res.ok) fetchGroupMessages(selectedGroup.id);
    } catch { }
  };

  const deleteGroupMessage = async (msgId: string) => {
    if (!selectedGroup) return;
    await collabFetch(`/api/collab/groups/${selectedGroup.id}/messages/${msgId}`, { method: 'DELETE' });
    fetchGroupMessages(selectedGroup.id);
  };

  const joinGroup = async (groupId: string) => {
    const res = await collabFetch(`/api/collab/groups/${groupId}/join`, { method: 'POST' });
    if (res.ok) { toast({ title: 'Joined!' }); fetchGroups(); }
    else { const d = await res.json(); toast({ title: d.error || 'Error', variant: 'destructive' }); }
  };

  const leaveGroup = async (groupId: string) => {
    await collabFetch(`/api/collab/groups/${groupId}/leave`, { method: 'DELETE' });
    toast({ title: 'Left group' });
    setSelectedGroup(null);
    fetchGroups();
  };

  const createGroup = async () => {
    if (!newGroup.name.trim()) { toast({ title: 'Name required', variant: 'destructive' }); return; }
    const res = await collabFetch('/api/collab/groups', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newGroup }),
    });
    if (res.ok) {
      toast({ title: 'Group created!' });
      setIsCreateGroupOpen(false);
      setNewGroup({ name: '', description: '', subject: 'general', visibility: 'public', avatarColor: GROUP_COLORS[0] });
      fetchGroups();
    }
  };

  const toggleReaction = (msgId: string, emoji: string) => {
    setMsgReactions(prev => {
      const current = prev[msgId] || [];
      const existing = current.find(r => r.emoji === emoji);
      if (existing) {
        return {
          ...prev,
          [msgId]: existing.mine
            ? current.map(r => r.emoji === emoji ? { ...r, count: r.count - 1, mine: false } : r).filter(r => r.count > 0)
            : current.map(r => r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r),
        };
      }
      return { ...prev, [msgId]: [...current, { emoji, count: 1, mine: true }] };
    });
    setShowEmojiBar(null);
  };

  const openGroupChat = (g: Group) => { setSelectedGroup(g); fetchGroupMessages(g.id); fetchGroupMembers(g.id); };
  const openDm = (peer: { id: string; name: string; avatar?: string }) => {
    setSelectedPeer(peer); fetchDmThread(peer.id); setActiveTab('messages');
  };

  const filteredConnections = connections.filter(c => c.peer_name.toLowerCase().includes(networkSearch.toLowerCase()));
  const filteredSuggestions = suggestions.filter(s => s.name.toLowerCase().includes(suggSearch.toLowerCase()));
  const incoming = requests.filter(r => r.direction === 'incoming');
  const outgoing = requests.filter(r => r.direction === 'outgoing');
  const myGroups = groups.filter(g => g.is_member);
  const discoverGroups = groups.filter(g => !g.is_member);
  const filteredGroups = (groupTab === 'mine' ? myGroups : discoverGroups)
    .filter(g => g.name.toLowerCase().includes(groupSearch.toLowerCase()));
  const filteredDmThreads = dmThreads.filter(t =>
    t.peer_name.toLowerCase().includes(dmSearch.toLowerCase()) ||
    t.content?.toLowerCase().includes(dmSearch.toLowerCase())
  );
  const totalUnread = dmThreads.reduce((a, t) => a + Number(t.unread_count), 0);

  const TAB_CONFIG = [
    { id: 'network' as Tab, label: 'My Network', icon: Users, badge: incoming.length },
    { id: 'groups' as Tab, label: 'Study Groups', icon: BookOpen, badge: 0 },
    { id: 'messages' as Tab, label: 'Messages', icon: MessageCircle, badge: totalUnread },
  ];

  return (
    <div className="space-y-0" data-testid="student-collab-hub">

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden mb-5 relative" style={{ background: '#0a1340' }}>
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-10" style={{ background: `${BRAND.accent}` }} />
          <div className="absolute bottom-0 left-1/4 w-64 h-64 rounded-full opacity-5" style={{ background: `${BRAND.primary}` }} />
          <svg className="absolute inset-0 w-full h-full opacity-5" viewBox="0 0 400 200" fill="none">
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="white" strokeWidth="0.5"/>
            </pattern>
            <rect width="400" height="200" fill="url(#grid)"/>
          </svg>
        </div>

        <div className="relative z-10 px-6 pt-5 pb-4">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: `${BRAND.accent}20`, border: `1px solid ${BRAND.accent}40` }}>
                  <Users size={20} style={{ color: BRAND.accent }} />
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold text-white tracking-tight leading-none">Collaboration Hub</h2>
                  <p className="text-white/40 text-xs mt-0.5 tracking-wide">Connect · Collaborate · Excel Together</p>
                </div>
              </div>

              <div className="flex items-center gap-6 mt-2">
                {[
                  { label: 'Connections', value: connections.length, color: BRAND.accent, onClick: () => setActiveTab('network') },
                  { label: 'My Groups', value: myGroups.length, color: '#a78bfa', onClick: () => setActiveTab('groups') },
                  { label: 'Pending', value: incoming.length, color: '#fbbf24', onClick: () => setActiveTab('network') },
                  { label: 'Unread', value: totalUnread, color: '#f87171', onClick: () => setActiveTab('messages') },
                ].map(s => (
                  <button key={s.label} onClick={s.onClick} className="text-left group">
                    <div className="text-xl font-black" style={{ color: s.color }}>{s.value}</div>
                    <div className="text-[10px] text-white/40 group-hover:text-white/70 transition-colors tracking-wide uppercase">{s.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => { setActiveTab('groups'); setIsCreateGroupOpen(true); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-95"
                style={{ backgroundColor: BRAND.accent, color: '#0f172a' }}
              >
                <Plus size={15} />Create Study Group
              </button>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-white/40 uppercase tracking-widest">Social XP Progress</span>
              <span className="text-[10px] text-white/40">{connections.length * 10} / 50 XP</span>
            </div>
            <div className="h-1 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${Math.min(100, connections.length * 20)}%`, background: `${BRAND.primary}` }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── TABS ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-0 bg-white border rounded-2xl p-1 w-fit mb-5 shadow-sm">
        {TAB_CONFIG.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className="relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={activeTab === t.id ? { backgroundColor: BRAND.primary, color: 'white' } : { color: '#6b7280' }}>
            <t.icon size={15} />
            <span className="hidden sm:inline">{t.label}</span>
            {!!t.badge && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-0.5 ${activeTab === t.id ? 'bg-white/25 text-white' : 'bg-red-500 text-white'}`}>
                {t.badge > 99 ? '99+' : t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ════════════════════ NETWORK TAB ════════════════════ */}
      {activeTab === 'network' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          <div className="lg:col-span-2 space-y-4">

            {/* Incoming requests — premium alert style */}
            {incoming.length > 0 && (
              <div className="rounded-2xl overflow-hidden border border-amber-200/60 shadow-sm" style={{ background: '#fffbeb' }}>
                <div className="px-5 py-3 flex items-center gap-2 border-b border-amber-200/60">
                  <div className="h-6 w-6 rounded-full bg-amber-400/20 flex items-center justify-center">
                    <Bell size={12} className="text-amber-600" />
                  </div>
                  <span className="text-sm font-bold text-amber-800">{incoming.length} pending connection request{incoming.length > 1 ? 's' : ''}</span>
                  <span className="ml-auto text-[10px] text-amber-500 font-medium">Waiting for you</span>
                </div>
                <div className="divide-y divide-amber-100">
                  {incoming.map(r => (
                    <div key={r.id} className="flex items-center gap-3 px-5 py-4 hover:bg-amber-50/50 transition-colors">
                      <Avatar name={r.peer_name} avatar={r.peer_avatar} size={48} ring online />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-gray-900">{r.peer_name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{r.message || 'Wants to connect with you'}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(r.created_at)} ago</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => handleRequest(r.id, 'accept')}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90"
                          style={{ backgroundColor: BRAND.primary }}>
                          <Check size={12} />Accept
                        </button>
                        <button onClick={() => handleRequest(r.id, 'decline')}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-red-200 text-red-500 bg-white hover:bg-red-50 transition-all">
                          <X size={12} />Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* My Connections */}
            <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b bg-gray-50/50 flex items-center gap-3">
                <div className="relative flex-1">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={networkSearch} onChange={e => setNetworkSearch(e.target.value)}
                    placeholder="Search your connections..."
                    className="w-full pl-9 pr-4 py-2 text-sm border rounded-xl focus:outline-none focus:ring-2 bg-white"
                    style={{ '--tw-ring-color': BRAND.primary } as any} />
                </div>
                <div className="flex items-center gap-1.5 shrink-0 text-xs text-gray-500 font-medium">
                  <span className="h-2 w-2 rounded-full bg-teal-400 animate-pulse" />
                  {filteredConnections.length} connected
                </div>
              </div>

              {loadingNetwork ? (
                <div className="divide-y">{[1,2,3].map(i => <SkeletonCard key={i} />)}</div>
              ) : filteredConnections.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                    <Users size={28} className="text-gray-300" />
                  </div>
                  <p className="text-sm font-bold text-gray-500">{networkSearch ? 'No results' : 'No connections yet'}</p>
                  <p className="text-xs text-gray-400 mt-1">Discover students on the right →</p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredConnections.map(c => {
                    const online = isOnline(c.peer_id);
                    return (
                      <div key={c.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 group transition-colors">
                        <Avatar name={c.peer_name} avatar={c.peer_avatar} size={46} online={online} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-bold text-sm text-gray-900">{c.peer_name}</p>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border"
                              style={{ color: BRAND.primary, borderColor: `${BRAND.primary}30`, backgroundColor: `${BRAND.primary}08` }}>
                              1st
                            </span>
                            {online && <span className="text-[9px] font-bold text-teal-500 bg-teal-50 px-1.5 py-0.5 rounded-full">● Active</span>}
                          </div>
                          <p className="text-[11px] text-gray-400">Student · Connected {timeAgo(c.created_at)} ago</p>
                        </div>
                        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200">
                          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
                            onClick={() => openDm({ id: c.peer_id, name: c.peer_name, avatar: c.peer_avatar })}>
                            <MessageCircle size={12} />Message
                          </button>
                          <button className="h-8 w-8 flex items-center justify-center rounded-lg border text-red-400 hover:bg-red-50 transition-colors"
                            onClick={() => removeConnection(c.id)} title="Remove">
                            <UserX size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Outgoing pending */}
            {outgoing.length > 0 && (
              <div className="rounded-2xl border bg-white overflow-hidden shadow-sm">
                <div className="px-5 py-3 border-b bg-gray-50/50 flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-700">Sent Requests</span>
                  <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-semibold">{outgoing.length} pending</span>
                </div>
                <div className="divide-y">
                  {outgoing.map(r => (
                    <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                      <Avatar name={r.peer_name} avatar={r.peer_avatar} size={40} />
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-gray-800">{r.peer_name}</p>
                        <p className="text-[11px] text-gray-400">Sent {timeAgo(r.created_at)} ago</p>
                      </div>
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border border-amber-200 text-amber-600 bg-amber-50">Pending</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-4">

            {/* People you may know — LinkedIn style */}
            <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50/50">
                <p className="text-sm font-bold text-gray-800">People You May Know</p>
                <div className="relative mt-2">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={suggSearch} onChange={e => setSuggSearch(e.target.value)}
                    placeholder="Find students..."
                    className="w-full pl-7 pr-3 py-1.5 text-xs border rounded-lg focus:outline-none bg-white" />
                </div>
              </div>
              {loadingNetwork ? (
                <div className="divide-y">{[1,2,3].map(i => <SkeletonCard key={i} />)}</div>
              ) : filteredSuggestions.length === 0 ? (
                <div className="py-10 text-center">
                  <UserCheck size={28} className="mx-auto mb-2 text-gray-200" />
                  <p className="text-sm text-gray-400">{suggSearch ? 'No students found' : "You've connected with everyone!"}</p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredSuggestions.map(s => {
                    const isPending = pendingRequests.has(s.id);
                    const online = isOnline(s.id);
                    return (
                      <div key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group">
                        <Avatar name={s.name} avatar={s.avatar} size={40} online={online} />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-xs text-gray-900 truncate">{s.name}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                            Student {online && <><span className="h-1.5 w-1.5 rounded-full bg-teal-400" />Active</>}
                          </p>
                        </div>
                        <button
                          className={`flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-bold border transition-all ${isPending ? 'border-gray-200 text-gray-400 bg-gray-50' : 'text-white border-transparent hover:opacity-90'}`}
                          style={!isPending ? { backgroundColor: BRAND.primary } : {}}
                          onClick={() => !isPending && sendConnectionRequest(s.id)} disabled={isPending}>
                          {isPending ? <><Check size={11} />Sent</> : <><UserPlus size={11} />Connect</>}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Network Stats */}
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={13} style={{ color: BRAND.primary }} />
                <p className="text-xs font-bold text-gray-700">Your Network Stats</p>
              </div>
              <div className="space-y-3.5">
                {[
                  { label: 'Connections', val: connections.length, max: 50, color: BRAND.primary },
                  { label: 'Study Groups', val: myGroups.length, max: 10, color: '#0B3C5D' },
                  { label: 'XP Earned', val: connections.length * 10 + myGroups.length * 15, max: 200, color: BRAND.accent },
                ].map(s => (
                  <div key={s.label}>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-[11px] text-gray-500 font-medium">{s.label}</span>
                      <span className="text-[11px] font-bold" style={{ color: s.color }}>{s.val}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(100, (s.val / s.max) * 100)}%`, backgroundColor: s.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Social Learner Badge */}
            <div className="rounded-2xl p-4 shadow-sm" style={{ border: `1px solid ${BRAND.primary}20`, background: `${BRAND.primary}` }}>
              <div className="flex items-center gap-2 mb-2">
                <Award size={15} style={{ color: BRAND.accent }} />
                <p className="text-xs font-bold" style={{ color: BRAND.primary }}>Social Learner Badge</p>
              </div>
              <p className="text-[11px] text-gray-500 mb-3">Connect with 5 students to earn your first social badge.</p>
              <div className="flex items-center gap-1.5">
                {[0,1,2,3,4].map(i => (
                  <div key={i} className="h-2 flex-1 rounded-full transition-all"
                    style={{ backgroundColor: i < connections.length ? BRAND.accent : '#e5e7eb' }} />
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5">{Math.max(0, 5 - connections.length)} more to go</p>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════ GROUPS TAB ════════════════════ */}
      {activeTab === 'groups' && (
        <div className="flex gap-5">
          {!selectedGroup && (
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
                  {(['mine', 'discover'] as const).map(t => (
                    <button key={t} onClick={() => setGroupTab(t)}
                      className="px-4 py-2 rounded-lg text-xs font-bold transition-all"
                      style={groupTab === t ? { backgroundColor: BRAND.primary, color: 'white' } : { color: '#6b7280' }}>
                      {t === 'mine' ? `My Groups (${myGroups.length})` : `Discover (${discoverGroups.length})`}
                    </button>
                  ))}
                </div>
                <div className="relative flex-1 min-w-40 max-w-xs">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={groupSearch} onChange={e => setGroupSearch(e.target.value)}
                    placeholder="Search groups..." className="w-full pl-9 pr-3 py-2 text-sm border rounded-xl focus:outline-none bg-white" />
                </div>
                <button onClick={() => setIsCreateGroupOpen(true)}
                  className="flex items-center gap-1.5 ml-auto px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90"
                  style={{ backgroundColor: BRAND.primary }}>
                  <Plus size={13} />New Group
                </button>
              </div>

              {loadingGroups ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="rounded-2xl border bg-white p-4 space-y-3 animate-pulse">
                      <div className="flex gap-3"><div className="h-12 w-12 rounded-xl bg-gray-200" /><div className="flex-1 space-y-2"><div className="h-3 bg-gray-200 rounded w-1/2" /><div className="h-2.5 bg-gray-100 rounded w-1/3" /></div></div>
                      <div className="h-2.5 bg-gray-100 rounded" /><div className="h-2.5 bg-gray-100 rounded w-2/3" />
                    </div>
                  ))}
                </div>
              ) : filteredGroups.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-gray-200 py-20 text-center">
                  <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                    <BookOpen size={28} className="text-gray-300" />
                  </div>
                  <p className="text-sm font-bold text-gray-500 mb-1">
                    {groupTab === 'mine' ? "No groups yet" : "No public groups yet"}
                  </p>
                  <p className="text-xs text-gray-400 mb-5">Create one and start studying together!</p>
                  <button onClick={() => setIsCreateGroupOpen(true)}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                    style={{ backgroundColor: BRAND.primary }}>
                    <span className="flex items-center gap-2"><Plus size={14} />Create Study Group</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredGroups.map(g => {
                    const sub = SUBJECTS.find(s => s.key === g.subject) || SUBJECTS[0];
                    const SubIcon = sub.icon;
                    const subColor = SUBJECT_COLORS[g.subject || 'general'];
                    const memberNames = Array.from({ length: Math.min(4, g.member_count) }, (_, i) => `M${i}`);
                    return (
                      <div key={g.id} onClick={() => openGroupChat(g)}
                        className="rounded-2xl border bg-white hover:shadow-lg hover:border-blue-200/60 cursor-pointer transition-all duration-200 group overflow-hidden">
                        <div className="h-1.5" style={{ background: `${g.avatar_color || BRAND.primary}` }} />
                        <div className="p-4">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="h-12 w-12 rounded-xl flex items-center justify-center text-xl font-extrabold text-white shrink-0 shadow-sm"
                              style={{ backgroundColor: g.avatar_color || BRAND.primary }}>
                              {g.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <h3 className="font-bold text-sm text-gray-900 truncate group-hover:text-blue-600 transition-colors">{g.name}</h3>
                                {g.visibility === 'private' ? <Lock size={10} className="text-gray-400 shrink-0" /> : <Globe size={10} className="text-gray-400 shrink-0" />}
                              </div>
                              <p className="text-xs text-gray-500 line-clamp-1">{g.description || 'A collaborative study group'}</p>
                            </div>
                            {g.is_member && g.my_role === 'owner' && (
                              <Star size={14} className="text-amber-400 shrink-0 fill-amber-400" />
                            )}
                          </div>
                          <div className="flex items-center justify-between mb-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                              style={{ backgroundColor: `${subColor}15`, color: subColor }}>
                              <SubIcon size={9} />{sub.label}
                            </span>
                            <div className="flex items-center gap-2">
                              <AvatarStack names={memberNames} size={22} max={3} />
                              <span className="text-[11px] text-gray-400 font-medium">{g.member_count} members</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-3 border-t">
                            <span className="text-[10px] text-gray-400">Active {timeAgo(g.updated_at)} ago</span>
                            {g.is_member ? (
                              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full text-white flex items-center gap-1"
                                style={{ backgroundColor: BRAND.primary }}>
                                {g.my_role === 'owner' ? '⭐ Owner' : g.my_role === 'moderator' ? '🛡 Mod' : 'Open Chat →'}
                              </span>
                            ) : (
                              <button className="h-7 px-3 rounded-lg text-xs font-bold text-white flex items-center gap-1"
                                style={{ backgroundColor: BRAND.primary }}
                                onClick={e => { e.stopPropagation(); joinGroup(g.id); }}>
                                <UserPlus size={11} />Join
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Group Chat Pane */}
          {selectedGroup && (
            <div className="flex-1 flex gap-4">
              <div className="flex-1 flex flex-col rounded-2xl border bg-white overflow-hidden shadow-sm" style={{ height: '74vh' }}>
                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0" style={{ background: '#f8faff' }}>
                  <button className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-colors"
                    onClick={() => setSelectedGroup(null)}>
                    <ArrowLeft size={16} className="text-gray-600" />
                  </button>
                  <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white font-bold shrink-0"
                    style={{ backgroundColor: selectedGroup.avatar_color || BRAND.primary }}>
                    {selectedGroup.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">{selectedGroup.name}</p>
                    <p className="text-[11px] text-gray-400">{selectedGroup.member_count} members · {selectedGroup.subject || 'General'}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {['owner','moderator'].includes(groupMyRole) && (
                      <span className="text-[10px] font-bold px-2 py-1 rounded-lg border border-[rgba(11,60,93,0.20)] text-[#0B3C5D] bg-[rgba(11,60,93,0.08)] flex items-center gap-1 mr-1">
                        <Shield size={9} />{groupMyRole === 'owner' ? 'Owner' : 'Mod'}
                      </span>
                    )}
                    <button className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-colors text-gray-500"
                      onClick={() => { setShowGroupMembers(!showGroupMembers); fetchGroupMembers(selectedGroup.id); }}>
                      <Users size={15} />
                    </button>
                    {selectedGroup.is_member && groupMyRole !== 'owner' && (
                      <button className="h-8 px-3 rounded-lg text-xs text-red-400 hover:bg-red-50 flex items-center gap-1 font-medium transition-colors"
                        onClick={() => leaveGroup(selectedGroup.id)}>
                        <LogOut size={12} />Leave
                      </button>
                    )}
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-1" style={{ background: '#f8faff' }}>
                  {groupMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <div className="h-16 w-16 rounded-2xl bg-white border flex items-center justify-center mx-auto mb-3 shadow-sm">
                        <MessageSquare size={28} className="text-gray-300" />
                      </div>
                      <p className="text-sm font-bold text-gray-500">No messages yet</p>
                      <p className="text-xs text-gray-400 mt-1">Be the first to start the conversation!</p>
                    </div>
                  ) : (
                    groupMessages.map((msg, idx) => {
                      const isMe = msg.sender_id === currentUserId;
                      const canDelete = isMe || ['owner', 'moderator'].includes(groupMyRole);
                      const showHeader = !isMe && (idx === 0 || groupMessages[idx - 1].sender_id !== msg.sender_id);
                      const reactions = msgReactions[msg.id] || [];
                      const isHovered = hoveredMsg === msg.id;
                      return (
                        <div key={msg.id} className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : ''} ${showHeader ? 'mt-3' : 'mt-0.5'}`}
                          onMouseEnter={() => setHoveredMsg(msg.id)} onMouseLeave={() => { setHoveredMsg(null); setShowEmojiBar(null); }}>
                          <div className="shrink-0 self-end" style={{ width: 30 }}>
                            {showHeader && !isMe && <Avatar name={msg.sender_name} avatar={msg.sender_avatar} size={30} />}
                          </div>
                          <div className={`max-w-[72%] flex flex-col ${isMe ? 'items-end' : 'items-start'} relative`}>
                            {showHeader && !isMe && (
                              <p className="text-[10px] font-bold mb-1 px-1" style={{ color: BRAND.primary }}>{msg.sender_name}</p>
                            )}
                            {msg.reply_to_content && (
                              <div className="text-[10px] px-2.5 py-1.5 rounded-xl mb-1 border-l-2 line-clamp-1 max-w-full"
                                style={{ borderLeftColor: BRAND.accent, backgroundColor: `${BRAND.accent}10`, color: '#6b7280' }}>
                                <Reply size={8} className="inline mr-1" />{msg.reply_to_content}
                              </div>
                            )}
                            <div
                              className={`relative px-3.5 py-2.5 text-sm leading-relaxed ${
                                isMe ? `text-white ${msg.is_deleted ? 'opacity-40 italic' : ''}` : `bg-white border text-gray-800 shadow-sm ${msg.is_deleted ? 'opacity-40 italic' : ''}`
                              }`}
                              style={{
                                ...isMe ? { backgroundColor: BRAND.primary } : {},
                                borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                              }}>
                              {msg.is_deleted ? 'This message was deleted' : msg.content}
                            </div>
                            {/* Reactions */}
                            {reactions.length > 0 && (
                              <div className={`flex gap-1 mt-1 flex-wrap ${isMe ? 'justify-end' : ''}`}>
                                {reactions.map(r => (
                                  <button key={r.emoji} onClick={() => toggleReaction(msg.id, r.emoji)}
                                    className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-all shadow-sm ${r.mine ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                                    {r.emoji} <span className="text-[10px] font-bold text-gray-600">{r.count}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                            {/* Hover action bar */}
                            {isHovered && !msg.is_deleted && (
                              <div className={`absolute ${isMe ? 'right-full mr-2' : 'left-full ml-2'} top-1/2 -translate-y-1/2 flex items-center gap-1 bg-white border rounded-xl shadow-lg px-1.5 py-1 z-10`}>
                                {showEmojiBar === msg.id ? (
                                  <>
                                    {QUICK_EMOJIS.map(e => (
                                      <button key={e} onClick={() => toggleReaction(msg.id, e)}
                                        className="text-base hover:scale-125 transition-transform p-0.5 leading-none">{e}</button>
                                    ))}
                                    <button onClick={() => setShowEmojiBar(null)} className="ml-1 text-gray-300 hover:text-gray-500"><X size={12} /></button>
                                  </>
                                ) : (
                                  <>
                                    <button className="p-1 text-gray-400 hover:text-yellow-500 transition-colors" title="React"
                                      onClick={() => setShowEmojiBar(msg.id)}><Smile size={13} /></button>
                                    <button className="p-1 text-gray-400 hover:text-blue-500 transition-colors" title="Reply"
                                      onClick={() => { setGroupReplyTo(msg); groupInputRef.current?.focus(); }}><Reply size={13} /></button>
                                    {canDelete && (
                                      <button className="p-1 text-gray-400 hover:text-red-500 transition-colors" title="Delete"
                                        onClick={() => deleteGroupMessage(msg.id)}><Trash2 size={13} /></button>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                            <span className="text-[9px] text-gray-400 mt-0.5 px-1">{msgTime(msg.created_at)}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={groupChatEndRef} />
                </div>

                {/* Input */}
                {selectedGroup.is_member ? (
                  <div className="border-t shrink-0 bg-white">
                    {groupReplyTo && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-b">
                        <div className="w-0.5 h-6 rounded-full" style={{ backgroundColor: BRAND.accent }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold" style={{ color: BRAND.primary }}>{groupReplyTo.sender_name}</p>
                          <p className="text-[11px] text-gray-500 truncate">{groupReplyTo.content}</p>
                        </div>
                        <button onClick={() => setGroupReplyTo(null)} className="text-gray-400 hover:text-gray-600"><X size={13} /></button>
                      </div>
                    )}
                    <div className="p-3 flex gap-2 items-center">
                      <div className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gray-100 focus-within:bg-white focus-within:border focus-within:shadow-sm transition-all">
                        <input ref={groupInputRef} value={groupInput} onChange={e => setGroupInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendGroupMessage())}
                          placeholder="Message the group..." className="flex-1 text-sm bg-transparent focus:outline-none" />
                        <div className="flex items-center gap-1.5">
                          <button className="text-gray-400 hover:text-gray-600 transition-colors"><Smile size={16} /></button>
                          <button className="text-gray-400 hover:text-gray-600 transition-colors"><PaperclipIcon size={16} /></button>
                        </div>
                      </div>
                      <button onClick={sendGroupMessage} disabled={!groupInput.trim()}
                        className="h-10 w-10 rounded-2xl flex items-center justify-center text-white transition-all hover:opacity-90 disabled:opacity-40 shrink-0"
                        style={{ backgroundColor: BRAND.primary }}>
                        <Send size={15} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 border-t text-center bg-gray-50">
                    <button onClick={() => joinGroup(selectedGroup.id)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white mx-auto transition-all hover:opacity-90"
                      style={{ backgroundColor: BRAND.primary }}>
                      <UserPlus size={14} />Join Group to Participate
                    </button>
                  </div>
                )}
              </div>

              {/* Members Panel */}
              {showGroupMembers && (
                <div className="w-56 shrink-0 space-y-3">
                  <div className="rounded-2xl border bg-white overflow-hidden shadow-sm">
                    <div className="px-3 py-2.5 border-b bg-gray-50 flex items-center justify-between">
                      <p className="text-xs font-bold text-gray-700">Members ({groupMembers.length})</p>
                      <button onClick={() => setShowGroupMembers(false)} className="text-gray-400 hover:text-gray-600"><X size={13} /></button>
                    </div>
                    <div className="overflow-y-auto" style={{ maxHeight: '50vh' }}>
                      {groupMembers.length === 0 ? (
                        <div className="p-4 text-center text-xs text-gray-400">Loading...</div>
                      ) : groupMembers.map(m => (
                        <div key={m.user_id} className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 border-b last:border-0 transition-colors">
                          <Avatar name={m.name} avatar={m.avatar} size={32} online={isOnline(m.user_id)} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-gray-800 truncate">{m.name}</p>
                            <p className="text-[10px] text-gray-400 capitalize">{m.role}</p>
                          </div>
                          {m.role === 'owner' && <Star size={11} className="text-amber-400 fill-amber-400 shrink-0" />}
                          {m.role === 'moderator' && <Shield size={11} className="text-[#0B3C5D] shrink-0" />}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border bg-white p-3 shadow-sm text-xs text-gray-500 space-y-2">
                    <p className="font-bold text-gray-700 text-[11px]">Group Info</p>
                    {selectedGroup.description && <p className="text-[11px] leading-relaxed text-gray-600">{selectedGroup.description}</p>}
                    <div className="flex items-center gap-1.5 text-[11px]"><Users size={10} />{selectedGroup.member_count}/{selectedGroup.max_members || 30} members</div>
                    <div className="flex items-center gap-1.5 text-[11px]">
                      {selectedGroup.visibility === 'private' ? <Lock size={10} /> : <Globe size={10} />}
                      {selectedGroup.visibility === 'private' ? 'Private group' : 'Public group'}
                    </div>
                    {selectedGroup.tags && selectedGroup.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {selectedGroup.tags.map(t => (
                          <span key={t} className="px-1.5 py-0.5 rounded-md bg-gray-100 text-[10px] font-medium">#{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════ MESSAGES TAB ════════════════════ */}
      {activeTab === 'messages' && (
        <div className="flex gap-0 rounded-2xl border bg-white overflow-hidden shadow-sm" style={{ height: '74vh' }}>

          {/* ── Inbox Sidebar ── */}
          <div className={`w-72 shrink-0 border-r flex flex-col ${selectedPeer ? 'hidden md:flex' : 'flex'}`}>
            <div className="px-4 py-3.5 border-b" style={{ background: '#f8faff' }}>
              <div className="flex items-center justify-between mb-2.5">
                <p className="font-bold text-sm text-gray-800">Messages</p>
                {totalUnread > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500 text-white">{totalUnread}</span>
                )}
              </div>
              <div className="relative">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={dmSearch} onChange={e => setDmSearch(e.target.value)}
                  placeholder="Search conversations..."
                  className="w-full pl-8 pr-3 py-2 text-xs border rounded-xl focus:outline-none bg-white shadow-sm" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingDm ? (
                <div className="divide-y">{[1,2,3].map(i => <SkeletonCard key={i} />)}</div>
              ) : (
                <>
                  {filteredDmThreads.length > 0 && (
                    <div>
                      {filteredDmThreads.map(t => {
                        const online = isOnline(t.peer_id);
                        const isActive = selectedPeer?.id === t.peer_id;
                        return (
                          <div key={t.id}
                            className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all ${isActive ? 'bg-blue-50 border-r-2' : 'hover:bg-gray-50'}`}
                            style={isActive ? { borderRightColor: BRAND.primary } : {}}
                            onClick={() => { setSelectedPeer({ id: t.peer_id, name: t.peer_name, avatar: t.peer_avatar }); fetchDmThread(t.peer_id); }}>
                            <Avatar name={t.peer_name} avatar={t.peer_avatar} size={42} online={online} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-0.5">
                                <p className={`text-sm truncate ${Number(t.unread_count) > 0 ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>{t.peer_name}</p>
                                <span className="text-[10px] text-gray-400 shrink-0 ml-1">{timeAgo(t.created_at)}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <p className="text-[11px] text-gray-400 truncate flex-1">
                                  {t.sender_id === currentUserId ? <><CheckCheck size={10} className="inline mr-0.5 text-blue-500" />You: </> : ''}{t.content}
                                </p>
                                {Number(t.unread_count) > 0 && (
                                  <span className="h-4.5 w-4.5 min-w-[18px] h-[18px] rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center shrink-0 ml-1">
                                    {t.unread_count}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {connections.length > 0 && (
                    <>
                      <div className="px-4 py-2 border-y bg-gray-50/80">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Start a new chat</p>
                      </div>
                      <div>
                        {connections.filter(c => !dmThreads.find(t => t.peer_id === c.peer_id)).map(c => (
                          <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => { setSelectedPeer({ id: c.peer_id, name: c.peer_name, avatar: c.peer_avatar }); fetchDmThread(c.peer_id); }}>
                            <Avatar name={c.peer_name} avatar={c.peer_avatar} size={36} online={isOnline(c.peer_id)} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-700 font-semibold truncate">{c.peer_name}</p>
                              <p className="text-[10px] text-gray-400">{isOnline(c.peer_id) ? '● Active now' : 'Offline'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {connections.length === 0 && dmThreads.length === 0 && (
                    <div className="p-8 text-center text-gray-400">
                      <MessageCircle size={36} className="mx-auto mb-3 opacity-20" />
                      <p className="text-sm font-bold">No conversations yet</p>
                      <p className="text-xs mt-1 mb-4">Connect with students to start messaging</p>
                      <button className="px-4 py-2 rounded-xl border text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                        onClick={() => setActiveTab('network')}>Go to My Network</button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── Chat Pane ── */}
          {selectedPeer ? (
            <div className="flex-1 flex flex-col min-w-0">
              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0" style={{ background: '#f8faff' }}>
                <button className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-gray-200 transition-colors md:hidden"
                  onClick={() => setSelectedPeer(null)}>
                  <ArrowLeft size={16} className="text-gray-600" />
                </button>
                <Avatar name={selectedPeer.name} avatar={selectedPeer.avatar} size={40} online={isOnline(selectedPeer.id)} ring />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-gray-900">{selectedPeer.name}</p>
                  <p className="text-[11px] font-medium" style={{ color: isOnline(selectedPeer.id) ? '#4ECDC4' : '#94a3b8' }}>
                    {isOnline(selectedPeer.id) ? '● Active now' : 'Last seen recently'}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button className="h-9 w-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors" title="Voice call">
                    <Phone size={15} />
                  </button>
                  <button className="h-9 w-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors" title="Video call">
                    <Video size={15} />
                  </button>
                  <button className="h-9 w-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors" title="Info">
                    <Info size={15} />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-1" style={{ background: '#f8faff' }}>
                {dmMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="h-20 w-20 rounded-2xl bg-white border shadow-sm flex items-center justify-center mx-auto mb-4">
                      <Avatar name={selectedPeer.name} avatar={selectedPeer.avatar} size={52} online={isOnline(selectedPeer.id)} ring />
                    </div>
                    <p className="text-sm font-bold text-gray-600">{selectedPeer.name}</p>
                    <p className="text-xs text-gray-400 mt-1">Say hello!</p>
                  </div>
                ) : (
                  dmMessages.map((msg, idx) => {
                    const isMe = msg.sender_id === currentUserId;
                    const showDate = idx === 0 || new Date(msg.created_at).toDateString() !== new Date(dmMessages[idx - 1].created_at).toDateString();
                    const isLast = idx === dmMessages.length - 1;
                    const reactions = msgReactions[msg.id] || [];
                    const isHov = hoveredMsg === msg.id;
                    const prevSameSender = idx > 0 && dmMessages[idx - 1].sender_id === msg.sender_id;
                    return (
                      <div key={msg.id}>
                        {showDate && (
                          <div className="text-center my-4">
                            <span className="text-[10px] text-gray-400 bg-white border px-3 py-1.5 rounded-full shadow-sm font-medium">
                              {new Date(msg.created_at).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </span>
                          </div>
                        )}
                        <div className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''} ${prevSameSender ? 'mt-0.5' : 'mt-2'}`}
                          onMouseEnter={() => setHoveredMsg(msg.id)}
                          onMouseLeave={() => { setHoveredMsg(null); setShowEmojiBar(null); }}>
                          {!isMe && (
                            <div className="shrink-0 self-end" style={{ width: 30 }}>
                              {(!prevSameSender || showDate) && <Avatar name={msg.sender_name} avatar={msg.sender_avatar} size={28} />}
                            </div>
                          )}
                          <div className={`max-w-[68%] flex flex-col ${isMe ? 'items-end' : 'items-start'} relative`}>
                            <div
                              className="px-4 py-2.5 text-sm leading-relaxed"
                              style={{
                                ...(isMe ? { backgroundColor: BRAND.primary, color: 'white' } : { backgroundColor: 'white', color: '#1f2937', boxShadow: '0 1px 2px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb' }),
                                borderRadius: isMe
                                  ? prevSameSender ? '18px 4px 4px 18px' : '18px 18px 4px 18px'
                                  : prevSameSender ? '4px 18px 18px 4px' : '4px 18px 18px 18px',
                              }}
                            >
                              {msg.content}
                            </div>

                            {/* Reactions */}
                            {reactions.length > 0 && (
                              <div className={`flex gap-1 mt-1 flex-wrap ${isMe ? 'justify-end' : ''}`}>
                                {reactions.map(r => (
                                  <button key={r.emoji} onClick={() => toggleReaction(msg.id, r.emoji)}
                                    className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border shadow-sm transition-all ${r.mine ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                                    {r.emoji} <span className="text-[10px] font-bold">{r.count}</span>
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Hover action bar */}
                            {isHov && (
                              <div className={`absolute ${isMe ? 'right-full mr-2' : 'left-full ml-2'} top-1/2 -translate-y-1/2 flex items-center gap-1 bg-white border rounded-xl shadow-lg px-1.5 py-1 z-10`}>
                                {showEmojiBar === msg.id ? (
                                  <>
                                    {QUICK_EMOJIS.map(e => (
                                      <button key={e} onClick={() => toggleReaction(msg.id, e)}
                                        className="text-base hover:scale-125 transition-transform p-0.5 leading-none">{e}</button>
                                    ))}
                                    <button onClick={() => setShowEmojiBar(null)} className="ml-1 text-gray-300 hover:text-gray-500"><X size={12} /></button>
                                  </>
                                ) : (
                                  <>
                                    <button className="p-1 text-gray-400 hover:text-yellow-500 transition-colors"
                                      onClick={() => setShowEmojiBar(msg.id)} title="React"><Smile size={13} /></button>
                                    <button className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                                      onClick={() => { setDmReplyTo(msg); dmInputRef.current?.focus(); }} title="Reply"><Reply size={13} /></button>
                                    <button className="p-1 text-gray-400 hover:text-gray-600 transition-colors" title="More"><MoreHorizontal size={13} /></button>
                                  </>
                                )}
                              </div>
                            )}

                            {/* Timestamp + read receipt */}
                            {(isHov || isLast) && (
                              <div className={`flex items-center gap-1 mt-0.5 px-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                                <span className="text-[9px] text-gray-400">{msgTime(msg.created_at)}</span>
                                {isMe && isLast && (
                                  <CheckCheck size={11} className={msg.is_read ? 'text-blue-500' : 'text-gray-400'} />
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Typing indicator */}
                {isTyping && (
                  <div className="flex items-end gap-2">
                    <Avatar name={selectedPeer?.name} size={28} />
                    <div className="bg-white border rounded-2xl rounded-bl-sm shadow-sm">
                      <TypingDots />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="border-t shrink-0 bg-white">
                {dmReplyTo && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-b">
                    <div className="w-0.5 h-6 rounded-full" style={{ backgroundColor: BRAND.accent }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold" style={{ color: BRAND.primary }}>{dmReplyTo.sender_name}</p>
                      <p className="text-[11px] text-gray-500 truncate">{dmReplyTo.content}</p>
                    </div>
                    <button onClick={() => setDmReplyTo(null)} className="text-gray-400 hover:text-gray-600"><X size={13} /></button>
                  </div>
                )}
                <div className="p-3 flex gap-2 items-center">
                  <button className="h-9 w-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors shrink-0">
                    <PaperclipIcon size={17} />
                  </button>
                  <button className="h-9 w-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors shrink-0">
                    <ImageIcon size={17} />
                  </button>
                  <div className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gray-100 focus-within:bg-white focus-within:border focus-within:shadow-sm transition-all">
                    <input
                      ref={dmInputRef}
                      value={dmInput}
                      onChange={e => setDmInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendDm())}
                      placeholder={`Message ${selectedPeer.name}...`}
                      className="flex-1 text-sm bg-transparent focus:outline-none"
                    />
                    <button className="text-gray-400 hover:text-gray-600 transition-colors"><Smile size={16} /></button>
                  </div>
                  {dmInput.trim() ? (
                    <button onClick={sendDm}
                      className="h-10 w-10 rounded-2xl flex items-center justify-center text-white transition-all hover:opacity-90 shrink-0"
                      style={{ backgroundColor: BRAND.primary }}>
                      <Send size={15} />
                    </button>
                  ) : (
                    <button className="h-10 w-10 rounded-2xl flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors shrink-0">
                      <Mic size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8" style={{ background: '#f8faff' }}>
              <div className="h-20 w-20 rounded-2xl flex items-center justify-center mb-4 shadow-sm"
                style={{ background: `${BRAND.primary}`, border: `1px solid ${BRAND.primary}20` }}>
                <MessageCircle size={36} style={{ color: BRAND.primary, opacity: 0.5 }} />
              </div>
              <p className="text-sm font-bold text-gray-500 mb-1">Your messages</p>
              <p className="text-xs text-gray-400">Select a conversation to start chatting</p>
            </div>
          )}
        </div>
      )}

      {/* ════ Create Group Dialog ════ */}
      <Dialog open={isCreateGroupOpen} onOpenChange={setIsCreateGroupOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${BRAND.primary}15` }}>
                <BookOpen size={16} style={{ color: BRAND.primary }} />
              </div>
              Create Study Group
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5 block">Group Name *</Label>
              <input value={newGroup.name} onChange={e => setNewGroup(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Physics Wizards, Code Crew..."
                className="w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 bg-white"
                style={{ '--tw-ring-color': BRAND.primary } as any} />
            </div>

            <div>
              <Label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5 block">Description</Label>
              <textarea value={newGroup.description} onChange={e => setNewGroup(p => ({ ...p, description: e.target.value }))}
                placeholder="What will your group study?"
                rows={2} className="w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none resize-none bg-white" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5 block">Subject</Label>
                <Select value={newGroup.subject} onValueChange={v => setNewGroup(p => ({ ...p, subject: v }))}>
                  <SelectTrigger className="rounded-xl text-sm h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>{SUBJECTS.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5 block">Visibility</Label>
                <Select value={newGroup.visibility} onValueChange={v => setNewGroup(p => ({ ...p, visibility: v }))}>
                  <SelectTrigger className="rounded-xl text-sm h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public"><span className="flex items-center gap-2"><Globe size={12} />Public</span></SelectItem>
                    <SelectItem value="private"><span className="flex items-center gap-2"><Lock size={12} />Private</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2 block">Group Color</Label>
              <div className="flex gap-2">
                {GROUP_COLORS.map(c => (
                  <button key={c} onClick={() => setNewGroup(p => ({ ...p, avatarColor: c }))}
                    className="h-8 w-8 rounded-xl transition-all hover:scale-110"
                    style={{ backgroundColor: c, outline: newGroup.avatarColor === c ? `3px solid ${c}` : 'none', outlineOffset: 2 }} />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <button onClick={() => setIsCreateGroupOpen(false)}
              className="px-4 py-2 rounded-xl text-sm font-semibold border text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
            <button onClick={createGroup}
              className="px-5 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
              style={{ backgroundColor: BRAND.primary }}>Create Group</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
