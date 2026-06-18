/**
 * JoinSessionPage — Student joins a session via invite link.
 * URL: /join-session?room=metryx-session-xxxx&token=yyyy
 */
import { useState, useEffect } from 'react';
import { Screen } from '../App';
import { Video, Calendar, Clock, Users, Shield, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { VideoCallRoom } from '@/components/video/VideoCallRoom';

const BRAND = { primary: '#344E86', accent: '#4ECDC4' };

interface SessionInfo {
  roomId: string;
  title: string;
  mentorName: string;
  studentName: string;
  sessionType: string;
  scheduledDate: string;
  scheduledTime: string;
  mode: string;
  status: string;
  participantCount: number;
}

interface JoinSessionPageProps {
  onNavigate: (screen: Screen | string) => void;
}

export function JoinSessionPage({ onNavigate }: JoinSessionPageProps) {
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get('room') || '';
  const token  = params.get('token') || '';

  const [sessionInfo, setSessionInfo]   = useState<SessionInfo | null>(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [participantName, setName]      = useState('');
  const [joining, setJoining]           = useState(false);
  const [inCall, setInCall]             = useState(false);

  useEffect(() => {
    if (!roomId) { setError('No session ID found in the link. Please check your invite link.'); setLoading(false); return; }

    fetch(`/api/video-sessions/${roomId}${token ? `?token=${token}` : ''}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return; }
        setSessionInfo(data);
        if (data.studentName && data.studentName !== 'Student') setName(data.studentName);
      })
      .catch(() => setError('Failed to load session details. The link may have expired.'))
      .finally(() => setLoading(false));
  }, [roomId, token]);

  const handleJoin = () => {
    if (!participantName.trim()) return;
    setJoining(true);
    setTimeout(() => { setJoining(false); setInCall(true); }, 400);
  };

  if (inCall && sessionInfo) {
    return (
      <VideoCallRoom
        roomId={roomId}
        sessionTitle={sessionInfo.title}
        userName={participantName}
        userRole="student"
        onLeave={() => {
          setInCall(false);
          onNavigate('landing');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4 font-['Inter',sans-serif]">

      {/* Logo */}
      <div className="mb-8 flex items-center gap-2">
        <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: BRAND.primary }}>
          <Video size={18} className="text-white" />
        </div>
        <span className="text-xl font-bold" style={{ color: BRAND.primary }}>MetryxOne</span>
      </div>

      <div className="w-full max-w-md">
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">

          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-100" style={{ backgroundColor: `${BRAND.primary}08` }}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: BRAND.primary }}>
                <Video size={18} className="text-white" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">You've been invited to a session</p>
                <p className="text-base font-bold text-gray-900">{loading ? 'Loading session…' : sessionInfo?.title ?? 'Session Invite'}</p>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 space-y-5">

            {loading && (
              <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
                <Loader2 size={18} className="animate-spin" />
                <span className="text-sm">Loading session details…</span>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 rounded-xl flex items-start gap-3">
                <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-700">Session Not Found</p>
                  <p className="text-xs text-red-600 mt-0.5">{error}</p>
                </div>
              </div>
            )}

            {sessionInfo && !error && (
              <>
                {/* Session details */}
                <div className="space-y-2">
                  {[
                    { icon: Video, label: 'Session', value: sessionInfo.sessionType },
                    { icon: Users, label: 'Mentor', value: sessionInfo.mentorName },
                    { icon: Calendar, label: 'Date', value: sessionInfo.scheduledDate },
                    { icon: Clock, label: 'Time', value: sessionInfo.scheduledTime },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-xl">
                      <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${BRAND.primary}10` }}>
                        <Icon size={13} style={{ color: BRAND.primary }} />
                      </div>
                      <span className="text-[11px] text-gray-500 w-12 shrink-0">{label}</span>
                      <span className="text-xs font-semibold text-gray-800">{value}</span>
                    </div>
                  ))}
                </div>

                {/* Status badge */}
                {sessionInfo.status === 'ended' && (
                  <div className="p-3 bg-amber-50 rounded-xl flex items-center gap-2">
                    <AlertTriangle size={14} className="text-amber-500" />
                    <p className="text-xs text-amber-700 font-medium">This session has already ended.</p>
                  </div>
                )}

                {sessionInfo.status !== 'ended' && (
                  <>
                    {/* Name input */}
                    <div>
                      <Label className="text-xs font-semibold text-gray-700 mb-1.5 block">Your Name *</Label>
                      <Input
                        placeholder="Enter your full name to join"
                        value={participantName}
                        onChange={e => setName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && participantName.trim() && handleJoin()}
                        className="h-10 text-sm rounded-xl border-gray-200"
                      />
                    </div>

                    {/* DPDP notice */}
                    <div className="p-3 bg-blue-50 rounded-xl flex items-start gap-2">
                      <Shield size={13} className="text-blue-500 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-blue-600">
                        You'll be asked to consent to recording and data processing before joining, as required by the DPDP Act 2023.
                      </p>
                    </div>

                    <Button
                      className="w-full text-sm text-white h-11 gap-2"
                      style={{ backgroundColor: BRAND.primary }}
                      disabled={!participantName.trim() || joining}
                      onClick={handleJoin}
                    >
                      {joining ? <Loader2 size={16} className="animate-spin" /> : <Video size={16} />}
                      {joining ? 'Preparing session…' : 'Join Session'}
                    </Button>
                  </>
                )}
              </>
            )}

            {/* Footer */}
            <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
              <p className="text-[10px] text-gray-400">Powered by MetryxOne WebRTC</p>
              <button onClick={() => onNavigate('landing')} className="text-[10px] text-gray-400 hover:text-gray-600">← Back to home</button>
            </div>
          </div>
        </div>

        {/* Room ID display */}
        {roomId && (
          <p className="text-center text-[10px] text-gray-400 mt-3">
            Room: <span className="font-mono">{roomId}</span>
          </p>
        )}
      </div>
    </div>
  );
}
