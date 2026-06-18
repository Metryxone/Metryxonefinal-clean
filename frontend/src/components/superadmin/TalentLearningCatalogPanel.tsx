import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle, BookOpen, Award, Briefcase, Users } from 'lucide-react';

interface Course { id: number; course_name: string; provider: string; course_type: string; difficulty_level: string; duration_hours: number; is_free: boolean; future_relevance: number; is_active: boolean; }
interface Cert { id: number; cert_name: string; issuing_body: string; difficulty_level: string; validity_years: number; future_relevance: number; }
interface Project { id: number; project_name: string; project_type: string; difficulty_level: string; duration_weeks: number; is_active: boolean; }
interface Mentor { id: number; mentor_name: string; expertise_areas: string[]; mentoring_style: string; availability: string; years_experience: number; is_active: boolean; }

export default function TalentLearningCatalogPanel() {
  const [overview, setOverview] = useState<any>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [certs, setCerts] = useState<Cert[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'overview' | 'courses' | 'certs' | 'projects' | 'mentors'>('overview');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [oR, cR, crR, prR, mR] = await Promise.all([
        fetch('/api/admin/lip/catalog/overview', { credentials: 'include' }),
        fetch('/api/admin/lip/catalog/courses', { credentials: 'include' }),
        fetch('/api/admin/lip/catalog/certifications', { credentials: 'include' }),
        fetch('/api/admin/lip/catalog/projects', { credentials: 'include' }),
        fetch('/api/admin/lip/catalog/mentors', { credentials: 'include' }),
      ]);
      if (!oR.ok) throw new Error(await oR.text());
      setOverview(await oR.json());
      if (cR.ok) { const d = await cR.json(); setCourses(d.courses || []); }
      if (crR.ok) { const d = await crR.json(); setCerts(d.certifications || []); }
      if (prR.ok) { const d = await prR.json(); setProjects(d.projects || []); }
      if (mR.ok) { const d = await mR.json(); setMentors(d.mentors || []); }
    } catch (e: any) { setError(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const DIFF_COLORS: Record<string, string> = { beginner: 'bg-green-100 text-green-700', intermediate: 'bg-blue-100 text-blue-700', advanced: 'bg-purple-100 text-purple-700', expert: 'bg-red-100 text-red-700' };
  const AVAIL_COLORS: Record<string, string> = { available: 'bg-green-100 text-green-700', busy: 'bg-yellow-100 text-yellow-700', unavailable: 'bg-gray-100 text-gray-500' };

  const totalCourses = overview?.courses?.total ?? 0;
  const totalCerts = overview?.certifications?.total ?? 0;
  const totalProjects = overview?.projects?.total ?? 0;
  const totalMentors = overview?.mentors?.total ?? 0;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Learning Intelligence Catalog (D12)</h2>
          <p className="text-sm text-gray-500 mt-0.5">Courses · Certifications · Projects · Mentors — competency-mapped</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
      </div>

      {error && <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}

      <div className="flex gap-1 border-b border-gray-200">
        {[['overview', 'Overview'], ['courses', `Courses (${totalCourses})`], ['certs', `Certs (${totalCerts})`], ['projects', `Projects (${totalProjects})`], ['mentors', `Mentors (${totalMentors})`]].map(([k, label]) => <button key={k} onClick={() => setTab(k as any)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === k ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{label}</button>)}
      </div>

      {loading ? <div className="text-center py-12 text-gray-500 text-sm">Loading catalog…</div> : tab === 'overview' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[['Courses', totalCourses, BookOpen, 'bg-blue-50 text-blue-700'], ['Certifications', totalCerts, Award, 'bg-green-50 text-green-700'], ['Projects', totalProjects, Briefcase, 'bg-purple-50 text-purple-700'], ['Mentors', totalMentors, Users, 'bg-orange-50 text-orange-700']].map(([label, val, Icon, cls]: any) => (
              <div key={String(label)} className={`rounded-lg p-4 ${cls} flex items-center gap-3`}>
                <Icon className="w-6 h-6 opacity-60" />
                <div><div className="text-2xl font-bold">{val || 0}</div><div className="text-xs mt-0.5">{label}</div></div>
              </div>
            ))}
          </div>
          {overview?.courses && (
            <div className="grid grid-cols-3 gap-3">
              {[['Free Courses', overview.courses.free_count, 'text-green-700'], ['Available Mentors', overview.mentors?.available ?? 0, 'text-blue-700'], ['Avg Relevance', overview.courses.avg_relevance ?? '—', 'text-purple-700']].map(([k, v, cls]) => (
                <div key={String(k)} className="bg-white border border-gray-200 rounded-lg p-3 text-center">
                  <div className={`text-xl font-bold ${cls}`}>{v}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{k}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : tab === 'courses' ? (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm"><thead className="bg-gray-50 border-b border-gray-200">
            <tr>{['Name', 'Provider', 'Type', 'Level', 'Hours', 'Relevance', 'Status'].map(h => <th key={h} className="text-left px-3 py-2 text-xs font-medium text-gray-500">{h}</th>)}</tr>
          </thead><tbody className="divide-y divide-gray-100">
            {courses.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium text-gray-800 max-w-[200px] truncate">{c.course_name}</td>
                <td className="px-3 py-2 text-gray-600">{c.provider}</td>
                <td className="px-3 py-2 text-gray-500 text-xs">{c.course_type}</td>
                <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-xs ${DIFF_COLORS[c.difficulty_level] || 'bg-gray-100 text-gray-600'}`}>{c.difficulty_level}</span></td>
                <td className="px-3 py-2 text-gray-600">{c.duration_hours}h</td>
                <td className="px-3 py-2 font-bold text-indigo-700">{c.future_relevance}/10</td>
                <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-xs ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{c.is_active ? 'Active' : 'Inactive'}{c.is_free ? ' · Free' : ''}</span></td>
              </tr>
            ))}
            {courses.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">No courses</td></tr>}
          </tbody></table>
        </div>
      ) : tab === 'certs' ? (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm"><thead className="bg-gray-50 border-b border-gray-200">
            <tr>{['Certification', 'Issuing Body', 'Level', 'Validity (yrs)', 'Relevance'].map(h => <th key={h} className="text-left px-3 py-2 text-xs font-medium text-gray-500">{h}</th>)}</tr>
          </thead><tbody className="divide-y divide-gray-100">
            {certs.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium text-gray-800">{c.cert_name}</td>
                <td className="px-3 py-2 text-gray-600">{c.issuing_body}</td>
                <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-xs ${DIFF_COLORS[c.difficulty_level] || 'bg-gray-100 text-gray-600'}`}>{c.difficulty_level}</span></td>
                <td className="px-3 py-2 text-gray-600">{c.validity_years}</td>
                <td className="px-3 py-2 font-bold text-indigo-700">{c.future_relevance}/10</td>
              </tr>
            ))}
            {certs.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">No certifications</td></tr>}
          </tbody></table>
        </div>
      ) : tab === 'projects' ? (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm"><thead className="bg-gray-50 border-b border-gray-200">
            <tr>{['Project', 'Type', 'Level', 'Duration (wk)', 'Status'].map(h => <th key={h} className="text-left px-3 py-2 text-xs font-medium text-gray-500">{h}</th>)}</tr>
          </thead><tbody className="divide-y divide-gray-100">
            {projects.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium text-gray-800">{p.project_name}</td>
                <td className="px-3 py-2 text-gray-600">{p.project_type}</td>
                <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-xs ${DIFF_COLORS[p.difficulty_level] || 'bg-gray-100 text-gray-600'}`}>{p.difficulty_level}</span></td>
                <td className="px-3 py-2 text-gray-600">{p.duration_weeks}</td>
                <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-xs ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{p.is_active ? 'Active' : 'Inactive'}</span></td>
              </tr>
            ))}
            {projects.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">No projects</td></tr>}
          </tbody></table>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm"><thead className="bg-gray-50 border-b border-gray-200">
            <tr>{['Mentor', 'Style', 'Expertise Areas', 'Experience', 'Availability', 'Status'].map(h => <th key={h} className="text-left px-3 py-2 text-xs font-medium text-gray-500">{h}</th>)}</tr>
          </thead><tbody className="divide-y divide-gray-100">
            {mentors.map(m => (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium text-gray-800">{m.mentor_name}</td>
                <td className="px-3 py-2 text-gray-600">{m.mentoring_style}</td>
                <td className="px-3 py-2"><div className="flex flex-wrap gap-1">{(m.expertise_areas || []).slice(0, 3).map(a => <span key={a} className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs">{a}</span>)}</div></td>
                <td className="px-3 py-2 text-gray-600">{m.years_experience}yr</td>
                <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-xs ${AVAIL_COLORS[m.availability] || 'bg-gray-100 text-gray-600'}`}>{m.availability}</span></td>
                <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-xs ${m.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{m.is_active ? 'Active' : 'Inactive'}</span></td>
              </tr>
            ))}
            {mentors.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">No mentors</td></tr>}
          </tbody></table>
        </div>
      )}
    </div>
  );
}
