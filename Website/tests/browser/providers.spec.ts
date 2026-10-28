import { PrismaClient } from '@prisma/client';
import { test, expect, type Page } from '@playwright/test';
const providers = [ ['groq', 'Groq'], ['gemini', 'Gemini'], ['openrouter', 'OpenRouter'] ] as const;
const external = /^https:\/\/(api\.groq\.com|generativelanguage\.googleapis\.com|openrouter\.ai)\//;
const key = (id: string) => 'synthetic-browser-key-' + id;
const answer = (actions: unknown[] = []) => JSON.stringify({ answer: 'A synthetic suggestion for a calmer afternoon.', sources: [], actions });
interface Call { url: string; headers: Record<string, string>; body: string; test: boolean; }
async function mockProviders(page: Page, options: { status?: number; invalid?: boolean; action?: boolean } = {}) {
  const calls: Call[] = [], backend: string[] = [];
  page.on('request', r => { const url = new URL(r.url()); if (['127.0.0.1','localhost'].includes(url.hostname) && url.pathname.startsWith('/api/')) backend.push(r.url() + (r.postData() ?? '')); });
  await page.route(external, async route => {
    const req = route.request(); const body = req.postData() ?? ''; const testing = body.includes('Return the connection test JSON.');
    calls.push({ url: req.url(), headers: req.headers(), body, test: testing });
    const actions = options.action && !testing ? [{ title: 'Five-minute family pause', reason: 'A small shared break.', day: 1, minutes: 5, participantIds: ['omar'], category: 'connection' }] : [];
    const content = testing ? JSON.stringify({ answer: 'Connected.', sources: [], actions: [] }) : options.invalid ? 'not a valid suggestion' : answer(actions);
    const data = req.url().includes('googleapis') ? { candidates: [{ content: { parts: [{ text: content }] }, finishReason: 'STOP' }] } : { choices: [{ message: { content }, finish_reason: 'stop' }] };
    await route.fulfill({ status: testing ? 200 : options.status ?? 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(data) });
  });
  return { calls, backend };
}
async function connect(page: Page, id: string, name: string, remember = false) {
  await page.getByRole('group', { name: 'Choose an AI provider' }).getByRole('button', { name: new RegExp('^' + name) }).click();
  await page.getByLabel(name + ' API key', { exact: true }).fill(key(id));
  if (remember) await page.getByRole('checkbox', { name: /Remember on this browser/ }).check();
  await page.getByRole('button', { name: 'Test & connect', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: name + ' is connected.' })).toBeVisible();
}
test.beforeEach(async () => {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (!url.pathname.endsWith('_test') || !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Local isolated test database required.');
  const db = new PrismaClient(); try { await db.rateLimit.deleteMany(); } finally { await db.$disconnect(); }
});

test('all three provider setup flows work without WebGPU, preview each request and never send keys to the backend', async ({ page }) => {
  test.setTimeout(120000);
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true }));
  const { calls, backend } = await mockProviders(page);
  for (const [id, name] of providers) {
    if (id === 'groq') await page.goto('/settings#ai-settings'); else await page.getByRole('link', { name: 'AI settings', exact: true }).click(); await expect(page.locator('#ai-settings')).toBeFocused();
    await connect(page, id, name);
    expect(calls.at(-1)?.test).toBe(true); expect(calls.at(-1)?.body).not.toContain('Al Noor');
    // Use client navigation: demo credentials intentionally do not survive a reload.
    await page.getByRole('link', { name: 'Go to your assistant', exact: true }).click();
    await page.getByLabel('Ask about your week').fill('Help us plan a calmer afternoon.'); await page.getByRole('button', { name: 'Ask the assistant', exact: true }).click();
    const before = calls.length; await expect(page.getByRole('dialog')).toContainText(name);
    await page.getByRole('button', { name: 'Close dialog', exact: true }).click(); expect(calls).toHaveLength(before);
    await page.getByLabel('Ask about your week').fill('Help us plan a calmer afternoon.'); await page.getByRole('button', { name: 'Ask the assistant', exact: true }).click();
    await page.getByRole('button', { name: 'Send this request to ' + name, exact: true }).click();
    await expect(page.getByText('Cloud AI · ' + name, { exact: true })).toBeVisible(); expect(calls).toHaveLength(before + 1);
    expect(calls.at(-1)?.test).toBe(false);
    const storage = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })); expect(storage).not.toContain(key(id));
    expect(backend.join('\n')).not.toContain(key(id)); expect(backend.join('\n')).not.toContain('Help us plan a calmer afternoon.');
    expect(calls.at(-1)?.url).not.toContain(key(id)); expect(calls.at(-1)?.body).not.toContain(key(id));
  }
  expect(calls).toHaveLength(6);
  await page.goto('/dashboard'); await expect(page.getByLabel('Answer with')).toContainText('Groq · connect');
});

