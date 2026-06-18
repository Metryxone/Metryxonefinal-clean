import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ChatSettingsPopover } from './ChatSettingsPopover';
import { useChatPreferences } from '../hooks/useChatPreferences';
import { ChatWidget } from './ChatWidget';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

// jsdom does not implement scrollIntoView — stub it out globally.
Element.prototype.scrollIntoView = vi.fn();

const makeOkResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const MOCK_CHAT_RESPONSE = {
  response: 'Hello! How can I help?',
  suggestedActions: [],
  intent: 'greeting',
  userType: 'guest',
  emotionalState: 'calm',
  sensitive: false,
  videoSuggestions: [],
  languageInstruction: 'Reply in Hindi (हिंदी).',
  preferredLanguage: 'hindi',
};

// Minimal wrapper that wires ChatSettingsPopover to the real useChatPreferences hook.
// This lets us test the settings UI → hook → PUT /api/chat-preferences flow without
// the complexity of the full ChatWidget (centered overlay, intro animations, etc.).
function PopoverWithHook() {
  const { preferredLanguage, setPreferredLanguage, pausePref, setPausePreference, responseStyle, setResponseStyle } = useChatPreferences();
  return (
    <ChatSettingsPopover
      pausePref={pausePref}
      onChangePausePref={setPausePreference}
      responseStyle={responseStyle}
      onChangeResponseStyle={setResponseStyle}
      preferredLanguage={preferredLanguage}
      onChangePreferredLanguage={setPreferredLanguage}
      onClose={() => undefined}
      testIdPrefix="test"
    />
  );
}

describe('ChatWidget — preferred language flows to API calls', () => {
  let fetchMock: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    // A token is required for useChatPreferences to persist the language via PUT.
    localStorage.setItem('metryx_token', 'fake-token-for-test');

    fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      const u = url.toString();
      if (u.includes('/api/chat/match-concerns')) {
        return Promise.resolve(makeOkResponse({ matches: [] }));
      }
      if (u.includes('/api/chat/message')) {
        return Promise.resolve(makeOkResponse(MOCK_CHAT_RESPONSE));
      }
      if (u.includes('/api/chat-preferences')) {
        return Promise.resolve(makeOkResponse({}));
      }
      return Promise.resolve(makeOkResponse({}));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('selecting Hindi in the settings popover sends PUT /api/chat-preferences with preferredLanguage: "hindi"', async () => {
    const user = userEvent.setup();

    // Render the popover wired to the real hook, starting with no preference set.
    render(<PopoverWithHook />);

    // Wait for the initial GET /api/chat-preferences to resolve before interacting.
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([url]) => url.toString().includes('/api/chat-preferences')),
      ).toBe(true);
    }, { timeout: 3000 });

    // Click the Hindi language option inside the popover.
    const hindiBtn = await screen.findByTestId('test-lang-hindi', {}, { timeout: 3000 });
    await user.click(hindiBtn);

    // Verify a PUT was sent to /api/chat-preferences with preferredLanguage: 'hindi'.
    await waitFor(() => {
      const putCalls = fetchMock.mock.calls.filter(
        ([url, init]) =>
          url.toString().includes('/api/chat-preferences') &&
          (init as RequestInit | undefined)?.method === 'PUT',
      );
      expect(putCalls).toHaveLength(1);
      const body = JSON.parse((putCalls[0][1] as RequestInit).body as string) as Record<string, string>;
      expect(body.preferredLanguage).toBe('hindi');
    }, { timeout: 3000 });
  }, 10000);

  it('ChatWidget includes preferredLanguage: "hindi" in POST /api/chat/message after language is set', async () => {
    // Pre-seed both localStorage AND the server-side GET response with 'hindi'.
    // The hook calls GET /api/chat-preferences on mount; if that returns {} the
    // hook normalises missing preferredLanguage to 'english' and overwrites the
    // localStorage value, so the mock must agree with the stored preference.
    localStorage.setItem('mx-preferred-language', 'hindi');
    fetchMock.mockImplementation((url) => {
      const u = url.toString();
      if (u.includes('/api/chat/match-concerns')) return Promise.resolve(makeOkResponse({ matches: [] }));
      if (u.includes('/api/chat/message')) return Promise.resolve(makeOkResponse(MOCK_CHAT_RESPONSE));
      if (u.includes('/api/chat-preferences')) return Promise.resolve(makeOkResponse({ preferredLanguage: 'hindi' }));
      return Promise.resolve(makeOkResponse({}));
    });

    render(<ChatWidget />);

    // The typewriter animation runs for ~155 chars × 28 ms ≈ 4.3 s before
    // the starter-card buttons appear.  Give it up to 8 s to be safe.
    const starterBtn = await screen.findByText(/How it works/i, {}, { timeout: 8000 });

    // Clicking a starter card calls sendMessage(text) directly without needing
    // the text input, which avoids controlled-input testing complexity.
    await userEvent.click(starterBtn);

    // Verify POST /api/chat/message body includes preferredLanguage: 'hindi'.
    await waitFor(() => {
      const postCalls = fetchMock.mock.calls.filter(
        ([url, init]) =>
          url.toString().includes('/api/chat/message') &&
          (init as RequestInit | undefined)?.method === 'POST',
      );
      expect(postCalls.length).toBeGreaterThanOrEqual(1);
      const body = JSON.parse((postCalls[0][1] as RequestInit).body as string) as Record<string, unknown>;
      expect(body.preferredLanguage).toBe('hindi');
    }, { timeout: 5000 });
  }, 20000);
});
