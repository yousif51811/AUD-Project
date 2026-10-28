import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';

test.beforeEach(async()=>{const url=new URL(process.env.DATABASE_URL??'');if(!url.pathname.endsWith('_test')||!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('Local isolated fixture database required.');const db=new PrismaClient();try{await db.rateLimit.deleteMany();}finally{await db.$disconnect();}});

const arabic = /Switch to Arabic/;
const english = /Switch to English/;

test('switching language preserves the current draft, task completion and appearance', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByLabel('Ask about your week', {exact:true}).fill('Unsent synthetic draft — لا تترجم هذا');
  const task = page.locator('.family-task-list input[type=checkbox]').first(); await task.check();
  const theme = await page.locator('html').getAttribute('data-theme');
  await page.getByRole('button', {name:arabic}).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar'); await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', {name:'ما الذي يشغل بالك؟'})).toBeVisible();
  await expect(page.locator('#home-assistant-input')).toHaveValue('Unsent synthetic draft — لا تترجم هذا');
  await expect(task).toBeChecked(); await expect(page.locator('html')).toHaveAttribute('data-theme', theme!);
  await page.getByRole('button', {name:english}).click();
  await expect(page.locator('html')).toHaveAttribute('dir','ltr');
  await expect(page.getByLabel('Ask about your week', {exact:true})).toHaveValue('Unsent synthetic draft — لا تترجم هذا');
  await expect(task).toBeChecked();
  await page.getByRole('button', {name:arabic}).click(); await page.reload();
  await expect(page.getByRole('heading', {name:'ما الذي يشغل بالك؟'})).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir','rtl');
});

test('Arabic sign-in can change language inside the focus trap without clearing fields', async ({page}) => {
  await page.goto('/sign-in'); const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Email', {exact:true}).fill('fictional@example.test');
  await dialog.getByRole('button', {name:arabic}).click();
  await expect(dialog).toHaveAccessibleName('أهلًا بعودتك.');
  await expect(dialog.getByLabel('البريد الإلكتروني', {exact:true})).toHaveValue('fictional@example.test');
  await expect(dialog.getByLabel('البريد الإلكتروني', {exact:true})).toHaveAttribute('dir','ltr');
  for(let i=0;i<12;i++){await page.keyboard.press('Tab');expect(await page.evaluate(()=>!!document.activeElement?.closest('[role="dialog"]'))).toBe(true);}
  await dialog.getByRole('button', {name:english}).click();
  await expect(dialog.getByLabel('Email', {exact:true})).toHaveValue('fictional@example.test');
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
});

test('public About page credits all five members and supervisor in both languages', async ({page}) => {
  await page.goto('/about');
  await expect(page.locator('.about-team-grid > li')).toHaveCount(5);
  for(const name of ['Omar','Yousif Walid','Mahmoud Hassan','Youssef Ahmed','Nizar Nassih']) await expect(page.locator('.about-team').getByRole('heading', {name,exact:true})).toBeVisible();
  await expect(page.getByText('Mr. Mohamed Mohsin',{exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'A little less to carry. A little more together.'})).toBeVisible();
  await page.getByRole('button',{name:arabic}).click();
  await expect(page.getByRole('heading',{name:'أعباء أقل. وقرب أكثر.'})).toBeVisible();
  await expect(page.getByRole('link',{name:'اقرأ عن الخصوصية',exact:true})).toHaveAttribute('href','/trust');
  await expect(page.locator('.family-footer').getByRole('link',{name:'من نحن',exact:true})).toHaveAttribute('href','/about');
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('lang','ar');
});

