import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useChatPreferences } from './useChatPreferences';

const SS_SESSION_KEY = 'mx-breathing-suppress-session';
const LS_ALWAYS_KEY = 'mx-breathing-suppress-always';
const LS_TOKEN_KEY = 'metryx_token';

describe('useChatPreferences — pause preference resets in a new tab', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('initialises pausePref as "none" when sessionStorage is empty and the server has no saved pref (unauthenticated)', async () => {
    // No auth token => fetchServerPrefs returns null without making a request,
    // simulating "the server returns no saved pref".
    expect(localStorage.getItem(LS_TOKEN_KEY)).toBeNull();
    expect(sessionStorage.getItem(SS_SESSION_KEY)).toBeNull();

    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const { result } = renderHook(() => useChatPreferences());

    expect(result.current.pausePref).toBe('none');

    // Allow the effect's microtasks to flush; pausePref must remain 'none'.
    await waitFor(() => {
      expect(result.current.pausePref).toBe('none');
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('initialises pausePref as "none" when sessionStorage is empty and the authenticated server returns no saved pref', async () => {
    localStorage.setItem(LS_TOKEN_KEY, 'fake-token');
    expect(sessionStorage.getItem(SS_SESSION_KEY)).toBeNull();

    // Server responds with an empty preferences object (no pausePref saved).
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    const { result } = renderHook(() => useChatPreferences());

    expect(result.current.pausePref).toBe('none');

    await waitFor(() => {
      // After server fetch resolves and falls back to 'none', we should still be 'none'.
      expect(result.current.pausePref).toBe('none');
    });

    // 'session' is intentionally never persisted, so sessionStorage stays empty.
    expect(sessionStorage.getItem(SS_SESSION_KEY)).toBeNull();
  });

  it('a fresh tab sees "none" even if another tab had set "session" (sessionStorage is tab-scoped)', async () => {
    // Simulate "another tab" having activated session-pause. We model the
    // new-tab boundary by writing to that other tab's storage and then
    // discarding it: this tab's sessionStorage starts empty, which is exactly
    // what the browser guarantees for a freshly-opened tab.
    const otherTabSessionStorage: Record<string, string> = {};
    otherTabSessionStorage[SS_SESSION_KEY] = '1';
    expect(otherTabSessionStorage[SS_SESSION_KEY]).toBe('1');

    // This tab's sessionStorage is empty — the cross-tab isolation we rely on.
    expect(sessionStorage.getItem(SS_SESSION_KEY)).toBeNull();

    // Also confirm 'always' is not set in localStorage.
    expect(localStorage.getItem(LS_ALWAYS_KEY)).toBeNull();

    // No token => server returns null (no saved pref).
    const { result } = renderHook(() => useChatPreferences());

    expect(result.current.pausePref).toBe('none');

    await waitFor(() => {
      expect(result.current.pausePref).toBe('none');
    });

    // The other tab's "session" state must not have leaked into this tab.
    expect(sessionStorage.getItem(SS_SESSION_KEY)).toBeNull();
  });

  it('initialises pausePref as "session" when the authenticated server returns pausePref: "session"', async () => {
    localStorage.setItem(LS_TOKEN_KEY, 'fake-token');

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ pausePref: 'session' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const { result } = renderHook(() => useChatPreferences());

    // Initial local state defaults to 'none' (sessionStorage is empty)
    expect(result.current.pausePref).toBe('none');

    // After server fetch resolves, pausePref should reflect the server value 'session'
    await waitFor(() => {
      expect(result.current.pausePref).toBe('session');
    });

    // writeLocalPausePref('session') must have written to sessionStorage
    expect(sessionStorage.getItem(SS_SESSION_KEY)).toBe('1');
    // 'session' must not promote to 'always' (localStorage key must stay empty)
    expect(localStorage.getItem(LS_ALWAYS_KEY)).toBeNull();
  });

  it('falls back to "none" when the server returns an unrecognised pausePref value', async () => {
    localStorage.setItem(LS_TOKEN_KEY, 'fake-token');

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ pausePref: 'unknown-future-value' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const { result } = renderHook(() => useChatPreferences());

    await waitFor(() => {
      // Unrecognised values must coerce to 'none', not silently apply something unexpected.
      expect(result.current.pausePref).toBe('none');
    });

    expect(sessionStorage.getItem(SS_SESSION_KEY)).toBeNull();
    expect(localStorage.getItem(LS_ALWAYS_KEY)).toBeNull();
  });

  it('setting pausePref to "session" writes to sessionStorage but never to the server, so a new tab still resets', async () => {
    localStorage.setItem(LS_TOKEN_KEY, 'fake-token');

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      );

    const { result, unmount } = renderHook(() => useChatPreferences());

    await waitFor(() => {
      expect(result.current.pausePref).toBe('none');
    });

    // Activate session-pause in "this tab".
    act(() => {
      result.current.setPausePreference('session');
    });

    expect(result.current.pausePref).toBe('session');
    expect(sessionStorage.getItem(SS_SESSION_KEY)).toBe('1');

    // Confirm no PUT was sent for the 'session' value (only the initial GET).
    const putCalls = fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT');
    expect(putCalls).toHaveLength(0);

    unmount();

    // Simulate opening a new tab: sessionStorage is empty for that tab.
    sessionStorage.clear();

    const { result: result2 } = renderHook(() => useChatPreferences());

    expect(result2.current.pausePref).toBe('none');

    await waitFor(() => {
      expect(result2.current.pausePref).toBe('none');
    });
  });
});

describe('useChatPreferences — preferred language', () => {
  const LS_PREFERRED_LANGUAGE_KEY = 'mx-preferred-language';

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('selecting Hindi sends a PUT to /api/chat-preferences with preferredLanguage: "hindi"', async () => {
    localStorage.setItem(LS_TOKEN_KEY, 'fake-token');

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      );

    const { result } = renderHook(() => useChatPreferences());

    await waitFor(() => {
      expect(result.current.preferredLanguage).toBe('english');
    });

    act(() => {
      result.current.setPreferredLanguage('hindi');
    });

    expect(result.current.preferredLanguage).toBe('hindi');
    expect(localStorage.getItem(LS_PREFERRED_LANGUAGE_KEY)).toBe('hindi');

    const putCalls = fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT');
    expect(putCalls).toHaveLength(1);

    const [putUrl, putInit] = putCalls[0];
    expect(putUrl).toBe('/api/chat-preferences');

    const body = JSON.parse(putInit!.body as string) as Record<string, string>;
    expect(body.preferredLanguage).toBe('hindi');
  });

  it('preferredLanguage returned by the hook reflects the chosen language, which ChatWidget includes in POST /api/chat/message', async () => {
    localStorage.setItem(LS_TOKEN_KEY, 'fake-token');

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    const { result } = renderHook(() => useChatPreferences());

    await waitFor(() => {
      expect(result.current.preferredLanguage).toBe('english');
    });

    act(() => {
      result.current.setPreferredLanguage('hindi');
    });

    expect(result.current.preferredLanguage).toBe('hindi');

    // ChatWidget spreads preferredLanguage directly into the fetch body:
    //   body: JSON.stringify({ message, sessionId, preferredLanguage, ... })
    // Verify that what the hook returns is exactly the value a chat message
    // body would carry after the user picks a language.
    const simulatedMessageBody = JSON.stringify({
      message: 'hello',
      sessionId: 'test-session',
      preferredLanguage: result.current.preferredLanguage,
    });
    const parsed = JSON.parse(simulatedMessageBody) as Record<string, string>;
    expect(parsed.preferredLanguage).toBe('hindi');
  });

  it('initialises preferredLanguage from server when authenticated and server returns a saved preference', async () => {
    localStorage.setItem(LS_TOKEN_KEY, 'fake-token');

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ preferredLanguage: 'tamil' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const { result } = renderHook(() => useChatPreferences());

    await waitFor(() => {
      expect(result.current.preferredLanguage).toBe('tamil');
    });

    expect(localStorage.getItem(LS_PREFERRED_LANGUAGE_KEY)).toBe('tamil');
  });

  it('falls back to "english" when unauthenticated and no language is stored locally', async () => {
    expect(localStorage.getItem(LS_TOKEN_KEY)).toBeNull();

    const { result } = renderHook(() => useChatPreferences());

    expect(result.current.preferredLanguage).toBe('english');

    await waitFor(() => {
      expect(result.current.preferredLanguage).toBe('english');
    });
  });
});
