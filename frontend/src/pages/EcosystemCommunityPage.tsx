// ═══════════════════════════════════════════════════════════════════════════
// MX-302I — Employer, Community & Ecosystem (flag-gated: ecosystemCommunity)
// One surface connecting students to the wider career ecosystem:
//   Alumni · Career Stories · Forums · Study Groups · Hackathons · Referrals
// All data is REAL (persisted via /api/ecosystem/*). Honest empty states (null ≠ 0);
// consent is required to publish user-authored content. Nothing mock is shown as live.
// When the flag is OFF the /enabled probe 503s → this page renders a graceful
// "not available" notice (the SPA hides the entry point too).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { BRAND } from '@/design-system/tokens';
import {
  ArrowLeft, Search, Users, MessageSquare, BookOpen, Trophy, Gift, Sparkles,
  Plus, CheckCircle, Star, Send, X, Briefcase,
} from 'lucide-react';

type NavFn = (screen: string) => void;

function authHeader(): Record<string, string> {
  const token = localStorage.getItem('metryx_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}
const jsonHeaders = (): Record<string, string> => ({ ...authHeader(), 'Content-Type': 'application/json' });

async function getJSON(url: string): Promise<any> {
  const r = await fetch(url, { headers: authHeader() as HeadersInit, credentials: 'include' });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}
async function postJSON(url: string, body: any): Promise<any> {
  const r = await fetch(url, { method: 'POST', headers: jsonHeaders(), credentials: 'include', body: JSON.stringify(body) });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

type TabKey = 'employer' | 'alumni' | 'stories' | 'forums' | 'groups' | 'hackathons' | 'referrals';
const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'employer', label: 'Employer', icon: Briefcase },
  { key: 'alumni', label: 'Alumni', icon: Users },
  { key: 'stories', label: 'Career Stories', icon: Sparkles },
  { key: 'forums', label: 'Forums', icon: MessageSquare },
  { key: 'groups', label: 'Study Groups', icon: BookOpen },
  { key: 'hackathons', label: 'Hackathons', icon: Trophy },
  { key: 'referrals', label: 'Referrals', icon: Gift },
];

// ── Shared little UI atoms ────────────────────────────────────────────────────
function Empty({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl bg-white">
      <p className="text-sm font-medium text-gray-700">{title}</p>
      <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">{sub}</p>
    </div>
  );
}
function Loading() {
  return <div className="text-center py-16 text-xs text-gray-400">Loading&hellip;</div>;
}
function PrimaryBtn({ children, onClick, disabled }: any) {
  return (
    <button disabled={disabled} onClick={onClick}
      className="text-xs font-medium px-3.5 py-2 rounded-xl text-white transition-opacity hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5"
      style={{ backgroundColor: BRAND.primary }}>{children}</button>
  );
}
function Chip({ label }: { label: string }) {
  return <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND.primary}12`, color: BRAND.primary }}>{label}</span>;
}

// ════════════════════════════════ ALUMNI ════════════════════════════════════
function AlumniTab() {
  const [alumni, setAlumni] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [me, setMe] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({ display_name: '', graduation_year: '', institute: '', headline: '', company: '', industry: '', location: '', skills: '', bio: '', is_published: false, open_to_mentoring: false, open_to_referrals: false });

  const load = () => {
    setLoading(true);
    Promise.all([
      getJSON(`/api/ecosystem/alumni?q=${encodeURIComponent(search)}`).catch(() => ({ alumni: [] })),
      getJSON('/api/ecosystem/alumni/me').catch(() => ({ profile: null })),
    ]).then(([dir, mine]) => {
      setAlumni(dir.alumni || []);
      setMe(mine.profile || null);
      if (mine.profile) setForm({ ...mine.profile, skills: (mine.profile.skills || []).join(', '), graduation_year: mine.profile.graduation_year ?? '' });
    }).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const save = async () => {
    await postJSON('/api/ecosystem/alumni/profile', { ...form, skills: form.skills });
    setEditing(false); load();
  };
  const connect = async (userId: string) => { await postJSON(`/api/ecosystem/alumni/${userId}/connect`, {}); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()}
            placeholder="Search alumni by name, company, skill&hellip;" className="w-full h-10 pl-8 pr-4 text-xs border border-gray-200 rounded-xl focus:outline-none bg-white shadow-sm" />
        </div>
        <PrimaryBtn onClick={() => setEditing(v => !v)}><Plus size={13} />{me ? 'Edit my profile' : 'Join directory'}</PrimaryBtn>
      </div>

      {editing && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-2">
          <p className="text-xs font-semibold text-gray-700">Your alumni profile</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[['display_name', 'Display name'], ['graduation_year', 'Graduation year'], ['institute', 'Institute'], ['headline', 'Headline'], ['company', 'Company'], ['industry', 'Industry'], ['location', 'Location'], ['skills', 'Skills (comma separated)']].map(([k, label]) => (
              <input key={k} value={form[k] ?? ''} onChange={e => setForm((f: any) => ({ ...f, [k]: e.target.value }))} placeholder={label} className="h-9 px-2.5 text-xs border border-gray-200 rounded-lg focus:outline-none" />
            ))}
          </div>
          <textarea value={form.bio ?? ''} onChange={e => setForm((f: any) => ({ ...f, bio: e.target.value }))} placeholder="Short bio" rows={2} className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none resize-none" />
          <div className="flex flex-wrap gap-4 text-xs text-gray-600">
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!form.is_published} onChange={e => setForm((f: any) => ({ ...f, is_published: e.target.checked }))} /> Publish to directory (consent)</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!form.open_to_mentoring} onChange={e => setForm((f: any) => ({ ...f, open_to_mentoring: e.target.checked }))} /> Open to mentoring</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!form.open_to_referrals} onChange={e => setForm((f: any) => ({ ...f, open_to_referrals: e.target.checked }))} /> Open to referrals</label>
          </div>
          <p className="text-[10px] text-gray-400">Your profile is only visible in the directory when &ldquo;Publish&rdquo; is checked.</p>
          <div className="flex gap-2"><PrimaryBtn onClick={save}>Save</PrimaryBtn><button onClick={() => setEditing(false)} className="text-xs text-gray-500 px-3">Cancel</button></div>
        </div>
      )}

      {loading ? <Loading /> : alumni.length === 0 ? (
        <Empty title="No alumni published yet" sub="Be the first to publish your profile to the alumni directory. Published profiles appear here for fellow members to discover and connect." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {alumni.map(a => (
            <div key={a.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{a.display_name}</p>
                  {a.headline && <p className="text-xs text-gray-500">{a.headline}</p>}
                  <p className="text-[11px] text-gray-400">{[a.company, a.location, a.graduation_year && `Class of ${a.graduation_year}`].filter(Boolean).join(' · ')}</p>
                </div>
                <button onClick={() => connect(a.user_id)} className="text-[11px] font-medium px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:border-gray-300 shrink-0">Connect</button>
              </div>
              {(a.skills || []).length > 0 && <div className="flex flex-wrap gap-1 mt-2">{a.skills.slice(0, 6).map((s: string) => <Chip key={s} label={s} />)}</div>}
              <div className="flex gap-2 mt-2">
                {a.open_to_mentoring && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND.green}15`, color: BRAND.green }}>Mentoring</span>}
                {a.open_to_referrals && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND.accent}20`, color: BRAND.primary }}>Referrals</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════ STORIES ═══════════════════════════════════
function StoriesTab() {
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [form, setForm] = useState<any>({ title: '', body: '', role: '', company: '', tags: '', consent_public: false });

  const load = () => { setLoading(true); getJSON('/api/ecosystem/stories').then(j => setStories(j.stories || [])).catch(() => setStories([])).finally(() => setLoading(false)); };
  useEffect(load, []);
  const submit = async () => { await postJSON('/api/ecosystem/stories', form); setComposing(false); setForm({ title: '', body: '', role: '', company: '', tags: '', consent_public: false }); load(); };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><PrimaryBtn onClick={() => setComposing(v => !v)}><Plus size={13} />Share your story</PrimaryBtn></div>
      {composing && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-2">
          <input value={form.title} onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))} placeholder="Title" className="w-full h-9 px-2.5 text-xs border border-gray-200 rounded-lg focus:outline-none" />
          <textarea value={form.body} onChange={e => setForm((f: any) => ({ ...f, body: e.target.value }))} placeholder="Your career journey&hellip;" rows={4} className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none resize-none" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input value={form.role} onChange={e => setForm((f: any) => ({ ...f, role: e.target.value }))} placeholder="Current role" className="h-9 px-2.5 text-xs border border-gray-200 rounded-lg focus:outline-none" />
            <input value={form.company} onChange={e => setForm((f: any) => ({ ...f, company: e.target.value }))} placeholder="Company" className="h-9 px-2.5 text-xs border border-gray-200 rounded-lg focus:outline-none" />
            <input value={form.tags} onChange={e => setForm((f: any) => ({ ...f, tags: e.target.value }))} placeholder="Tags (comma separated)" className="h-9 px-2.5 text-xs border border-gray-200 rounded-lg focus:outline-none" />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-gray-600"><input type="checkbox" checked={form.consent_public} onChange={e => setForm((f: any) => ({ ...f, consent_public: e.target.checked }))} /> Publish publicly (consent). Without this it stays a private draft.</label>
          <div className="flex gap-2"><PrimaryBtn onClick={submit} disabled={!form.title || !form.body}>Submit</PrimaryBtn><button onClick={() => setComposing(false)} className="text-xs text-gray-500 px-3">Cancel</button></div>
        </div>
      )}
      {loading ? <Loading /> : stories.length === 0 ? (
        <Empty title="No career stories shared yet" sub="Real, consented stories from members appear here. Share yours to inspire the next student — you choose whether to publish it publicly." />
      ) : (
        <div className="space-y-3">
          {stories.map(s => (
            <div key={s.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <p className="text-sm font-semibold text-gray-800">{s.title}</p>
              <p className="text-[11px] text-gray-400 mb-1">{[s.author_name, s.role, s.company].filter(Boolean).join(' · ')}</p>
              <p className="text-xs text-gray-600 whitespace-pre-wrap">{s.body}</p>
              {(s.tags || []).length > 0 && <div className="flex flex-wrap gap-1 mt-2">{s.tags.map((t: string) => <Chip key={t} label={t} />)}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════ FORUMS ════════════════════════════════════
function ForumsTab() {
  const [threads, setThreads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [open, setOpen] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [reply, setReply] = useState('');
  const [form, setForm] = useState<any>({ title: '', body: '', category: 'general', is_anonymous: false });

  const load = () => { setLoading(true); getJSON('/api/ecosystem/forum/threads').then(j => setThreads(j.threads || [])).catch(() => setThreads([])).finally(() => setLoading(false)); };
  useEffect(load, []);
  const create = async () => { await postJSON('/api/ecosystem/forum/threads', form); setComposing(false); setForm({ title: '', body: '', category: 'general', is_anonymous: false }); load(); };
  const openThread = async (id: string) => { const j = await getJSON(`/api/ecosystem/forum/threads/${id}`); setOpen(j.thread); setPosts(j.posts || []); };
  const sendReply = async () => { if (!reply.trim()) return; await postJSON(`/api/ecosystem/forum/threads/${open.id}/posts`, { body: reply }); setReply(''); openThread(open.id); load(); };

  if (open) {
    return (
      <div className="space-y-3">
        <button onClick={() => setOpen(null)} className="text-xs text-gray-500 inline-flex items-center gap-1"><ArrowLeft size={13} />Back to threads</button>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <p className="text-sm font-semibold text-gray-800">{open.title}</p>
          <p className="text-[11px] text-gray-400 mb-2">{open.author_name} · {open.category}</p>
          <p className="text-xs text-gray-600 whitespace-pre-wrap">{open.body}</p>
        </div>
        <div className="space-y-2">
          {posts.map(p => (
            <div key={p.id} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm ml-4">
              <p className="text-[11px] text-gray-400">{p.author_name}</p>
              <p className="text-xs text-gray-600 whitespace-pre-wrap">{p.body}</p>
            </div>
          ))}
          {posts.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No replies yet — be the first to respond.</p>}
        </div>
        <div className="flex gap-2">
          <input value={reply} onChange={e => setReply(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendReply()} placeholder="Write a reply&hellip;" className="flex-1 h-10 px-3 text-xs border border-gray-200 rounded-xl focus:outline-none" />
          <PrimaryBtn onClick={sendReply}><Send size={13} /></PrimaryBtn>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><PrimaryBtn onClick={() => setComposing(v => !v)}><Plus size={13} />New thread</PrimaryBtn></div>
      {composing && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-2">
          <input value={form.title} onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))} placeholder="Thread title" className="w-full h-9 px-2.5 text-xs border border-gray-200 rounded-lg focus:outline-none" />
          <textarea value={form.body} onChange={e => setForm((f: any) => ({ ...f, body: e.target.value }))} placeholder="What would you like to discuss?" rows={3} className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none resize-none" />
          <div className="flex items-center gap-3">
            <input value={form.category} onChange={e => setForm((f: any) => ({ ...f, category: e.target.value }))} placeholder="Category" className="h-9 px-2.5 text-xs border border-gray-200 rounded-lg focus:outline-none flex-1" />
            <label className="flex items-center gap-1.5 text-xs text-gray-600"><input type="checkbox" checked={form.is_anonymous} onChange={e => setForm((f: any) => ({ ...f, is_anonymous: e.target.checked }))} /> Post anonymously</label>
          </div>
          <div className="flex gap-2"><PrimaryBtn onClick={create} disabled={!form.title || !form.body}>Post</PrimaryBtn><button onClick={() => setComposing(false)} className="text-xs text-gray-500 px-3">Cancel</button></div>
        </div>
      )}
      {loading ? <Loading /> : threads.length === 0 ? (
        <Empty title="No discussions yet" sub="Start the first conversation. Ask a question, share advice, or discuss careers with the community." />
      ) : (
        <div className="space-y-2">
          {threads.map(t => (
            <button key={t.id} onClick={() => openThread(t.id)} className="w-full text-left bg-white border border-gray-100 rounded-xl p-3.5 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-800 truncate">{t.title}</p>
                <Chip label={t.category} />
              </div>
              <p className="text-xs text-gray-500 line-clamp-1">{t.body}</p>
              <p className="text-[11px] text-gray-400 mt-1">{t.author_name} · {t.reply_count} repl{t.reply_count === 1 ? 'y' : 'ies'}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════ STUDY GROUPS ═════════════════════════════════
function GroupsTab() {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [form, setForm] = useState<any>({ name: '', topic: '', description: '' });

  const load = () => { setLoading(true); getJSON('/api/ecosystem/study-groups').then(j => setGroups(j.groups || [])).catch(() => setGroups([])).finally(() => setLoading(false)); };
  useEffect(load, []);
  const create = async () => { await postJSON('/api/ecosystem/study-groups', form); setComposing(false); setForm({ name: '', topic: '', description: '' }); load(); };
  const toggle = async (g: any) => { await postJSON(`/api/ecosystem/study-groups/${g.id}/${g.is_member ? 'leave' : 'join'}`, {}); load(); };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><PrimaryBtn onClick={() => setComposing(v => !v)}><Plus size={13} />Create group</PrimaryBtn></div>
      {composing && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-2">
          <input value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="Group name" className="w-full h-9 px-2.5 text-xs border border-gray-200 rounded-lg focus:outline-none" />
          <input value={form.topic} onChange={e => setForm((f: any) => ({ ...f, topic: e.target.value }))} placeholder="Topic" className="w-full h-9 px-2.5 text-xs border border-gray-200 rounded-lg focus:outline-none" />
          <textarea value={form.description} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} placeholder="Description" rows={2} className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none resize-none" />
          <div className="flex gap-2"><PrimaryBtn onClick={create} disabled={!form.name}>Create</PrimaryBtn><button onClick={() => setComposing(false)} className="text-xs text-gray-500 px-3">Cancel</button></div>
        </div>
      )}
      {loading ? <Loading /> : groups.length === 0 ? (
        <Empty title="No study groups yet" sub="Create the first study group around a topic you're learning. Members can join and learn together." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {groups.map(g => (
            <div key={g.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{g.name}</p>
                  {g.topic && <p className="text-xs text-gray-500">{g.topic}</p>}
                </div>
                <button onClick={() => toggle(g)} className="text-[11px] font-medium px-2.5 py-1 rounded-lg shrink-0"
                  style={g.is_member ? { border: `1px solid ${BRAND.green}40`, color: BRAND.green } : { backgroundColor: BRAND.primary, color: '#fff' }}>
                  {g.is_member ? 'Joined' : 'Join'}
                </button>
              </div>
              {g.description && <p className="text-xs text-gray-600 mt-1.5">{g.description}</p>}
              <p className="text-[11px] text-gray-400 mt-2">{g.member_count} member{g.member_count !== 1 ? 's' : ''}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════ HACKATHONS ═══════════════════════════════════
function HackathonsTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const load = () => { setLoading(true); getJSON('/api/ecosystem/hackathons').then(j => setItems(j.hackathons || [])).catch(() => setItems([])).finally(() => setLoading(false)); };
  useEffect(load, []);
  const join = async (id: string) => { await postJSON(`/api/ecosystem/hackathons/${id}/join`, {}); load(); };

  return (
    <div className="space-y-4">
      {loading ? <Loading /> : items.length === 0 ? (
        <Empty title="No hackathons listed yet" sub="Upcoming hackathons and challenges will appear here as they're announced. Registered events let you join with one click." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map(h => (
            <div key={h.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{h.title}</p>
                  {h.theme && <p className="text-xs text-gray-500">{h.theme}</p>}
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full capitalize shrink-0" style={{ backgroundColor: `${BRAND.accent}20`, color: BRAND.primary }}>{h.status}</span>
              </div>
              {h.description && <p className="text-xs text-gray-600 mt-1.5 line-clamp-3">{h.description}</p>}
              <p className="text-[11px] text-gray-400 mt-2">{[h.mode, h.start_date, h.prize_pool && `Prize: ${h.prize_pool}`].filter(Boolean).join(' · ')}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[11px] text-gray-400">{h.participant_count} participant{h.participant_count !== 1 ? 's' : ''}</span>
                <button onClick={() => join(h.id)} disabled={h.is_registered} className="text-[11px] font-medium px-2.5 py-1 rounded-lg disabled:opacity-60"
                  style={h.is_registered ? { border: `1px solid ${BRAND.green}40`, color: BRAND.green } : { backgroundColor: BRAND.primary, color: '#fff' }}>
                  {h.is_registered ? 'Registered' : 'Register'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════ REFERRALS ════════════════════════════════════
function ReferralsTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [copied, setCopied] = useState(false);
  const load = () => { setLoading(true); getJSON('/api/ecosystem/referrals/me').then(setData).catch(() => setData(null)).finally(() => setLoading(false)); };
  useEffect(load, []);
  const invite = async () => { await postJSON('/api/ecosystem/referrals', { invitee_email: email }); setEmail(''); load(); };

  if (loading) return <Loading />;
  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
        <p className="text-xs font-semibold text-gray-700 mb-1">Your referral code</p>
        <div className="flex items-center gap-2">
          <code className="text-sm font-bold px-3 py-1.5 rounded-lg" style={{ backgroundColor: `${BRAND.primary}10`, color: BRAND.primary }}>{data?.referral_code}</code>
          <button onClick={() => { navigator.clipboard?.writeText(data?.referral_code || ''); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="text-[11px] text-gray-500 px-2 py-1 border border-gray-200 rounded-lg">{copied ? 'Copied' : 'Copy'}</button>
        </div>
        <p className="text-[11px] text-gray-400 mt-1">{data?.joined ?? 0} of {data?.count ?? 0} invites have joined.</p>
      </div>
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
        <p className="text-xs font-semibold text-gray-700 mb-2">Invite someone</p>
        <div className="flex gap-2">
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="friend@email.com" className="flex-1 h-10 px-3 text-xs border border-gray-200 rounded-xl focus:outline-none" />
          <PrimaryBtn onClick={invite} disabled={!email}><Send size={13} />Invite</PrimaryBtn>
        </div>
      </div>
      {(data?.referrals || []).length === 0 ? (
        <Empty title="No invites sent yet" sub="Share your referral code or invite friends by email. You'll see their status here once they join." />
      ) : (
        <div className="space-y-2">
          {data.referrals.map((r: any) => (
            <div key={r.id} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm flex items-center justify-between">
              <span className="text-xs text-gray-700">{r.invitee_email || 'Shared link'}</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full capitalize" style={r.status === 'joined' ? { backgroundColor: `${BRAND.green}15`, color: BRAND.green } : { backgroundColor: '#f3f4f6', color: '#6b7280' }}>{r.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════ EMPLOYER ══════════════════════════════════
// Read-only composer over the EXISTING hiring substrate (employer_jobs / campus_drives /
// invitations) PLUS candidate matching composed from the canonical talent-matching engine.
// Honest: counts may be null (absent) ≠ 0; a role abstains from matching when its title is
// not crosswalkable or no candidate evidence exists — never a fabricated match.
function EmployerTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    getJSON('/api/ecosystem/employer/overview').then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (!data || data.degraded) {
    return <Empty title="Employer overview unavailable" sub="This surface composes your live hiring data (roles, campus drives, invitations and candidate matches). It will populate once that data is available." />;
  }

  const c = data.counts || {};
  const matches: any[] = Array.isArray(data.candidate_matching?.jobs) ? data.candidate_matching.jobs : [];
  const Stat = ({ label, value }: { label: string; value: number | null | undefined }) => (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
      <p className="text-2xl font-bold" style={{ color: BRAND.primary }}>{value == null ? '—' : value}</p>
      <p className="text-[11px] text-gray-500 mt-0.5">{label}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Graduate roles" value={c.graduate} />
        <Stat label="Internship roles" value={c.internship} />
        <Stat label="Other roles" value={c.other} />
        <Stat label="Campus drives" value={c.drives} />
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
        <p className="text-xs font-semibold text-gray-700 mb-0.5">Invitations</p>
        <p className="text-[11px] text-gray-500">{(data.invitations?.team_members ?? 0)} team member{(data.invitations?.team_members ?? 0) !== 1 ? 's' : ''} · {(data.invitations?.pool_outreach ?? 0)} pool outreach</p>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5"><Users size={13} />Candidate matches by role</p>
        {matches.length === 0 ? (
          <Empty title="No roles to match yet" sub="Once you post graduate or internship roles, matched candidates (composed from the talent-matching engine) will appear here." />
        ) : (
          <div className="space-y-2">
            {matches.map((m, i) => (
              <div key={m.job_id || i} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{m.title || 'Untitled role'}</p>
                    {m.role_title && <p className="text-[10px] text-gray-400">Matched to: {m.role_title}</p>}
                  </div>
                  {m.measurable ? (
                    <span className="text-[11px] font-semibold shrink-0" style={{ color: BRAND.primary }}>{m.matched_count} candidate{m.matched_count !== 1 ? 's' : ''}</span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full shrink-0 bg-gray-100 text-gray-500" title={m.reason || 'not measurable yet'}>Not measurable yet</span>
                  )}
                </div>
                {m.measurable && (m.top_candidates || []).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.top_candidates.map((tc: any, j: number) => (
                      <span key={tc.candidate_id || j} className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: `${BRAND.primary}10`, color: BRAND.primary }}>
                        {tc.fit_label || 'Fit'}{tc.fit_pct != null ? ` · ${tc.fit_pct}%` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {data.candidate_matching?.note && <p className="text-[10px] text-gray-400 mt-2">{data.candidate_matching.note}</p>}
      </div>
    </div>
  );
}

// ════════════════════════════════ PAGE ══════════════════════════════════════
export function EcosystemCommunityPage({ onNavigate }: { onNavigate: NavFn }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [tab, setTab] = useState<TabKey>('alumni');

  useEffect(() => {
    let alive = true;
    fetch('/api/ecosystem/enabled', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (alive) setEnabled(!!j?.enabled); })
      .catch(() => { if (alive) setEnabled(false); });
    return () => { alive = false; };
  }, []);

  if (enabled === false) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <X size={28} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm font-medium text-gray-700">Community is not available</p>
          <p className="text-xs text-gray-400 mt-1">This area isn&rsquo;t enabled for your account yet.</p>
          <button onClick={() => onNavigate('career-builder')} className="mt-3 text-xs font-medium px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor: BRAND.primary }}>Back to Career Builder</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-1">
          <button onClick={() => onNavigate('career-builder')} className="text-gray-400 hover:text-gray-600"><ArrowLeft size={18} /></button>
          <h1 className="text-2xl font-bold text-gray-900">Community &amp; Ecosystem</h1>
        </div>
        <p className="text-xs text-gray-400 ml-9 mb-5">Connect with alumni and mentors, share stories, join discussions, study groups &amp; hackathons.</p>

        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`text-xs font-medium px-3 py-2 rounded-xl border whitespace-nowrap inline-flex items-center gap-1.5 transition-all ${active ? 'text-white shadow-sm' : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'}`}
                style={active ? { backgroundColor: BRAND.primary, borderColor: BRAND.primary } : {}}>
                <Icon size={13} />{t.label}
              </button>
            );
          })}
        </div>

        {enabled === null ? <Loading /> : (
          <>
            {tab === 'employer' && <EmployerTab />}
            {tab === 'alumni' && <AlumniTab />}
            {tab === 'stories' && <StoriesTab />}
            {tab === 'forums' && <ForumsTab />}
            {tab === 'groups' && <GroupsTab />}
            {tab === 'hackathons' && <HackathonsTab />}
            {tab === 'referrals' && <ReferralsTab />}
          </>
        )}
      </div>
    </div>
  );
}
