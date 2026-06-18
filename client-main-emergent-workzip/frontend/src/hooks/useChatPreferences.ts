import { useState, useEffect, useCallback } from 'react';
import type { PausePref, ResponseStyle, PreferredLanguage } from '../components/ChatSettingsPopover';

const LS_ALWAYS_KEY = 'mx-breathing-suppress-always';
// SS_SESSION_KEY is intentionally stored in sessionStorage, which is scoped to a
// single browser tab. This means "Off for this session" automatically resets to
// "On" whenever the user opens a new tab or restarts the browser — no extra cleanup
// is needed. The value is never persisted to the server, so a fresh tab always
// starts with an empty sessionStorage and falls back to 'none' (i.e. "On").
const SS_SESSION_KEY = 'mx-breathing-suppress-session';
const LS_RESPONSE_STYLE_KEY = 'mx-response-style';
const LS_PREFERRED_LANGUAGE_KEY = 'mx-preferred-language';
const LS_TOKEN_KEY = 'metryx_token';

function readLocalPausePref(): PausePref {
  if (typeof window === 'undefined') return 'none';
  if (localStorage.getItem(LS_ALWAYS_KEY) === '1') return 'always';
  // sessionStorage is tab-scoped: a new tab will have no entry here, so the
  // expression below evaluates to false and we fall through to 'none' ("On").
  if (sessionStorage.getItem(SS_SESSION_KEY) === '1') return 'session';
  return 'none';
}

function readLocalResponseStyle(): ResponseStyle {
  if (typeof window === 'undefined') return 'standard';
  const stored = localStorage.getItem(LS_RESPONSE_STYLE_KEY);
  if (stored === 'concise') return 'concise';
  return 'standard';
}

function readLocalPreferredLanguage(): PreferredLanguage {
  if (typeof window === 'undefined') return 'english';
  const stored = localStorage.getItem(LS_PREFERRED_LANGUAGE_KEY);
  const valid: PreferredLanguage[] = ['english', 'hindi', 'tamil', 'telugu', 'marathi'];
  if (stored && valid.includes(stored as PreferredLanguage)) return stored as PreferredLanguage;
  return 'english';
}

function writeLocalPausePref(pref: PausePref): void {
  try {
    if (pref === 'always') {
      localStorage.setItem(LS_ALWAYS_KEY, '1');
      sessionStorage.setItem(SS_SESSION_KEY, '1');
    } else if (pref === 'session') {
      localStorage.removeItem(LS_ALWAYS_KEY);
      sessionStorage.setItem(SS_SESSION_KEY, '1');
    } else {
      localStorage.removeItem(LS_ALWAYS_KEY);
      sessionStorage.removeItem(SS_SESSION_KEY);
    }
  } catch { /* noop */ }
}

function writeLocalResponseStyle(style: ResponseStyle): void {
  try {
    localStorage.setItem(LS_RESPONSE_STYLE_KEY, style);
  } catch { /* noop */ }
}

function writeLocalPreferredLanguage(lang: PreferredLanguage): void {
  try {
    localStorage.setItem(LS_PREFERRED_LANGUAGE_KEY, lang);
  } catch { /* noop */ }
}

async function fetchServerPrefs(): Promise<{ pausePref: PausePref; responseStyle: ResponseStyle; preferredLanguage: PreferredLanguage } | null> {
  const token = localStorage.getItem(LS_TOKEN_KEY);
  if (!token) return null;
  try {
    const resp = await fetch('/api/chat-preferences', {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    });
    if (!resp.ok) return null;
    const data = await resp.json() as { pausePref?: string; responseStyle?: string; preferredLanguage?: string };
    const pausePref: PausePref =
      data.pausePref === 'always' ? 'always' : data.pausePref === 'session' ? 'session' : 'none';
    const responseStyle: ResponseStyle =
      data.responseStyle === 'concise' ? 'concise' : 'standard';
    const validLangs: PreferredLanguage[] = ['english', 'hindi', 'tamil', 'telugu', 'marathi'];
    const preferredLanguage: PreferredLanguage =
      data.preferredLanguage && validLangs.includes(data.preferredLanguage as PreferredLanguage)
        ? (data.preferredLanguage as PreferredLanguage)
        : 'english';
    return { pausePref, responseStyle, preferredLanguage };
  } catch {
    return null;
  }
}

