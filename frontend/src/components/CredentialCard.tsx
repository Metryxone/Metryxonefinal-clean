import { useState } from 'react';
import { Copy, Check, Key, User, Shield, Eye, EyeOff, Download } from 'lucide-react';

interface Props {
  childName: string;
  username: string;
  password: string;
  platformId?: string;
  onClose?: () => void;
}

export function CredentialCard({ childName, username, password, platformId, onClose }: Props) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const copy = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  const copyAll = () => {
    const text = `MetryxOne Student Login\nName: ${childName}\nUsername: ${username}\nPassword: ${password}${platformId ? `\nStudent ID: ${platformId}` : ''}\nLogin at: app.metryx.one`;
    copy(text, 'all');
  };

  return (
    <div className="rounded-2xl overflow-hidden shadow-lg border" style={{ borderColor: '#0B3C5D30', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div className="px-5 py-4" style={{ background: '#0B3C5D' }}>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(78,205,196,0.2)', border: '1.5px solid rgba(78,205,196,0.4)' }}>
            <Key size={18} style={{ color: '#4ECDC4' }} />
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase text-white/40">Student Login Credentials</p>
            <p className="text-sm font-bold text-white">{childName}</p>
          </div>
          {platformId && (
            <div className="ml-auto px-2.5 py-1 rounded-lg text-[10px] font-bold" style={{ background: 'rgba(78,205,196,0.15)', color: '#4ECDC4', border: '1px solid rgba(78,205,196,0.3)' }}>
              {platformId}
            </div>
          )}
        </div>
      </div>

      {/* Warning banner */}
      <div className="px-5 py-2.5 flex items-center gap-2" style={{ background: '#FFF7ED', borderBottom: '1px solid #FED7AA' }}>
        <Shield size={13} className="text-amber-500 flex-shrink-0" />
        <p className="text-[11px] text-amber-700 font-medium">Save these credentials now. The password will not be shown again.</p>
      </div>

      {/* Credential rows */}
      <div className="px-5 py-4 space-y-3 bg-white">
        {/* Username */}
        <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#F8FAFC', border: '1px solid #E8ECF2' }}>
          <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(11,60,93,0.08)' }}>
            <User size={14} style={{ color: '#0B3C5D' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Username</p>
            <p className="text-sm font-bold font-mono" style={{ color: '#0B3C5D' }}>{username}</p>
          </div>
          <button
            onClick={() => copy(username, 'username')}
            className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: copiedField === 'username' ? 'rgba(78,205,196,0.12)' : 'rgba(11,60,93,0.06)' }}
            title="Copy username"
          >
            {copiedField === 'username'
              ? <Check size={13} style={{ color: '#4ECDC4' }} />
              : <Copy size={13} style={{ color: '#0B3C5D' }} />}
          </button>
        </div>

        {/* Password */}
        <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#F8FAFC', border: '1px solid #E8ECF2' }}>
          <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(78,205,196,0.08)' }}>
            <Key size={14} style={{ color: '#4ECDC4' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Password</p>
            <p className="text-sm font-bold font-mono" style={{ color: '#0B3C5D' }}>
              {showPassword ? password : '••••••••'}
            </p>
          </div>
          <button
            onClick={() => setShowPassword(v => !v)}
            className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: 'rgba(11,60,93,0.06)' }}
            title={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={13} style={{ color: '#0B3C5D' }} /> : <Eye size={13} style={{ color: '#0B3C5D' }} />}
          </button>
          <button
            onClick={() => copy(password, 'password')}
            className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: copiedField === 'password' ? 'rgba(78,205,196,0.12)' : 'rgba(11,60,93,0.06)' }}
            title="Copy password"
          >
            {copiedField === 'password'
              ? <Check size={13} style={{ color: '#4ECDC4' }} />
              : <Copy size={13} style={{ color: '#0B3C5D' }} />}
          </button>
        </div>
      </div>

      {/* Footer actions */}
      <div className="px-5 pb-4 flex gap-2 bg-white">
        <button
          onClick={copyAll}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: copiedField === 'all' ? 'rgba(78,205,196,0.12)' : '#0B3C5D',
            color: copiedField === 'all' ? '#4ECDC4' : '#ffffff',
          }}
        >
          {copiedField === 'all' ? <Check size={14} /> : <Download size={14} />}
          {copiedField === 'all' ? 'Copied!' : 'Copy All Credentials'}
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors border border-gray-200"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}