test('provider proposals require confirmation and a quota failure never switches providers', async ({ page }) => {
  test.setTimeout(60000); const mocked = await mockProviders(page, { action: true });
  await page.goto('/settings'); await connect(page, 'groq', 'Groq'); await page.getByRole('link', { name: 'Go to your assistant', exact: true }).click();
  await page.getByLabel('Ask about your week').fill('Help us plan a calmer afternoon.'); await page.getByRole('button', { name: 'Ask the assistant', exact: true }).click(); await page.getByRole('button', { name: 'Send this request to Groq', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Confirm these actions', exact: true })).toBeVisible(); await expect(page.locator('.family-task-list').getByText('Five-minute family pause')).toHaveCount(0);
  await page.getByRole('button', { name: 'Confirm these actions', exact: true }).click(); await expect(page.locator('.family-task-list').getByText('Five-minute family pause')).toBeVisible();
  await page.unroute(external); await page.route(external, async route => { mocked.calls.push({ url: route.request().url(), headers: {}, body: '', test: false }); await route.fulfill({ status: 429, headers: { 'Access-Control-Allow-Origin': '*' }, body: '{}' }); });
  await page.getByLabel('Ask about your week').fill('Another small idea please.'); await page.getByRole('button', { name: 'Ask the assistant', exact: true }).click(); await page.getByRole('button', { name: 'Send this request to Groq', exact: true }).click();
  await expect(page.locator('.home-assistant .notice[role=alert]')).toContainText('quota'); expect(mocked.calls).toHaveLength(3); expect(mocked.calls.every(c => c.url.startsWith('https://api.groq.com/'))).toBe(true);
});

test('invalid provider output makes no partial change and demo perspective/reset clears credentials', async ({ page }) => {
  const { calls } = await mockProviders(page, { invalid: true });
  await page.goto('/settings'); await connect(page, 'groq', 'Groq'); await page.getByRole('link', { name: 'Go to your assistant', exact: true }).click();
  const tasks = await page.locator('.family-task-list').innerText();
  await page.getByLabel('Ask about your week').fill('Help us plan a calmer afternoon.'); await page.getByRole('button', { name: 'Ask the assistant', exact: true }).click(); await page.getByRole('button', { name: 'Send this request to Groq', exact: true }).click();
  await expect(page.locator('.home-assistant .notice[role=alert]')).toBeVisible(); expect(await page.locator('.family-task-list').innerText()).toBe(tasks);
  await page.getByRole('button', { name: 'Family & more', exact: true }).click(); await page.getByRole('link', { name: /Meet the sample family/ }).click(); await page.getByRole('button', { name: /Mariam/ }).click();
  await expect(page.getByLabel('Answer with')).toContainText('Groq · connect'); expect(calls).toHaveLength(2);
  await page.getByRole('link', { name: 'Connect AI', exact: true }).click(); await connect(page, 'groq', 'Groq');
  await page.getByRole('button', { name: 'Family & more', exact: true }).click(); await page.getByRole('link', { name: /Meet the sample family/ }).click(); await page.getByRole('button', { name: 'Reset sample family', exact: true }).click(); await page.getByRole('button', { name: /Mariam/ }).click();
  await expect(page.getByLabel('Answer with')).toContainText('Groq · connect'); expect(calls).toHaveLength(3);
});

for (const width of [360, 768, 1440]) for (const palette of ['light', 'dark'] as const) test(`provider setup at ${width}px in ${palette}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 }); await page.emulateMedia({ colorScheme: palette, reducedMotion: 'reduce' }); await page.goto('/settings#ai-settings');
  for (const [, name] of providers) {
    await page.getByRole('group', { name: 'Choose an AI provider' }).getByRole('button', { name: new RegExp('^' + name) }).click(); await expect(page.getByLabel(name + ' API key', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  }
  await page.screenshot({ path: `/tmp/familymind-providers-${width}-${palette}.png`, animations: 'disabled' });
});

test('remembered credentials stay encrypted locally and unlock without uploading a credential record', async ({ page }) => {
  test.setTimeout(120000); const { backend } = await mockProviders(page);
  await page.goto('/sign-up'); await page.getByLabel('First name', { exact: true }).fill('Synthetic'); await page.getByLabel('Last name', { exact: true }).fill('AI'); await page.getByLabel('Email', { exact: true }).fill(`fm-ai-browser-${crypto.randomUUID()}@example.test`); await page.getByLabel('Password', { exact: true }).fill('Synthetic-password-123456'); await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Create your encrypted vault' })).toBeVisible({ timeout: 20000 }); await page.getByLabel('Vault passphrase', { exact: true }).fill('Separate synthetic AI vault phrase'); await page.getByRole('button', { name: 'Create vault', exact: true }).click(); await expect(page.getByText('Your vault is unlocked for this session.')).toBeVisible();
  await page.getByLabel('Create a household', { exact: true }).fill('Synthetic AI Family'); await page.getByRole('button', { name: 'Create family', exact: true }).click(); await page.getByRole('button', { name: /Open family space/ }).click(); await expect(page.getByRole('heading', { name: 'What’s on your mind?', exact: true })).toBeVisible();
  const skip = page.getByRole('button', { name: 'Skip walkthrough' }); if (await skip.isVisible()) await skip.click();
  await page.getByRole('link', { name: 'Connect AI', exact: true }).click(); await connect(page, 'groq', 'Groq', true);
  const saved = await page.evaluate(() => Object.entries(localStorage).filter(([id]) => id.startsWith('familymind:ai-device:'))); expect(saved).toHaveLength(1); expect(JSON.stringify(saved)).not.toContain(key('groq')); expect(JSON.parse(saved[0][1])).toHaveProperty('ciphertext');
  expect(backend.join('\n')).not.toContain(key('groq')); expect(backend.join('\n')).not.toContain('"kind":"cloud"');
  await page.reload(); await page.getByRole('link', { name: 'Continue to your account', exact: true }).click(); await page.getByLabel('Vault passphrase', { exact: true }).fill('Separate synthetic AI vault phrase'); await page.getByRole('button', { name: 'Unlock', exact: true }).click(); await page.getByRole('button', { name: /Open family space/ }).click(); await expect(page.getByLabel('Answer with')).toContainText('Groq · connected'); await expect(page.getByLabel('Answer with')).toHaveValue('server'); await page.getByLabel('Answer with').selectOption('groq');
  await page.getByRole('link', { name: 'AI settings', exact: true }).click(); await page.getByRole('button', { name: 'Disconnect', exact: true }).click(); await expect(page.getByRole('status').filter({ hasText: 'Groq disconnected' })).toBeVisible();
  expect(await page.evaluate(() => Object.keys(localStorage).filter(id => id.startsWith('familymind:ai-device:')))).toEqual([]);
  await page.evaluate(() => { const write = Storage.prototype.setItem; Storage.prototype.setItem = function(id, value) { if (id.startsWith('familymind:ai-device:')) throw new DOMException('Storage blocked', 'SecurityError'); return write.call(this, id, value); }; });
  await connect(page, 'groq', 'Groq', true); await expect(page.getByRole('status').filter({hasText:'browser storage could not be updated'})).toBeVisible();
  expect(await page.evaluate(() => JSON.stringify({...localStorage}))).not.toContain(key('groq')); expect(backend.join('\n')).not.toContain(key('groq'));
  await page.getByRole('button', { name: 'Sign out and lock vault', exact: true }).click(); await page.goto('/dashboard'); await expect(page.getByLabel('Answer with')).toContainText('Groq · connect');
});

test('Gemini explains an unavailable legacy model and reconnects with the suggested model', async ({ page }) => {
  const calls: string[] = [];
  await page.route(external, async route => {
    const req = route.request(); calls.push(req.url());
    const legacy = req.url().includes('gemini-2.5-flash-lite');
    expect(req.headers()['x-goog-api-key']).toBe('AQ.synthetic-test-only-not-a-real-key');
    expect(req.headers()).not.toHaveProperty('authorization');
    await route.fulfill({ status: legacy ? 404 : 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(legacy ? { error: { message: 'SENSITIVE provider echo' } } : { candidates: [{ content: { parts: [{ text: JSON.stringify({ answer: 'Connected.', sources: [], actions: [] }) }] }, finishReason: 'STOP' }] }) });
  });
  await page.goto('/settings#ai-settings');
  await page.getByRole('group', { name: 'Choose an AI provider' }).getByRole('button', { name: /^Gemini/ }).click();
  await page.getByLabel('Gemini API key', { exact: true }).fill('AQ.synthetic-test-only-not-a-real-key');
  await page.getByText('Choose another model', { exact: true }).click();
  await expect(page.getByLabel('Model ID', { exact: true })).toHaveValue('gemini-3.5-flash-lite');
  await page.getByLabel('Model ID', { exact: true }).fill('gemini-2.5-flash-lite');
  await page.getByRole('button', { name: 'Test & connect', exact: true }).click();
  await expect(page.locator('#ai-settings').getByRole('alert')).toContainText('HTTP 404'); await expect(page.locator('#ai-settings').getByRole('alert')).toContainText('previous users'); await expect(page.locator('#ai-settings').getByRole('alert')).not.toContainText('SENSITIVE');
  await page.getByRole('button', { name: 'Use the suggested model', exact: true }).click();
  await page.getByRole('button', { name: 'Test & connect', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Gemini is connected.' })).toBeVisible();
  expect(calls).toHaveLength(2); expect(calls[1]).toContain('gemini-3.5-flash-lite:generateContent');
});

test.afterAll(async () => {
  const db = new PrismaClient(); try { const users = await db.user.findMany({ where: { email: { startsWith: 'fm-ai-browser-', endsWith: '@example.test' } } }); const ids = users.map(u => u.id); await db.family.deleteMany({ where: { ownerId: { in: ids } } }); await db.encryptionIdentity.deleteMany({ where: { userId: { in: ids } } }); await db.user.deleteMany({ where: { id: { in: ids } } }); } finally { await db.$disconnect(); }
});