async function saveServerPrefs(partial: { pausePref?: PausePref; responseStyle?: ResponseStyle; preferredLanguage?: PreferredLanguage }): Promise<void> {
  const token = localStorage.getItem(LS_TOKEN_KEY);
  if (!token) return;
  const body: Record<string, string> = {};
  if (partial.pausePref !== undefined) body.pausePref = partial.pausePref;
  if (partial.responseStyle !== undefined) body.responseStyle = partial.responseStyle;
  if (partial.preferredLanguage !== undefined) body.preferredLanguage = partial.preferredLanguage;
  if (Object.keys(body).length === 0) return;
  try {
    await fetch('/api/chat-preferences', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
      body: JSON.stringify(body),
    });
  } catch { /* noop */ }
}

export function useChatPreferences() {
  const [pausePref, setPausePrefState] = useState<PausePref>(readLocalPausePref);
  const [responseStyle, setResponseStyleState] = useState<ResponseStyle>(readLocalResponseStyle);
  const [preferredLanguage, setPreferredLanguageState] = useState<PreferredLanguage>(readLocalPreferredLanguage);

  const refetch = useCallback(async () => {
    const prefs = await fetchServerPrefs();
    if (prefs === null) return;
    setPausePrefState(prefs.pausePref);
    writeLocalPausePref(prefs.pausePref);
    setResponseStyleState(prefs.responseStyle);
    writeLocalResponseStyle(prefs.responseStyle);
    setPreferredLanguageState(prefs.preferredLanguage);
    writeLocalPreferredLanguage(prefs.preferredLanguage);
  }, []);

  useEffect(() => {
    let cancelled = false;
    // When the server returns null (unauthenticated or no saved pref) we leave
    // the local state as-is. For a brand-new tab that local state will already
    // be 'none' ("On") because sessionStorage starts empty.
    // Note: the client never sends 'session' to the server (see setPausePreference),
    // but the server may legitimately return 'session' (e.g. set via another client
    // or legacy data). In that case we honour it by writing to sessionStorage for
    // this tab only — it will still reset on the next new tab or browser restart.
    fetchServerPrefs().then(prefs => {
      if (cancelled || prefs === null) return;
      setPausePrefState(prefs.pausePref);
      writeLocalPausePref(prefs.pausePref);
      setResponseStyleState(prefs.responseStyle);
      writeLocalResponseStyle(prefs.responseStyle);
      setPreferredLanguageState(prefs.preferredLanguage);
      writeLocalPreferredLanguage(prefs.preferredLanguage);
    });
    return () => { cancelled = true; };
  }, []);

  const setPausePreference = useCallback((pref: PausePref) => {
    setPausePrefState(pref);
    writeLocalPausePref(pref);
    if (pref !== 'session') {
      saveServerPrefs({ pausePref: pref });
    }
  }, []);

  const clearPausePreference = useCallback(() => {
    setPausePrefState('none');
    writeLocalPausePref('none');
    saveServerPrefs({ pausePref: 'none' });
  }, []);

  const setResponseStyle = useCallback((style: ResponseStyle) => {
    setResponseStyleState(style);
    writeLocalResponseStyle(style);
    saveServerPrefs({ responseStyle: style });
  }, []);

  const setPreferredLanguage = useCallback((lang: PreferredLanguage) => {
    setPreferredLanguageState(lang);
    writeLocalPreferredLanguage(lang);
    saveServerPrefs({ preferredLanguage: lang });
  }, []);

  return { pausePref, setPausePreference, clearPausePreference, responseStyle, setResponseStyle, preferredLanguage, setPreferredLanguage, refetch };
}
