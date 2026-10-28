import {PrismaClient} from '@prisma/client';
import {test,expect} from '@playwright/test';
test.beforeEach(async()=>{const url=new URL(process.env.DATABASE_URL??'');if(!url.pathname.endsWith('_test')||!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('Browser fixture tests require a local test database.');const db=new PrismaClient();try{await db.rateLimit.deleteMany();}finally{await db.$disconnect();}});
const routes=['/','/about','/onboarding','/tour','/sign-in','/settings','/demo','/dashboard','/plan','/schedule','/coach','/assessment','/results','/student','/care','/memories','/trust','/sign-up','/account','/family','/check-ins','/notifications','/tasks','/missing-page'];
for(const width of [360,768,1440])for(const palette of ['light','dark'] as const)test(`${width}px ${palette}: all screens`,async({page})=>{
 test.setTimeout(180000);await page.setViewportSize({width,height:1000});await page.emulateMedia({colorScheme:palette});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 for(const route of routes){await page.goto(route);await expect(page.locator('h1:visible')).toHaveCount(1);await expect(page.locator('h1:visible')).toBeVisible();await expect(page.locator('html')).toHaveAttribute('data-theme',palette);const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);expect(overflow,route).toBe(false);}
 expect(errors).toEqual([]);await page.goto('/dashboard');await expect(page.getByRole('heading',{name:'A little more together.'})).toBeVisible();await page.screenshot({path:`/tmp/familymind-courtyard-${width}-${palette}.png`,fullPage:width===1440,animations:'disabled'});
});
test('demo selection, exact answers, private sample check-in, and voluntary availability',async({page})=>{
 await page.goto('/demo');await page.getByRole('button',{name:/Omar/}).click();await expect(page).toHaveURL(/dashboard/);
 await page.goto('/coach');await page.getByRole('button',{name:"Who's free right now?",exact:true}).click();await expect(page.getByText(/An empty calendar does not mean/)).toBeVisible();await expect(page.getByText('Built-in tools · recorded facts')).toBeVisible();
 await page.goto('/check-ins');await page.getByLabel('A note for yourself').fill('Private synthetic reflection');await page.getByRole('button',{name:'Save check-in'}).click();await expect(page.getByText('Private synthetic reflection',{exact:true})).toBeVisible();await page.reload();await expect(page.getByText('Private synthetic reflection',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Open to talk',exact:true}).click();await page.goto('/coach');await page.getByRole('button',{name:"Who's open to talk?",exact:true}).click();await expect(page.getByText(/Omar: open to a conversation/)).toBeVisible();
 await page.goto('/demo');await page.getByRole('button',{name:/Mariam/}).click();await page.goto('/check-ins');await expect(page.getByRole('heading',{name:'A moment for yourself.'})).toBeVisible();await expect(page.getByText('Private synthetic reflection',{exact:true})).toHaveCount(0);
});
test('providers need an explicit connection and no model download is offered',async({page})=>{
 await page.goto('/coach');for(const provider of ['groq','gemini','openrouter']){await page.getByLabel('Answer with').selectOption(provider);await page.getByLabel('Ask about your week').fill('Help us make the week easier');await page.getByRole('button',{name:'Ask the assistant',exact:true}).click();await expect(page.locator('.notice[role=alert]')).toContainText('in AI settings first');await expect(page.getByRole('dialog')).toHaveCount(0);}
 await expect(page.getByText('First use downloads',{exact:false})).toHaveCount(0);await page.getByRole('button',{name:"Who's free right now?",exact:true}).click();await expect(page.getByText('Built-in tools · recorded facts')).toBeVisible();
});
test('family menu keyboard trap, theme switching and reduced motion',async({page})=>{
 await page.setViewportSize({width:360,height:900});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/dashboard');await page.getByRole('button',{name:'Open menu',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await page.keyboard.press('Tab');expect(await page.evaluate(()=>!!document.activeElement?.closest('[role="dialog"]'))).toBe(true);await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();const theme=await page.locator('html').getAttribute('data-theme');await page.getByRole('button',{name:/Switch to .* theme/}).click();await expect(page.locator('html')).toHaveAttribute('data-theme',theme==='dark'?'light':'dark');
});
test('homepage conversation works beside tasks, with no automatic model requests',async({page})=>{
 const inference:string[]=[];page.on('request',r=>{if(/api\.groq\.com|generativelanguage\.googleapis\.com|openrouter\.ai\/api|huggingface\.co|webllm/i.test(r.url()))inference.push(r.url());});
 await page.goto('/dashboard');await expect(page.getByRole('heading',{name:'What’s on your mind?',exact:true})).toBeVisible();
 await expect(page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Assistant',exact:true})).toHaveCount(0);
 await page.getByLabel('Ask about your week',{exact:true}).fill("Who's free right now?");await page.getByLabel('Ask about your week',{exact:true}).press('Enter');
 await expect(page.getByText('Built-in tools · recorded facts')).toBeVisible();await expect(page.getByText(/An empty calendar does not mean/)).toBeVisible();
 const task=page.getByRole('checkbox',{name:/Mark complete:/}).first();await task.check();await expect(task).toBeChecked();await expect(page.getByText('Built-in tools · recorded facts')).toBeVisible();
 expect(inference).toEqual([]);await page.goto('/coach');await expect(page).toHaveURL(/dashboard#assistant$/);await expect(page.locator('#assistant')).toBeFocused();
});
test('cursor scenery pauses, stays paused after reload, and respects device reduced motion',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await page.goto('/dashboard');await expect(page.getByRole('button',{name:'Pause scenery',exact:true})).toBeVisible();await page.mouse.move(20,250);
 await expect.poll(()=>page.locator('.living-backdrop').evaluate(el=>parseFloat((el as HTMLElement).style.getPropertyValue('--garden-x')))).toBeLessThan(-1);
 await page.getByRole('button',{name:'Pause scenery',exact:true}).click();await expect(page.locator('html')).toHaveClass(/pref-reduce-motion/);
 await expect(page.locator('.courtyard-plant').first()).toHaveCSS('animation-name','none');
 await expect(page.locator('.garden-wash').first()).toHaveCSS('transform','none');
 await page.reload();await expect(page.getByRole('button',{name:'Resume scenery',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Resume scenery',exact:true}).click();await page.emulateMedia({reducedMotion:'reduce'});
 await expect(page.locator('.courtyard-plant').first()).toHaveCSS('animation-name','none');
});
test('larger text and high contrast keep the homepage usable at every breakpoint',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('familymind:display:v1:omar',JSON.stringify({largeText:true,highContrast:true,reduceMotion:true})));
 for(const width of [360,768,1440]){
  await page.setViewportSize({width,height:1000});await page.goto('/dashboard');await expect(page.locator('html')).toHaveClass(/pref-large-text/);await expect(page.locator('html')).toHaveClass(/pref-high-contrast/);
  await expect(page.getByLabel('Ask about your week',{exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
  await page.getByRole('button',{name:'Add a small action',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();
 }
});
test('account registration, vault and encrypted household through the interface',async({page})=>{
 test.setTimeout(60000);await page.goto('/sign-up');await page.getByLabel('First name',{exact:true}).fill('Synthetic');await page.getByLabel('Last name',{exact:true}).fill('Browser');await page.getByLabel('Email',{exact:true}).fill(`fm-browser-${crypto.randomUUID()}@example.test`);await page.getByLabel('Password',{exact:true}).fill('Synthetic-password-123456');await page.getByRole('button',{name:'Create account',exact:true}).click();await expect(page.getByRole('heading',{name:'Create your encrypted vault'})).toBeVisible({timeout:20000});await page.getByLabel('Vault passphrase',{exact:true}).fill('A separate synthetic vault phrase');await page.getByRole('button',{name:'Create vault',exact:true}).click();await expect(page.getByText('Your vault is unlocked for this session.')).toBeVisible();await page.getByLabel('Create a household',{exact:true}).fill('Synthetic Browser Family');await page.getByRole('button',{name:'Create family',exact:true}).click();await page.getByRole('button',{name:/Open family space/}).click();await expect(page.getByRole('heading',{name:'A little more together.'})).toBeVisible();await expect(page.getByText('Synthetic Browser Family',{exact:true})).toBeVisible();const skip=page.getByRole('button',{name:'Skip walkthrough',exact:true});if(await skip.isVisible())await skip.click();await page.getByRole('link',{name:'FamilyMind home',exact:true}).first().click();await expect(page).toHaveURL(/dashboard$/);await expect(page.getByRole('heading',{name:'What’s on your mind?',exact:true})).toBeVisible();
});

test.afterAll(async()=>{const db=new PrismaClient();try{const rows=await db.user.findMany({where:{email:{startsWith:'fm-browser-',endsWith:'@example.test'}}});const ids=rows.map(u=>u.id);await db.family.deleteMany({where:{ownerId:{in:ids}}});await db.encryptionIdentity.deleteMany({where:{userId:{in:ids}}});await db.user.deleteMany({where:{id:{in:ids}}});}finally{await db.$disconnect();}});

test('two browsers join, unlock shared records and receive a remote calendar change',async({page,browser})=>{
 test.setTimeout(150000);
 const second=await browser.newContext();const guest=await second.newPage();const suffix=crypto.randomUUID();const ownerEmail=`fm-browser-owner-${suffix}@example.test`,guestEmail=`fm-browser-guest-${suffix}@example.test`;
 async function register(target:import('@playwright/test').Page,email:string,first:string,path='/sign-up'){
  await target.goto(path);await target.getByLabel('First name',{exact:true}).fill(first);await target.getByLabel('Last name',{exact:true}).fill('Test');await target.getByLabel('Email',{exact:true}).fill(email);await target.getByLabel('Password',{exact:true}).fill('Synthetic-password-123456');await target.getByRole('button',{name:'Create account',exact:true}).click();await expect(target.getByRole('heading',{name:'Create your encrypted vault'})).toBeVisible({timeout:20000});await target.getByLabel('Vault passphrase',{exact:true}).fill('Separate synthetic vault phrase');await target.getByRole('button',{name:'Create vault',exact:true}).click();await expect(target.getByText('Your vault is unlocked for this session.')).toBeVisible();
 }
 try{
  await register(page,ownerEmail,'Owner');await page.getByLabel('Create a household',{exact:true}).fill('Remote Synthetic Family');await page.getByRole('button',{name:'Create family',exact:true}).click();await page.getByRole('button',{name:/Open family space/}).click();await expect(page.getByRole('heading',{name:'A little more together.'})).toBeVisible();
  const skip=page.getByRole('button',{name:'Skip walkthrough'});if(await skip.isVisible())await skip.click();
  await page.getByRole('button',{name:'Family & more',exact:true}).click();await page.getByRole('link',{name:/People & privacy/}).click();await page.getByLabel('Their email',{exact:true}).fill(guestEmail);await page.getByRole('button',{name:'Create invitation link',exact:true}).click();const link=await page.getByLabel(/Share this link privately/).inputValue();
  await register(guest,guestEmail,'Guest',link);await guest.getByRole('button',{name:'Accept family invitation',exact:true}).click();await expect(guest.getByText(/Invitation accepted/)).toBeVisible();
  await expect(page.getByRole('button',{name:'Approve encrypted access',exact:true})).toBeVisible({timeout:25000});await page.getByRole('button',{name:'Approve encrypted access',exact:true}).click();
  await expect(guest.getByRole('button',{name:/Open family space/})).toBeEnabled({timeout:25000});await guest.getByRole('button',{name:/Open family space/}).click();await expect(guest.getByText('Remote Synthetic Family',{exact:true})).toBeVisible({timeout:15000});
  await page.getByRole('link',{name:'Calendar',exact:true}).first().click();await page.getByRole('button',{name:'Add event',exact:true}).click();await page.getByLabel('Title',{exact:true}).fill('Remote shared synthetic event');await page.getByRole('checkbox',{name:/Owner Test/}).check();await page.getByRole('button',{name:'Add to schedule',exact:true}).click();
  await guest.getByRole('link',{name:'Calendar',exact:true}).first().click();await expect(guest.getByText('Remote shared synthetic event',{exact:true})).toBeVisible({timeout:25000});
 }finally{await second.close();}
});
