import { test, expect } from '@playwright/test';

const MOCK_CHAT_RESPONSE = {
  response: 'नमस्ते! मैं आपकी कैसे सहायता कर सकती हूँ?',
  suggestedActions: [],
  intent: 'greeting',
  userType: 'guest',
  emotionalState: 'calm',
  sensitive: false,
  videoSuggestions: [],
  languageInstruction: 'Reply in Hindi (हिंदी).',
  preferredLanguage: 'hindi',
};

async function setupAndNavigate(page: import('@playwright/test').Page) {
  // context.addInitScript only persists when the auth check succeeds (mocked below).
  // Setting the token here ensures useChatPreferences will issue PUT on pref changes.
  await page.context().addInitScript(() => {
    localStorage.setItem('metryx_token', 'fake-e2e-token');
  });

  // Mock auth/me so the token persists across the page load and the app treats
  // the session as authenticated.  dashboardTarget: null prevents unwanted
  // screen navigation so we stay on the landing/ChatWidget view.
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: { name: 'E2E Tester', dashboardTarget: null } }),
    });
  });

  await page.route('**/api/auth/social/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ authenticated: false }),
    });
  });

  await page.route('**/api/chat-preferences', async (route) => {
    const method = route.request().method();
    if (method === 'GET' || method === 'PUT') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    } else {
      await route.continue();
    }
  });

  await page.route('**/api/chat/match-concerns', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ matches: [] }),
    });
  });

  await page.route('**/api/chat/message', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_CHAT_RESPONSE),
    });
  });

  // Navigate to the root (landing).  Once auth/me resolves the app sets
  // isMainAppLoggedIn=true which collapses ChatModal → ChatWidget is shown.
  await page.goto('/');
}

test.describe('Language picker — end-to-end API call assertions', () => {
  test('selecting Hindi in ChatWidget sends PUT /api/chat-preferences with preferredLanguage: "hindi"', async ({ page }) => {
    const putBodyPromise = new Promise<Record<string, string>>((resolve) => {
      page.on('request', (req) => {
        if (req.url().includes('/api/chat-preferences') && req.method() === 'PUT') {
          resolve(req.postDataJSON() as Record<string, string>);
        }
      });
    });

    await setupAndNavigate(page);

    const settingsBtn = page.getByTestId('btn-chat-settings');
    await settingsBtn.waitFor({ state: 'visible', timeout: 15_000 });
    await settingsBtn.click();

    const hindiBtn = page.getByTestId('chat-settings-lang-hindi');
    await hindiBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await hindiBtn.click();

    const putBody = await putBodyPromise;
    expect(putBody.preferredLanguage).toBe('hindi');
  });

  test('POST /api/chat/message carries preferredLanguage: "hindi" after selecting Hindi in ChatWidget', async ({ page }) => {
    const postBodyPromise = new Promise<Record<string, unknown>>((resolve) => {
      page.on('request', (req) => {
        if (req.url().includes('/api/chat/message') && req.method() === 'POST') {
          resolve(req.postDataJSON() as Record<string, unknown>);
        }
      });
    });

    await setupAndNavigate(page);

    const settingsBtn = page.getByTestId('btn-chat-settings');
    await settingsBtn.waitFor({ state: 'visible', timeout: 15_000 });
    await settingsBtn.click();

    const hindiBtn = page.getByTestId('chat-settings-lang-hindi');
    await hindiBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await hindiBtn.click();

    await page.keyboard.press('Escape');

    const chatInput = page.getByTestId('input-chat-message');
    await chatInput.waitFor({ state: 'visible', timeout: 10_000 });
    await chatInput.fill('Hello, please help me');

    const sendBtn = page.getByTestId('btn-send-message');
    await sendBtn.click();

    const postBody = await postBodyPromise;
    expect(postBody.preferredLanguage).toBe('hindi');
  });
});
