import { BRAND_NAVY as BRAND } from '@/design-system/tokens';
/**
 * VideoCallRoom — Native WebRTC video calling, fully within MetryxOne.
 * Features: recording, live transcription, session notes, DPDP consent,
 * participant management, in-call chat, screen share, post-session summary.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, MonitorOff,
  Users, Maximize2, Minimize2, MessageSquare, X, Send,
  Circle, Square, FileText, Download, Copy, Check,
  ChevronRight, ChevronLeft, Clock, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DPDPConsentModal } from './DPDPConsentModal';


const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

interface Peer {
  socketId: string;
  name: string;
  role: 'mentor' | 'student';
  stream?: MediaStream;
  audioEnabled: boolean;
  videoEnabled: boolean;
  joinedAt: string;
}

interface ChatMessage {
  id: number;
  sender: string;
  text: string;
  time: string;
  self: boolean;
  system?: boolean;
}

interface TranscriptLine {
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
  isFinal: boolean;
}

interface PostSessionSummary {
  duration: number;
  transcriptLines: TranscriptLine[];
  notes: string;
  recordingBlob: Blob | null;
  participantCount: number;
}

interface VideoCallRoomProps {
  roomId: string;
  sessionTitle: string;
  userName: string;
  userRole: 'mentor' | 'student';
  onLeave: (summary?: PostSessionSummary) => void;
}

type Panel = 'chat' | 'participants' | 'transcript' | 'notes' | null;

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

export function VideoCallRoom({ roomId, sessionTitle, userName, userRole, onLeave }: VideoCallRoomProps) {
  // Consent gate
  const [consentDone, setConsentDone] = useState(false);

  // Media refs
  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const socketRef      = useRef<Socket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConns      = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteVideos   = useRef<Map<string, HTMLVideoElement>>(new Map());
  const mixedStreamRef = useRef<MediaStream | null>(null);

  // Recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunks  = useRef<Blob[]>([]);

  // Transcription
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // State
  const [peers, setPeers]                     = useState<Peer[]>([]);
  const [audioEnabled, setAudioEnabled]       = useState(true);
  const [videoEnabled, setVideoEnabled]       = useState(true);
  const [screenSharing, setScreenSharing]     = useState(false);
  const [recording, setRecording]             = useState(false);
  const [recordingBlob, setRecordingBlob]     = useState<Blob | null>(null);
  const [transcribing, setTranscribing]       = useState(false);
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([]);
  const [interimText, setInterimText]         = useState('');
  const [notes, setNotes]                     = useState('');
  const [duration, setDuration]               = useState(0);
  const [mediaError, setMediaError]           = useState<string | null>(null);
  const [fullscreen, setFullscreen]           = useState(false);
  const [activePanel, setActivePanel]         = useState<Panel>(null);
  const [chatInput, setChatInput]             = useState('');
  const [chatMessages, setChatMessages]       = useState<ChatMessage[]>([]);
  const [linkCopied, setLinkCopied]           = useState(false);
  const [showPostSession, setShowPostSession] = useState(false);
  const [recDuration, setRecDuration]         = useState(0);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!consentDone) return;
    const t = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(t);
  }, [consentDone]);

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  // ── Get local media ────────────────────────────────────────────────────────
  const getLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      return stream;
    } catch (err: any) {
      setMediaError(err.name === 'NotAllowedError'
        ? 'Camera/microphone access denied. Please allow access in your browser settings.'
        : 'Could not access camera or microphone. Check your device and permissions.');
      return null;
    }
  }, []);

  // ── Create RTCPeerConnection ───────────────────────────────────────────────
  const createPeerConnection = useCallback((remoteSocketId: string, remoteName: string, remoteRole: 'mentor' | 'student') => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    localStreamRef.current?.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current!));

    pc.onicecandidate = e => {
      if (e.candidate) socketRef.current?.emit('ice-candidate', { to: remoteSocketId, candidate: e.candidate });
    };

    pc.ontrack = e => {
      const [stream] = e.streams;
      const el = remoteVideos.current.get(remoteSocketId);
      if (el) el.srcObject = stream;
      setPeers(prev => prev.map(p => p.socketId === remoteSocketId ? { ...p, stream } : p));
    };

    peerConns.current.set(remoteSocketId, pc);
    return pc;
  }, []);

  // ── Socket.io + WebRTC ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!consentDone) return;
    let mounted = true;

    const backendUrl = (() => {
      const h = window.location.hostname;
      if (h === 'localhost' || h === '127.0.0.1') return 'http://localhost:8000';
      // Replit dev domain: port 8000
      return window.location.origin.replace(/:\d+/, ':8000').replace(/^https/, 'https');
    })();

    const socket = io(backendUrl, { path: '/signaling', transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', async () => {
      if (!mounted) return;
      const stream = await getLocalStream();
      if (!stream) return;
      socket.emit('join-room', { roomId, userId: socket.id, name: userName, role: userRole });
    });

    socket.on('room-peers', async (existingPeers: { socketId: string; name: string; role: 'mentor' | 'student' }[]) => {
      if (!mounted) return;
      setPeers(existingPeers.map(p => ({ ...p, audioEnabled: true, videoEnabled: true, joinedAt: new Date().toISOString() })));
      for (const peer of existingPeers) {
        const pc = createPeerConnection(peer.socketId, peer.name, peer.role);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('offer', { to: peer.socketId, offer, from: socket.id, fromName: userName });
      }
    });

    socket.on('peer-joined', ({ socketId, name, role }: { socketId: string; name: string; role: 'mentor' | 'student' }) => {
      if (!mounted) return;
      setPeers(prev => [...prev, { socketId, name, role, audioEnabled: true, videoEnabled: true, joinedAt: new Date().toISOString() }]);
      addChat('System', `${name} joined the session`, false, true);
    });

    socket.on('offer', async ({ from, offer, fromName }: { from: string; offer: RTCSessionDescriptionInit; fromName: string }) => {
      if (!mounted) return;
      let pc = peerConns.current.get(from);
      if (!pc) pc = createPeerConnection(from, fromName, 'student');
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('answer', { to: from, answer });
    });

    socket.on('answer', async ({ from, answer }: { from: string; answer: RTCSessionDescriptionInit }) => {
      const pc = peerConns.current.get(from);
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on('ice-candidate', async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
      const pc = peerConns.current.get(from);
      if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on('peer-left', ({ socketId, name }: { socketId: string; name: string }) => {
      peerConns.current.get(socketId)?.close();
      peerConns.current.delete(socketId);
      remoteVideos.current.delete(socketId);
      setPeers(prev => prev.filter(p => p.socketId !== socketId));
      addChat('System', `${name} left the session`, false, true);
    });

    socket.on('peer-media-state', ({ from, audio, video }: { from: string; audio: boolean; video: boolean }) => {
      setPeers(prev => prev.map(p => p.socketId === from ? { ...p, audioEnabled: audio, videoEnabled: video } : p));
    });

    socket.on('chat-message', ({ from, text, time }: { from: string; text: string; time: string }) => {
      setChatMessages(prev => [...prev, { id: Date.now(), sender: from, text, time, self: false }]);
    });

    socket.on('recording-started', ({ by }: { by: string }) => {
      addChat('System', `🔴 Recording started by ${by}. All participants notified.`, false, true);
    });

    socket.on('recording-stopped', ({ by }: { by: string }) => {
      addChat('System', `⏹ Recording stopped by ${by}.`, false, true);
    });

    return () => {
      mounted = false;
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      peerConns.current.forEach(pc => pc.close());
      peerConns.current.clear();
      socket.disconnect();
    };
  }, [consentDone, roomId, userName, userRole, getLocalStream, createPeerConnection]);

  // ── Controls ───────────────────────────────────────────────────────────────

  const addChat = (sender: string, text: string, self: boolean, system = false) => {
    setChatMessages(prev => [...prev, {
      id: Date.now() + Math.random(),
      sender, text,
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      self, system,
    }]);
  };

  const toggleAudio = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setAudioEnabled(track.enabled);
    socketRef.current?.emit('media-state', { roomId, audio: track.enabled, video: videoEnabled });
  };

  const toggleVideo = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setVideoEnabled(track.enabled);
    socketRef.current?.emit('media-state', { roomId, audio: audioEnabled, video: track.enabled });
  };

  const toggleScreenShare = async () => {
    if (screenSharing) {
      const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const camTrack = camStream.getVideoTracks()[0];
      localStreamRef.current?.getVideoTracks().forEach(t => t.stop());
      peerConns.current.forEach(pc => {
        pc.getSenders().find(s => s.track?.kind === 'video')?.replaceTrack(camTrack);
      });
      if (localVideoRef.current) localVideoRef.current.srcObject = camStream;
      localStreamRef.current = camStream;
      setScreenSharing(false);
    } else {
      try {
        const screenStream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        peerConns.current.forEach(pc => {
          pc.getSenders().find(s => s.track?.kind === 'video')?.replaceTrack(screenTrack);
        });
        if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;
        screenTrack.onended = () => setScreenSharing(false);
        setScreenSharing(true);
      } catch {}
    }
  };

  // ── Recording (MediaRecorder) ──────────────────────────────────────────────
  const startRecording = () => {
    if (!localStreamRef.current) return;
    recordingChunks.current = [];

    // Capture canvas mix if possible, fallback to local stream only
    const stream = localStreamRef.current;
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus' });
    } catch {
      recorder = new MediaRecorder(stream);
    }

    recorder.ondataavailable = e => { if (e.data.size > 0) recordingChunks.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(recordingChunks.current, { type: 'video/webm' });
      setRecordingBlob(blob);
      // Save recording metadata to backend
      fetch(`/api/video-sessions/${roomId}/recording`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'end', durationSeconds: recDuration, sizeEstimateBytes: blob.size, consentedParticipants: [userName, ...peers.map(p => p.name)] }),
      }).catch(() => {});
    };

    recorder.start(1000);
    mediaRecorderRef.current = recorder;
    setRecording(true);
    setRecDuration(0);
    recTimerRef.current = setInterval(() => setRecDuration(d => d + 1), 1000);

    // Notify backend + peers
    fetch(`/api/video-sessions/${roomId}/recording`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start', consentedParticipants: [userName, ...peers.map(p => p.name)] }),
    }).catch(() => {});
    socketRef.current?.emit('broadcast-recording', { roomId, started: true, by: userName });
    addChat('System', `🔴 You started recording. All participants have been notified.`, false, true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
    socketRef.current?.emit('broadcast-recording', { roomId, started: false, by: userName });
  };

  const downloadRecording = () => {
    if (!recordingBlob) return;
    const url = URL.createObjectURL(recordingBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sessionTitle.replace(/[^a-z0-9]/gi, '-')}-${new Date().toISOString().slice(0, 10)}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Transcription (Web Speech API) ─────────────────────────────────────────
  const startTranscription = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addChat('System', 'Live transcription is not supported in this browser. Try Chrome or Edge.', false, true);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          const line: TranscriptLine = {
            id: crypto.randomUUID(),
            speaker: userName,
            text: transcript.trim(),
            timestamp: new Date().toISOString(),
            isFinal: true,
          };
          setTranscriptLines(prev => [...prev, line]);
          setInterimText('');
          // Save to backend
          fetch(`/api/video-sessions/${roomId}/transcript`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ speaker: userName, role: userRole, text: transcript.trim(), timestamp: line.timestamp }),
          }).catch(() => {});
        } else {
          interim += transcript;
        }
      }
      if (interim) setInterimText(interim);
    };

    recognition.onerror = () => { setTranscribing(false); };
    recognition.onend = () => { if (transcribing) recognition.start(); };

    recognition.start();
    recognitionRef.current = recognition;
    setTranscribing(true);
    setActivePanel('transcript');
  };

  const stopTranscription = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setTranscribing(false);
    setInterimText('');
  };

  const downloadTranscript = () => {
    const text = [
      `Session Transcript — ${sessionTitle}`,
      `Room: ${roomId}`,
      `Date: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      `Duration: ${fmt(duration)}`,
      '',
      '─────────────────────────────────────────',
      '',
      ...transcriptLines.map(l => `[${new Date(l.timestamp).toLocaleTimeString('en-IN')}] ${l.speaker}: ${l.text}`),
      '',
      '─────────────────────────────────────────',
      'Generated by MetryxOne · Confidential · DPDP Act 2023 Compliant',
    ].join('\n');

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${roomId}-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Session Notes ──────────────────────────────────────────────────────────
  const saveNotes = () => {
    fetch(`/api/video-sessions/${roomId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    }).catch(() => {});
    // Also save locally
    localStorage.setItem(`metryx-notes-${roomId}`, notes);
  };

  const downloadNotes = () => {
    const blob = new Blob([`Session Notes — ${sessionTitle}\n\n${notes}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notes-${roomId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Copy invite link ───────────────────────────────────────────────────────
  const copyInviteLink = async () => {
    const link = `${window.location.origin}/join-session?room=${roomId}`;
    await navigator.clipboard.writeText(link);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 3000);
  };

  // ── Chat ───────────────────────────────────────────────────────────────────
  const sendChat = () => {
    if (!chatInput.trim()) return;
    const text = chatInput.trim();
    const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    socketRef.current?.emit('chat-message', { roomId, from: userName, text, time });
    addChat(userName, text, true);
    setChatInput('');
  };

  // ── End call ──────────────────────────────────────────────────────────────
  const endCall = async () => {
    if (recording) stopRecording();
    if (transcribing) stopTranscription();
    saveNotes();

    // Mark session ended on backend
    fetch(`/api/video-sessions/${roomId}/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    }).catch(() => {});

    localStreamRef.current?.getTracks().forEach(t => t.stop());
    peerConns.current.forEach(pc => pc.close());
    socketRef.current?.disconnect();

    setShowPostSession(true);
  };

  const finishAndLeave = () => {
    onLeave({
      duration,
      transcriptLines,
      notes,
      recordingBlob,
      participantCount: peers.length + 1,
    });
  };

  // ── Panel toggle ───────────────────────────────────────────────────────────
  const togglePanel = (panel: Panel) => setActivePanel(prev => prev === panel ? null : panel);

  // ── Render: DPDP Consent gate ──────────────────────────────────────────────
  if (!consentDone) {
    return (
      <DPDPConsentModal
        sessionTitle={sessionTitle}
        mentorName={userRole === 'mentor' ? userName : 'Your Mentor'}
        participantName={userName}
        role={userRole}
        roomId={roomId}
        onAccept={() => setConsentDone(true)}
        onDecline={() => onLeave()}
      />
    );
  }

  // ── Render: Camera error ───────────────────────────────────────────────────
  if (mediaError) {
    return (
      <div className="fixed inset-0 z-[100] bg-gray-900 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 max-w-sm text-center">
          <div className="h-14 w-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <VideoOff size={28} className="text-red-500" />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-2">Camera Access Required</h3>
          <p className="text-sm text-gray-500 mb-5">{mediaError}</p>
          <Button variant="outline" onClick={() => onLeave()} className="w-full">Go Back</Button>
        </div>
      </div>
    );
  }

  // ── Render: Post-session summary ───────────────────────────────────────────
  if (showPostSession) {
    return (
      <div className="fixed inset-0 z-[100] bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="px-6 py-5 border-b border-gray-100 text-center">
            <div className="h-12 w-12 rounded-2xl bg-teal-50 flex items-center justify-center mx-auto mb-3">
              <Check size={24} className="text-teal-500" />
            </div>
            <h2 className="text-base font-bold text-gray-900">Session Complete</h2>
            <p className="text-xs text-gray-500 mt-0.5">{sessionTitle}</p>
          </div>

          <div className="px-6 py-4 space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Duration', value: fmt(duration), icon: Clock },
                { label: 'Transcript', value: `${transcriptLines.length} lines`, icon: FileText },
                { label: 'Participants', value: `${peers.length + 1}`, icon: Users },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="p-3 bg-gray-50 rounded-xl text-center">
                  <Icon size={16} className="mx-auto mb-1 text-gray-400" />
                  <p className="text-sm font-bold text-gray-800">{value}</p>
                  <p className="text-[10px] text-gray-500">{label}</p>
                </div>
              ))}
            </div>

            {/* Downloads */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-700">Download Session Artifacts</p>

              {transcriptLines.length > 0 && (
                <button onClick={downloadTranscript}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors text-left">
                  <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <FileText size={16} className="text-blue-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-800">Session Transcript</p>
                    <p className="text-[10px] text-gray-500">{transcriptLines.length} lines · TXT format</p>
                  </div>
                  <Download size={15} className="text-gray-400" />
                </button>
              )}

              {recordingBlob && (
                <button onClick={downloadRecording}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors text-left">
                  <div className="h-9 w-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                    <Video size={16} className="text-red-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-800">Session Recording</p>
                    <p className="text-[10px] text-gray-500">{fmt(recDuration)} · WebM video · {(recordingBlob.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                  <Download size={15} className="text-gray-400" />
                </button>
              )}

              {notes.trim() && (
                <button onClick={downloadNotes}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors text-left">
                  <div className="h-9 w-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                    <FileText size={16} className="text-amber-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-gray-800">Session Notes</p>
                    <p className="text-[10px] text-gray-500">{notes.split('\n').length} lines · TXT format</p>
                  </div>
                  <Download size={15} className="text-gray-400" />
                </button>
              )}
            </div>

            {/* Transcript preview */}
            {transcriptLines.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">Transcript Preview</p>
                <div className="bg-gray-50 rounded-xl p-3 max-h-36 overflow-y-auto space-y-1">
                  {transcriptLines.slice(-6).map(line => (
                    <div key={line.id}>
                      <span className="text-[10px] font-semibold text-gray-500">{line.speaker}: </span>
                      <span className="text-[11px] text-gray-700">{line.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* DPDP notice */}
            <div className="p-3 bg-blue-50 rounded-xl flex items-start gap-2">
              <Shield size={13} className="text-blue-500 mt-0.5 shrink-0" />
              <p className="text-[10px] text-blue-600">
                All recordings and transcripts are stored securely per the DPDP Act 2023 and auto-deleted after 90 days.
                To request early erasure: <span className="font-semibold">privacy@metryxone.com</span>
              </p>
            </div>

            <Button className="w-full text-sm text-white" style={{ backgroundColor: BRAND.primary }} onClick={finishAndLeave}>
              Close Summary
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main call UI ───────────────────────────────────────────────────────────
  const totalParticipants = peers.length + 1;

  return (
    <div className="fixed inset-0 z-[100] bg-gray-950 flex flex-col select-none">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: BRAND.primary }}>
            <Video size={15} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white truncate max-w-[180px] sm:max-w-xs">{sessionTitle}</p>
            <div className="flex items-center gap-2 text-[10px] text-gray-400">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                Live
              </span>
              <span>·</span><span>{fmt(duration)}</span>
              <span>·</span><Users size={10} /><span>{totalParticipants}</span>
              {recording && (
                <><span>·</span><span className="flex items-center gap-1 text-red-400 font-semibold"><Circle size={8} className="fill-red-400" /> REC {fmt(recDuration)}</span></>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Copy invite link */}
          <button onClick={copyInviteLink}
            title="Copy invite link"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors text-[11px]">
            {linkCopied ? <Check size={13} className="text-teal-400" /> : <Copy size={13} />}
            {linkCopied ? 'Copied!' : 'Invite'}
          </button>
          <button onClick={() => setFullscreen(f => !f)} className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-colors">
            {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </div>

      {/* ── Recording notification banner ── */}
      {recording && (
        <div className="bg-red-600 px-4 py-1.5 text-center text-xs text-white font-semibold flex items-center justify-center gap-2 shrink-0">
          <Circle size={8} className="fill-white animate-pulse" />
          This session is being recorded · All participants have been notified · DPDP Compliant
        </div>
      )}
      {transcribing && (
        <div className="bg-blue-600 px-4 py-1 text-center text-[10px] text-white flex items-center justify-center gap-2 shrink-0">
          <Mic size={10} className="animate-pulse" />
          Live transcription active — your speech is being converted to text
        </div>
      )}

      {/* ── Video + panels ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Video grid */}
        <div className="flex-1 p-3 overflow-auto">
          <div className={`grid gap-2 h-full ${totalParticipants === 1 ? 'grid-cols-1 place-items-center' : totalParticipants <= 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>

            {/* Local */}
            <div className={`relative rounded-xl overflow-hidden bg-gray-800 ${totalParticipants === 1 ? 'w-full max-w-2xl aspect-video' : 'aspect-video w-full'}`}>
              <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              {!videoEnabled && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                  <div className="h-16 w-16 rounded-full bg-gray-700 flex items-center justify-center">
                    <span className="text-2xl font-bold text-white">{userName[0]?.toUpperCase()}</span>
                  </div>
                </div>
              )}
              <div className="absolute bottom-2 left-2 bg-black/60 rounded-lg px-2 py-1 flex items-center gap-1.5">
                {!audioEnabled && <MicOff size={10} className="text-red-400" />}
                <span className="text-[11px] text-white font-medium">{userName} (you)</span>
              </div>
              {screenSharing && (
                <div className="absolute top-2 right-2 bg-teal-500 rounded-lg px-2 py-0.5 text-[10px] text-white font-semibold">Sharing screen</div>
              )}
            </div>

            {/* Remote peers */}
            {peers.map(peer => (
              <div key={peer.socketId} className="relative rounded-xl overflow-hidden bg-gray-800 aspect-video w-full">
                <video
                  ref={el => {
                    if (el) {
                      remoteVideos.current.set(peer.socketId, el);
                      if (peer.stream) el.srcObject = peer.stream;
                    }
                  }}
                  autoPlay playsInline className="w-full h-full object-cover"
                />
                {!peer.videoEnabled && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                    <div className="h-16 w-16 rounded-full flex items-center justify-center" style={{ backgroundColor: BRAND.primary }}>
                      <span className="text-2xl font-bold text-white">{peer.name[0]?.toUpperCase()}</span>
                    </div>
                  </div>
                )}
                <div className="absolute bottom-2 left-2 bg-black/60 rounded-lg px-2 py-1 flex items-center gap-1.5">
                  {!peer.audioEnabled && <MicOff size={10} className="text-red-400" />}
                  <span className="text-[11px] text-white font-medium">{peer.name}</span>
                  <span className="text-[9px] text-gray-300 capitalize">({peer.role})</span>
                </div>
              </div>
            ))}

            {/* Waiting */}
            {peers.length === 0 && (
              <div className="col-span-2 flex flex-col items-center justify-center gap-3 py-6">
                <div className="w-2 h-2 rounded-full bg-yellow-400 animate-bounce" />
                <p className="text-sm text-gray-400">Waiting for participant to join…</p>
                <button onClick={copyInviteLink}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white"
                  style={{ backgroundColor: BRAND.accent }}>
                  {linkCopied ? <Check size={13} /> : <Copy size={13} />}
                  {linkCopied ? 'Copied!' : 'Copy invite link'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Side Panel ── */}
        {activePanel && (
          <div className="w-72 bg-gray-900 border-l border-gray-800 flex flex-col shrink-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <span className="text-sm font-semibold text-white capitalize">
                {activePanel === 'chat' ? 'In-call Chat' : activePanel === 'participants' ? 'Participants' : activePanel === 'transcript' ? 'Live Transcript' : 'Session Notes'}
              </span>
              <button onClick={() => setActivePanel(null)} className="text-gray-400 hover:text-white"><X size={15} /></button>
            </div>

            {/* CHAT */}
            {activePanel === 'chat' && (
              <>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {chatMessages.length === 0 && <p className="text-xs text-gray-500 text-center py-6">No messages yet</p>}
                  {chatMessages.map(msg => (
                    <div key={msg.id} className={`flex flex-col ${msg.system ? 'items-center' : msg.self ? 'items-end' : 'items-start'}`}>
                      {msg.system ? (
                        <p className="text-[10px] text-gray-500 bg-gray-800 px-2 py-1 rounded-full">{msg.text}</p>
                      ) : (
                        <>
                          {!msg.self && <span className="text-[10px] text-gray-500 mb-0.5">{msg.sender}</span>}
                          <div className="max-w-[85%] rounded-xl px-3 py-1.5 text-xs"
                            style={msg.self ? { backgroundColor: BRAND.primary, color: 'white' } : { backgroundColor: '#374151', color: '#e5e7eb' }}>
                            {msg.text}
                          </div>
                          <span className="text-[9px] text-gray-600 mt-0.5">{msg.time}</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t border-gray-800 flex gap-2">
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendChat()}
                    placeholder="Type message…"
                    className="flex-1 bg-gray-800 text-white text-xs rounded-xl px-3 py-2 outline-none placeholder:text-gray-500" />
                  <button onClick={sendChat} className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0" style={{ backgroundColor: BRAND.accent }}>
                    <Send size={13} />
                  </button>
                </div>
              </>
            )}

            {/* PARTICIPANTS */}
            {activePanel === 'participants' && (
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {/* Local */}
                <div className="flex items-center gap-2.5 p-2.5 bg-gray-800 rounded-xl">
                  <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: BRAND.primary }}>
                    {userName[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{userName} (you)</p>
                    <p className="text-[10px] text-gray-400 capitalize">{userRole}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {!audioEnabled && <MicOff size={12} className="text-red-400" />}
                    {!videoEnabled && <VideoOff size={12} className="text-red-400" />}
                  </div>
                </div>
                {peers.map(peer => (
                  <div key={peer.socketId} className="flex items-center gap-2.5 p-2.5 bg-gray-800/60 rounded-xl">
                    <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: BRAND.accent + 'cc' }}>
                      {peer.name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{peer.name}</p>
                      <p className="text-[10px] text-gray-400 capitalize">{peer.role}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {!peer.audioEnabled && <MicOff size={12} className="text-red-400" />}
                      {!peer.videoEnabled && <VideoOff size={12} className="text-red-400" />}
                    </div>
                  </div>
                ))}
                {peers.length === 0 && (
                  <div className="text-center py-6">
                    <p className="text-xs text-gray-500 mb-2">No other participants yet</p>
                    <button onClick={copyInviteLink}
                      className="text-[11px] font-semibold px-3 py-1.5 rounded-xl text-white"
                      style={{ backgroundColor: BRAND.accent }}>
                      {linkCopied ? '✓ Copied!' : 'Copy Invite Link'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TRANSCRIPT */}
            {activePanel === 'transcript' && (
              <>
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
                  <span className="text-[10px] text-gray-400">{transcriptLines.length} lines</span>
                  {transcriptLines.length > 0 && (
                    <button onClick={downloadTranscript} className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1">
                      <Download size={11} /> Download TXT
                    </button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {transcriptLines.length === 0 && !interimText && (
                    <p className="text-xs text-gray-500 text-center py-6">
                      {transcribing ? 'Listening… start speaking.' : 'Start transcription to see text here.'}
                    </p>
                  )}
                  {transcriptLines.map(line => (
                    <div key={line.id}>
                      <span className="text-[9px] text-gray-500">{new Date(line.timestamp).toLocaleTimeString('en-IN')} · {line.speaker}: </span>
                      <span className="text-[11px] text-gray-200">{line.text}</span>
                    </div>
                  ))}
                  {interimText && (
                    <div className="italic text-[11px] text-gray-400">{interimText}…</div>
                  )}
                </div>
              </>
            )}

            {/* NOTES */}
            {activePanel === 'notes' && (
              <>
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
                  <span className="text-[10px] text-gray-400">Auto-saved locally</span>
                  <button onClick={downloadNotes} className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1">
                    <Download size={11} /> Save TXT
                  </button>
                </div>
                <textarea value={notes} onChange={e => { setNotes(e.target.value); saveNotes(); }}
                  placeholder="Type session notes here…&#10;&#10;• Key discussion points&#10;• Action items&#10;• Homework assigned&#10;• Next steps"
                  className="flex-1 bg-transparent text-xs text-gray-200 p-3 outline-none resize-none placeholder:text-gray-600 leading-relaxed"
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Control bar ── */}
      <div className="bg-gray-900 border-t border-gray-800 px-4 py-3 flex items-center justify-between shrink-0">
        {/* Left: recording / transcription */}
        <div className="flex items-center gap-2">
          <button onClick={recording ? stopRecording : startRecording}
            title={recording ? 'Stop recording' : 'Start recording'}
            className={`h-9 px-3 rounded-xl flex items-center gap-1.5 text-xs font-semibold transition-all ${recording ? 'bg-red-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'}`}>
            {recording ? <Square size={13} /> : <Circle size={13} />}
            <span className="hidden sm:inline">{recording ? `Stop (${fmt(recDuration)})` : 'Record'}</span>
          </button>
          <button onClick={transcribing ? stopTranscription : startTranscription}
            title={transcribing ? 'Stop transcription' : 'Start transcription'}
            className={`h-9 px-3 rounded-xl flex items-center gap-1.5 text-xs font-semibold transition-all ${transcribing ? 'text-white' : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'}`}
            style={transcribing ? { backgroundColor: BRAND.accent } : {}}>
            <Mic size={13} />
            <span className="hidden sm:inline">{transcribing ? 'Stop Text' : 'Transcribe'}</span>
          </button>
        </div>

        {/* Center: main controls */}
        <div className="flex items-center gap-2">
          <button onClick={toggleAudio} title={audioEnabled ? 'Mute' : 'Unmute'}
            className={`h-11 w-11 rounded-full flex items-center justify-center transition-all ${audioEnabled ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-red-500 text-white'}`}>
            {audioEnabled ? <Mic size={18} /> : <MicOff size={18} />}
          </button>
          <button onClick={toggleVideo} title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
            className={`h-11 w-11 rounded-full flex items-center justify-center transition-all ${videoEnabled ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-red-500 text-white'}`}>
            {videoEnabled ? <Video size={18} /> : <VideoOff size={18} />}
          </button>
          <button onClick={toggleScreenShare} title={screenSharing ? 'Stop sharing' : 'Share screen'}
            className={`h-11 w-11 rounded-full flex items-center justify-center transition-all ${screenSharing ? 'text-white' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
            style={screenSharing ? { backgroundColor: BRAND.accent } : {}}>
            {screenSharing ? <MonitorOff size={18} /> : <Monitor size={18} />}
          </button>
          <button onClick={endCall}
            className="h-11 w-14 rounded-full flex items-center justify-center bg-red-500 hover:bg-red-600 text-white transition-all">
            <PhoneOff size={20} />
          </button>
        </div>

        {/* Right: panel toggles */}
        <div className="flex items-center gap-1.5">
          {[
            { id: 'chat' as Panel, icon: MessageSquare, badge: chatMessages.filter(m => !m.self && !m.system).length },
            { id: 'participants' as Panel, icon: Users, badge: totalParticipants },
            { id: 'transcript' as Panel, icon: FileText, badge: transcriptLines.length },
            { id: 'notes' as Panel, icon: FileText, badge: 0, label: '📝' },
          ].map(({ id, icon: Icon, badge }) => (
            <button key={id} onClick={() => togglePanel(id)}
              title={id?.toString()}
              className={`relative h-9 w-9 rounded-xl flex items-center justify-center transition-all ${activePanel === id ? 'text-white' : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'}`}
              style={activePanel === id ? { backgroundColor: BRAND.primary } : {}}>
              <Icon size={16} />
              {badge > 0 && (
                <span className="absolute -top-1 -right-1 text-[9px] font-bold text-white w-4 h-4 rounded-full flex items-center justify-center bg-red-500">{badge > 9 ? '9+' : badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
