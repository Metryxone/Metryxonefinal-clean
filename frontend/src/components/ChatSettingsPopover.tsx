import { useEffect, useRef } from 'react';
import { Settings as SettingsIcon, X } from 'lucide-react';

export type PausePref = 'none' | 'session' | 'always';
export type ResponseStyle = 'standard' | 'concise';
export type PreferredLanguage = 'english' | 'hindi' | 'tamil' | 'telugu' | 'marathi';

interface ChatSettingsPopoverProps {
  pausePref: PausePref;
  onChangePausePref: (v: PausePref) => void;
  responseStyle: ResponseStyle;
  onChangeResponseStyle: (v: ResponseStyle) => void;
  preferredLanguage: PreferredLanguage;
  onChangePreferredLanguage: (v: PreferredLanguage) => void;
  onClose: () => void;
  testIdPrefix?: string;
}

const PAUSE_OPTIONS: { value: PausePref; label: string; sub: string }[] = [
  { value: 'none',    label: 'On',                  sub: 'Offer a pause on sensitive replies' },
  { value: 'session', label: 'Off for this session', sub: 'Hide for this tab only — not saved to your account' },
  { value: 'always',  label: 'Off always',           sub: 'Never show pause prompts' },
];

const RESPONSE_STYLE_OPTIONS: { value: ResponseStyle; label: string; sub: string }[] = [
  { value: 'standard', label: 'Standard', sub: 'Detailed, thorough responses' },
  { value: 'concise',  label: 'Concise',  sub: 'Short, to-the-point answers' },
];

const LANGUAGE_OPTIONS: { value: PreferredLanguage; label: string; native: string }[] = [
  { value: 'english', label: 'English',  native: 'English' },
  { value: 'hindi',   label: 'Hindi',    native: 'हिंदी' },
  { value: 'tamil',   label: 'Tamil',    native: 'தமிழ்' },
  { value: 'telugu',  label: 'Telugu',   native: 'తెలుగు' },
  { value: 'marathi', label: 'Marathi',  native: 'मराठी' },
];

