import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

test.beforeEach(async () => {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (!url.pathname.endsWith('_test') || !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Local isolated fixture database required.');
  const db = new PrismaClient(); try { await db.rateLimit.deleteMany(); } finally { await db.$disconnect(); }
});

test('an existing account signs in through the modal and continues to vault unlock', async ({ page }) => {
  const email = `fm-dialog-${crypto.randomUUID()}@example.test`, password = 'Synthetic-modal-password-123456';
  const origin = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:3002';
  const created = await page.request.post('/api/auth/sign-up/email', { headers: { Origin: origin }, data: { name: 'Synthetic modal account', email, password, ageGroup: 'adult' } }); expect(created.ok()).toBe(true);
  const db = new PrismaClient();
  try {
    expect((await page.request.post('/api/auth/sign-out', { headers: { Origin: origin }, data: {} })).ok()).toBe(true);
    await page.goto('/'); await page.getByRole('link', { name: 'Sign in', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Email', { exact: true }).fill(email); await dialog.getByLabel('Password', { exact: true }).fill(password);
    await dialog.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/account$/); await expect(page.getByRole('heading', { name: 'Create your encrypted vault', exact: true })).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('dialog')).toHaveCount(0);
  } finally { await db.user.deleteMany({ where: { email } }); await db.$disconnect(); }
});

test('sign-in overlays the current planner, traps focus and preserves an unsent draft on close', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByLabel('Ask about your week').fill('Keep this unsent synthetic draft');
  const entry = page.getByRole('link', { name: 'Sign in', exact: true });
  await entry.click();
  const dialog = page.getByRole('dialog', { name: 'Welcome back.', exact: true });
  await expect(dialog).toBeVisible(); await expect(page).toHaveURL(/sign-in$/);
  await expect(dialog.getByLabel('Email', { exact: true })).toBeFocused();
  expect(await page.locator('#main').evaluate(el => !!el.closest('[inert]'))).toBe(true);
  for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true); }
  await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible(); await expect(page).toHaveURL(/dashboard$/);
  await expect(entry).toBeFocused(); await expect(page.getByLabel('Ask about your week')).toHaveValue('Keep this unsent synthetic draft');
});

test('direct auth links support keyboard mode switching, password visibility and safe login errors', async ({ page }) => {
  await page.route('**/api/auth/sign-in/email', route => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'private provider detail' }) }));
  await page.goto('/sign-in');
  const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
  await page.screenshot({ path: '/tmp/familymind-sign-in-preview.png', animations: 'disabled' });
  await dialog.getByRole('tab', { name: 'Sign in', exact: true }).focus();
  await page.keyboard.press('ArrowRight'); await expect(page).toHaveURL(/sign-up$/);
  await expect(dialog.getByRole('tab', { name: 'Create account', exact: true })).toBeFocused();
  await expect(dialog.getByLabel('First name', { exact: true })).toBeVisible();
  await page.keyboard.press('ArrowLeft'); await expect(page).toHaveURL(/sign-in$/);
  await expect(dialog.getByRole('tab', { name: 'Sign in', exact: true })).toBeFocused();
  await expect(dialog.getByLabel('First name', { exact: true })).toHaveCount(0);
  await dialog.getByLabel('Email', { exact: true }).fill('synthetic@example.test');
  await dialog.getByLabel('Password', { exact: true }).fill('Synthetic-password-123456');
  await dialog.getByRole('button', { name: 'Show password', exact: true }).click(); await expect(dialog.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
  await dialog.getByRole('button', { name: 'Hide password', exact: true }).click();
  await dialog.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Check your email and password'); await expect(dialog.getByRole('alert')).not.toContainText('private provider detail');
  await dialog.getByRole('button', { name: 'Close dialog' }).click(); await expect(page).toHaveURL(/\/$/);
});

test('sign-in from the phone family menu returns focus to its persistent menu button', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 }); await page.goto('/dashboard');
  const menu = page.getByRole('button', { name: 'Open menu', exact: true }); await menu.click();
  await page.getByRole('link', { name: /Sign in to your family/ }).click();
  await expect(page.getByRole('dialog', { name: 'Welcome back.', exact: true })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(menu).toBeFocused();
});

for (const width of [360, 768, 1440]) for (const palette of ['light', 'dark'] as const) test(`auth dialog at ${width}px in ${palette}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 }); await page.emulateMedia({ colorScheme: palette, reducedMotion: 'reduce' });
  await page.goto('/sign-up'); const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Create account', exact: true })).toBeVisible();
  expect(await dialog.evaluate(el => el.scrollWidth > el.clientWidth + 1)).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  await page.screenshot({ path: `/tmp/familymind-auth-${width}-${palette}.png`, animations: 'disabled' });
  await page.keyboard.press('Escape'); await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'What’s on your mind?', exact: true })).toBeVisible();
  await page.screenshot({ path: `/tmp/familymind-atelier-${width}-${palette}.png`, fullPage: width === 1440, animations: 'disabled' });
});

test('content cards stay still on hover and auth respects reduced motion and larger text', async ({ page }) => {
  await page.goto('/dashboard'); const card = page.locator('.daily-paper').first();
  await card.scrollIntoViewIfNeeded();
  const before = await card.boundingBox(); await card.hover();
  await expect(card).toHaveCSS('translate', 'none'); await expect(card).toHaveCSS('transform', 'none');
  const after = await card.boundingBox(); expect(after?.y).toBe(before?.y);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('link', { name: 'Sign in', exact: true }).click(); await expect(page.locator('.auth-modal')).toHaveCSS('animation-name', 'none');
  await page.keyboard.press('Escape');
  await page.addInitScript(() => localStorage.setItem('familymind:display:v1:omar', JSON.stringify({ largeText: true, highContrast: true, reduceMotion: true })));
  await page.setViewportSize({ width: 360, height: 800 }); await page.goto('/sign-up');
  await expect(page.locator('html')).toHaveClass(/pref-large-text/);
  const dialog = page.getByRole('dialog'); await dialog.getByRole('button', { name: 'Create account', exact: true }).scrollIntoViewIfNeeded();
  expect(await dialog.evaluate(el => el.scrollWidth > el.clientWidth + 1)).toBe(false);
  await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible();
});