test('Arabic assessment choices and built-in availability work without any inference request', async ({page}) => {
  const requests:string[]=[];page.on('request',r=>{if(/groq\.com|generativelanguage\.googleapis\.com|openrouter\.ai|translate\.google|deepl/i.test(r.url()))requests.push(r.url());});
  await page.goto('/dashboard');await page.getByRole('button',{name:arabic}).click();
  await page.getByRole('button',{name:'من متفرّغ الآن؟',exact:true}).click();
  await expect(page.getByText(/فراغ التقويم لا يعني/)).toBeVisible();
  await expect(page.getByText('أدوات مدمجة · حقائق مسجّلة',{exact:true})).toBeVisible();
  await page.goto('/assessment');await expect(page.getByRole('heading',{name:'كم مرة خصّصت أسرتك وقتًا للتواصل هذا الأسبوع؟',exact:true})).toBeVisible();
  await expect(page.getByText('أربع مرات أو أكثر',{exact:true})).toBeVisible();
  expect(requests).toEqual([]);
});

test('language remains usable when persistent browser storage is blocked', async ({page}) => {
  await page.addInitScript(()=>{const get=Storage.prototype.getItem,set=Storage.prototype.setItem;Storage.prototype.getItem=function(key){if(key==='familymind:language:v1')throw new Error('Blocked');return get.call(this,key);};Storage.prototype.setItem=function(key,value){if(key==='familymind:language:v1')throw new Error('Blocked');set.call(this,key,value);};});
  await page.goto('/about');await page.getByRole('button',{name:arabic}).click();
  await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  await page.getByRole('button',{name:english}).click();await expect(page.locator('html')).toHaveAttribute('dir','ltr');
});

test('language synchronizes between open tabs', async ({page,context}) => {
  await page.goto('/about');const second=await context.newPage();await second.goto('/demo');
  await page.getByRole('button',{name:arabic}).click();
  await expect(second.locator('html')).toHaveAttribute('lang','ar');
  await expect(second.getByRole('heading',{name:'جرّب يومًا من حياتهم.'})).toBeVisible();
  await second.close();
});

const routes=['/','/about','/demo','/dashboard','/plan','/schedule','/coach','/assessment','/results','/student','/care','/memories','/trust','/sign-up','/sign-in','/account','/family','/settings','/check-ins','/notifications','/tasks','/onboarding','/tour','/missing-page'];
for(const width of [360,768,1440])for(const palette of ['light','dark'] as const)test(`Arabic ${width}px ${palette}: every screen`,async({page})=>{
  test.setTimeout(240000);await page.setViewportSize({width,height:1000});await page.emulateMedia({colorScheme:palette,reducedMotion:'reduce'});
  await page.addInitScript(()=>localStorage.setItem('familymind:language:v1','ar'));
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  for(const route of routes){await page.goto(route);await expect(page.locator('h1:visible')).toHaveCount(1);await expect(page.locator('html')).toHaveAttribute('dir','rtl');await expect(page.locator('html')).toHaveAttribute('data-theme',palette);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),route).toBe(false);const clipped=await page.locator('.family-header :is(a,button)').evaluateAll(els=>els.filter(el=>el.getClientRects().length>0).filter(el=>{const box=el.getBoundingClientRect();return box.left < -1 || box.right > innerWidth+1;}).map(el=>el.textContent));expect(clipped,route).toEqual([]);}
  expect(errors).toEqual([]);
  for(const route of ['/about','/dashboard','/sign-up']){await page.goto(route);await expect(page.locator('.family-header')).toBeVisible();await expect(page.locator('h1:visible')).toBeVisible();await page.screenshot({path:`/tmp/familymind-ar-${route.slice(1)}-${width}-${palette}.png`,fullPage:route==='/about',animations:'disabled'});}
});

test('Arabic larger text, contrast and reduced motion support the header and modal',async({page})=>{
  await page.addInitScript(()=>{localStorage.setItem('familymind:language:v1','ar');localStorage.setItem('familymind:display:v1:omar',JSON.stringify({largeText:true,highContrast:true,reduceMotion:true}));});
  for(const width of [360,768,1440]){await page.setViewportSize({width,height:1000});await page.goto('/dashboard');await expect(page.locator('html')).toHaveClass(/pref-large-text/);expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);await page.getByRole('button',{name:'أضف خطوة صغيرة',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');}
});