function RadioGroup<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  testIdPrefix,
  groupKey,
}: {
  options: { value: T; label: string; sub: string }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
  testIdPrefix: string;
  groupKey: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {options.map(opt => {
        const selected = value === opt.value;
        return (
          <button key={opt.value} role="radio" aria-checked={selected}
            onClick={() => onChange(opt.value)}
            data-testid={`${testIdPrefix}-${groupKey}-${opt.value}`}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
              border: `1px solid ${selected ? 'rgba(29,62,139,0.35)' : '#E8ECF2'}`,
              background: selected ? 'rgba(29,62,139,0.06)' : '#ffffff',
              textAlign: 'left', transition: 'all 0.12s',
            }}
            onMouseEnter={e => { if (!selected) e.currentTarget.style.background = '#F7F9FC'; }}
            onMouseLeave={e => { if (!selected) e.currentTarget.style.background = '#ffffff'; }}>
            <span style={{
              width: 14, height: 14, borderRadius: '50%', flexShrink: 0, marginTop: 2,
              border: `2px solid ${selected ? '#1D3E8B' : '#cbd5e1'}`,
              background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {selected && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1D3E8B' }} />}
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>{opt.label}</span>
              <span style={{ fontSize: '10.5px', color: '#94a3b8', lineHeight: 1.35 }}>{opt.sub}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function ChatSettingsPopover({
  pausePref,
  onChangePausePref,
  responseStyle,
  onChangeResponseStyle,
  preferredLanguage,
  onChangePreferredLanguage,
  onClose,
  testIdPrefix = 'chat-settings',
}: ChatSettingsPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (ref.current && ref.current.contains(target)) return;
      if (target instanceof Element && target.closest('[data-mx-chat-settings-trigger]')) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [onClose]);

  return (
    <div ref={ref} role="dialog" aria-label="Chat preferences" data-testid={`${testIdPrefix}-popover`}
      style={{
        position: 'absolute', top: 'calc(100% + 6px)', right: 8, zIndex: 50,
        width: 260, background: '#ffffff', borderRadius: 12,
        border: '1px solid #E0E5EE',
        boxShadow: '0 12px 32px rgba(15,23,42,0.18), 0 2px 8px rgba(15,23,42,0.08)',
        padding: '12px 14px', color: '#1e293b',
        animation: 'mxSettingsFade 0.16s ease-out both',
      }}
      onClick={e => e.stopPropagation()}>
      <style>{`@keyframes mxSettingsFade { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <SettingsIcon size={14} color="#1D3E8B" />
        <p style={{ margin: 0, fontSize: '12.5px', fontWeight: 700, color: '#1D3E8B', flex: 1 }}>Chat preferences</p>
        <button onClick={onClose} aria-label="Close preferences" data-testid={`${testIdPrefix}-close`}
          style={{ width: 20, height: 20, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={12} />
        </button>
      </div>

      <div>
        <p style={{ margin: '0 0 6px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94a3b8' }}>
          Pause prompts
        </p>
        <p style={{ margin: '0 0 8px', fontSize: '11px', color: '#64748b', lineHeight: 1.45 }}>
          Pragati can offer a short breathing pause on emotionally sensitive replies.
        </p>
        <RadioGroup
          options={PAUSE_OPTIONS}
          value={pausePref}
          onChange={onChangePausePref}
          ariaLabel="Pause prompts preference"
          testIdPrefix={testIdPrefix}
          groupKey="pause"
        />
      </div>

      <div style={{ borderTop: '1px solid #F0F2F7', margin: '12px 0 0', paddingTop: 12 }}>
        <p style={{ margin: '0 0 6px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94a3b8' }}>
          Response style
        </p>
        <p style={{ margin: '0 0 8px', fontSize: '11px', color: '#64748b', lineHeight: 1.45 }}>
          Choose how Pragati formats replies.
        </p>
        <RadioGroup
          options={RESPONSE_STYLE_OPTIONS}
          value={responseStyle}
          onChange={onChangeResponseStyle}
          ariaLabel="Response style preference"
          testIdPrefix={testIdPrefix}
          groupKey="style"
        />
      </div>

      <div style={{ borderTop: '1px solid #F0F2F7', margin: '12px 0 0', paddingTop: 12 }}>
        <p style={{ margin: '0 0 6px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#94a3b8' }}>
          Preferred language
        </p>
        <p style={{ margin: '0 0 8px', fontSize: '11px', color: '#64748b', lineHeight: 1.45 }}>
          Pragati will reply in this language.
        </p>
        <div role="radiogroup" aria-label="Preferred language" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {LANGUAGE_OPTIONS.map(opt => {
            const selected = preferredLanguage === opt.value;
            return (
              <button
                key={opt.value}
                role="radio"
                aria-checked={selected}
                onClick={() => onChangePreferredLanguage(opt.value)}
                data-testid={`${testIdPrefix}-lang-${opt.value}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${selected ? 'rgba(29,62,139,0.35)' : '#E8ECF2'}`,
                  background: selected ? 'rgba(29,62,139,0.06)' : '#ffffff',
                  textAlign: 'left', transition: 'all 0.12s',
                }}
                onMouseEnter={e => { if (!selected) e.currentTarget.style.background = '#F7F9FC'; }}
                onMouseLeave={e => { if (!selected) e.currentTarget.style.background = '#ffffff'; }}>
                <span style={{
                  width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${selected ? '#1D3E8B' : '#cbd5e1'}`,
                  background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {selected && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1D3E8B' }} />}
                </span>
                <span style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>{opt.label}</span>
                  {opt.native !== opt.label && (
                    <span style={{ fontSize: '11px', color: '#64748b' }}>{opt.native}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default ChatSettingsPopover;
