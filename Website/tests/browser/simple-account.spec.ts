import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
const password = 'Synthetic-simple-password-123';
test.beforeEach(async () => {
 const url = new URL(process.env.DATABASE_URL ?? '');
 if (!url.pathname.endsWith('_test') || !['localhost','127.0.0.1'].includes(url.hostname)) throw new Error('Local test database required.');
 const db = new PrismaClient(); try { await db.rateLimit.deleteMany(); } finally { await db.$disconnect(); }
});
test('one password opens the family after signup, reload and username sign-in on another device', async ({page,browser}) => {
 test.setTimeout(90000);
 const username = 'u_'+crypto.randomUUID().replaceAll('-','').slice(0,20), email = username+'@example.test';
 await page.goto('/sign-up'); await page.getByLabel('Your name',{exact:true}).fill('Simple Example'); await page.getByLabel('Username',{exact:true}).fill(username); await page.getByLabel('Email',{exact:true}).fill(email); await page.getByLabel('Password',{exact:true}).fill(password); await page.getByRole('button',{name:'Create account',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Hello, Simple Example.'})).toBeVisible({timeout:20000}); await expect(page.getByLabel('Vault passphrase')).toHaveCount(0);
 for (const width of [360,768,1440]) for (const palette of ['light','dark'] as const) {
  await page.setViewportSize({width,height:1000}); await page.emulateMedia({colorScheme:palette,reducedMotion:'reduce'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
  await page.screenshot({path:`/tmp/familymind-simple-account-${width}-${palette}.png`,animations:'disabled',fullPage:true});
 }

 await page.getByLabel('Family name (optional)').fill('Simple Synthetic Family'); await page.getByRole('button',{name:'Create my family',exact:true}).click(); await expect(page).toHaveURL(/dashboard$/); await expect(page.getByText('Simple Synthetic Family',{exact:true})).toBeVisible();
 await page.reload(); await expect(page.getByRole('heading',{name:'What’s on your mind?',exact:true})).toBeVisible({timeout:20000}); await expect(page.getByText('Simple Synthetic Family',{exact:true})).toBeVisible();
 const second = await browser.newContext(); const guest = await second.newPage();
 try {
  await guest.goto('/sign-in'); await guest.getByLabel('Username or email').fill(username.toUpperCase()); await guest.getByLabel('Password',{exact:true}).fill(password); await guest.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(guest).toHaveURL(/dashboard$/,{timeout:20000}); await expect(guest.getByRole('button',{name:'Create my family'})).toHaveCount(0); await expect(guest.getByText('Simple Synthetic Family',{exact:true})).toBeVisible();
  await guest.goto('/account'); await guest.getByRole('button',{name:'Sign out',exact:true}).click();
  expect(await guest.evaluate(async () => { const db = await new Promise<IDBDatabase>((resolve,reject)=>{ const request=indexedDB.open('familymind-device-access-v1');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error); }); const rows=await new Promise<unknown[]>((resolve)=>{const request=db.transaction('accounts').objectStore('accounts').getAll();request.onsuccess=()=>resolve(request.result);});db.close();return rows.length; })).toBe(0);
 } finally { await second.close(); }
});
test('username invitations appear in the account inbox and join with the selected role', async ({page,browser}) => {
 test.setTimeout(90000);
 async function signup(target: import('@playwright/test').Page, name: string) {
  const username='u_'+crypto.randomUUID().replaceAll('-','').slice(0,20);
  await target.goto('/sign-up'); await target.getByLabel('Your name',{exact:true}).fill(name); await target.getByLabel('Username',{exact:true}).fill(username); await target.getByLabel('Email',{exact:true}).fill(username+'@example.test'); await target.getByLabel('Password',{exact:true}).fill(password); await target.getByRole('button',{name:'Create account',exact:true}).click(); await expect(target.getByRole('heading',{name:'Hello, '+name+'.'})).toBeVisible({timeout:20000}); return username;
 }
 const second=await browser.newContext(), guest=await second.newPage();
 try {
  await signup(page,'Invite Owner'); await page.getByRole('button',{name:'Create my family',exact:true}).click(); await expect(page).toHaveURL(/dashboard$/);
  const username=await signup(guest,'Invite Guest'); await page.getByRole('link',{name:'Invite family',exact:true}).click();
  await page.getByLabel('Username or email').fill(username); await page.getByLabel('Family role').selectOption('VIEWER'); await page.getByRole('button',{name:'Create invitation link'}).click(); await expect(page.getByText('Invitation created. Share the link, or ask them to open Your account to join.')).toBeVisible();
  for (const width of [360,768,1440]) for (const palette of ['light','dark'] as const) {
   await page.setViewportSize({width,height:1000}); await page.emulateMedia({colorScheme:palette,reducedMotion:'reduce'});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
   await page.screenshot({path:`/tmp/familymind-simple-invite-${width}-${palette}.png`,animations:'disabled',fullPage:true});
  }

  await guest.reload(); await expect(guest.getByRole('heading',{name:'Your family invitations'})).toBeVisible(); await expect(guest.getByText(/Read-only/)).toBeVisible(); await guest.getByRole('button',{name:'Join family',exact:true}).click(); await expect(guest.getByRole('heading',{name:'You’ve joined. One last step.'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Confirm family access'})).toBeVisible({timeout:25000}); await page.getByRole('button',{name:'Confirm family access'}).click();
  await expect(guest.getByRole('button',{name:'Go to my family'})).toBeVisible({timeout:25000}); await guest.getByRole('button',{name:'Go to my family'}).click(); await expect(guest.getByRole('heading',{name:'What’s on your mind?',exact:true})).toBeVisible();
  const members=await page.request.get('/api/familymind/families/'+(await (await page.request.get('/api/familymind/families')).json())[0].id+'/members'); expect((await members.json()).find((m:{displayName:string})=>m.displayName==='Invite Guest').role).toBe('VIEWER');
 } finally { await second.close(); }
});

test('blocked device storage keeps signup usable without asking for another password', async ({page}) => {
 await page.addInitScript(() => { Object.defineProperty(window, 'indexedDB', {get(){throw new DOMException('Blocked for synthetic test','SecurityError');}}); });
 const username='u_'+crypto.randomUUID().replaceAll('-','').slice(0,20);
 await page.goto('/sign-up'); await page.getByLabel('Your name',{exact:true}).fill('No Device Storage'); await page.getByLabel('Username',{exact:true}).fill(username); await page.getByLabel('Email',{exact:true}).fill(username+'@example.test'); await page.getByLabel('Password',{exact:true}).fill(password); await page.getByRole('button',{name:'Create account',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Hello, No Device Storage.'})).toBeVisible({timeout:20000}); await expect(page.getByText('Browser storage is unavailable. Save your recovery code before leaving this page.')).toBeVisible(); await expect(page.getByLabel('Vault passphrase')).toHaveCount(0);
 await page.getByRole('button',{name:'Create my family',exact:true}).click(); await expect(page).toHaveURL(/dashboard$/); await expect(page.getByRole('heading',{name:'What’s on your mind?',exact:true})).toBeVisible();
});
