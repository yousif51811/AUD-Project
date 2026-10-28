import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

test.beforeEach(async()=>{const url=new URL(process.env.DATABASE_URL??'');if(!url.pathname.endsWith('_test')||!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('Local fixture database required.');const db=new PrismaClient();try{await db.rateLimit.deleteMany();}finally{await db.$disconnect();}});

test('unconfigured Google remains optional and email sign-in remains usable',async({page})=>{
  await page.route('**/api/auth-options',route=>route.fulfill({json:{google:false}}));
  await page.goto('/sign-in');const dialog=page.getByRole('dialog');
  await expect(dialog.getByRole('button',{name:'Continue with Google',exact:true})).toBeDisabled();
  await expect(dialog.getByText('Google sign-in is not enabled on this site yet. You can use email below.',{exact:true})).toBeVisible();
  await dialog.getByLabel('Email',{exact:true}).fill('synthetic@example.test');await expect(dialog.getByRole('button',{name:'Sign in',exact:true})).toBeEnabled();
});

test('Google signup carries age and relationship with fixed account callbacks',async({page})=>{
  await page.route('**/api/auth-options',route=>route.fulfill({json:{google:true}}));
  let body:Record<string,unknown>|undefined;
  await page.route('**/api/auth/sign-in/social',async route=>{body=route.request().postDataJSON();await route.fulfill({status:403,json:{code:'GOOGLE_INVITATION_REQUIRED',message:'DO NOT DISPLAY raw-provider-secret'}});});
  await page.goto('/sign-up');const dialog=page.getByRole('dialog');
  await dialog.getByRole('combobox',{name:'Age group',exact:true}).selectOption('teen');await dialog.getByLabel('Relationship (optional)',{exact:true}).fill('Sibling');
  await dialog.getByRole('button',{name:'Continue with Google',exact:true}).click();
  await expect(dialog.getByRole('alert')).toContainText('current adult invitation');
  expect(body).toMatchObject({provider:'google',requestSignUp:true,callbackURL:'/account',newUserCallbackURL:'/account',errorCallbackURL:'/sign-up?google=error',additionalData:{ageGroup:'teen',relationship:'Sibling'}});
  await expect(dialog).not.toContainText('raw-provider-secret');await expect(dialog.getByRole('button',{name:'Create account',exact:true})).toBeEnabled();
});

test('an invited Google signup returns to its invitation after authentication',async({page})=>{
  await page.route('**/api/auth-options',route=>route.fulfill({json:{google:true}}));const token='synthetic-invitation-token-123456';let body:Record<string,unknown>|undefined;
  await page.route('**/api/auth/sign-in/social',async route=>{body=route.request().postDataJSON();await route.fulfill({status:403,json:{code:'GOOGLE_INVITATION_MISMATCH',message:'hidden detail'}});});
  await page.goto('/invitations/'+token);await page.getByRole('combobox',{name:'Age group',exact:true}).selectOption('child');await page.getByRole('button',{name:'Continue with Google',exact:true}).click();
  await expect(page.locator('.google-auth').getByRole('alert')).toContainText('Google email named in your invitation');expect(body).toMatchObject({callbackURL:'/invitations/'+token,newUserCallbackURL:'/invitations/'+token,additionalData:{ageGroup:'child',invitationToken:token}});
});

test('Google sign-in starts a redirect without reading email/password form values',async({page})=>{
  await page.route('**/api/auth-options',route=>route.fulfill({json:{google:true}}));let body:Record<string,unknown>|undefined;
  await page.route('**/api/auth/sign-in/social',async route=>{body=route.request().postDataJSON();await route.fulfill({json:{url:'https://accounts.google.com/o/oauth2/v2/auth?synthetic=1',redirect:true}});});
  await page.route('https://accounts.google.com/**',route=>route.fulfill({contentType:'text/html',body:'<h1>Synthetic Google redirect</h1>'}));
  await page.goto('/sign-in');await page.getByRole('button',{name:'Continue with Google',exact:true}).click();await expect(page.getByRole('heading',{name:'Synthetic Google redirect'})).toBeVisible();
  expect(body).toMatchObject({provider:'google',requestSignUp:false,callbackURL:'/account'});expect(body).not.toHaveProperty('password');expect(body).not.toHaveProperty('additionalData');
});

test('cancelled and untrusted OAuth error callbacks show fixed localized guidance',async({page})=>{
  await page.route('**/api/auth-options',route=>route.fulfill({json:{google:true}}));
  await page.goto('/sign-in?google=error&error=access_denied&error_description=DO_NOT_DISPLAY');await expect(page.getByRole('dialog').getByRole('alert')).toContainText('cancelled');await expect(page.getByRole('dialog')).not.toContainText('DO_NOT_DISPLAY');
  await page.getByRole('dialog').getByRole('button',{name:/Switch to Arabic/}).click();await expect(page.getByRole('dialog').getByRole('alert')).toContainText('أُلغي');
  await page.goto('/sign-in?google=error&error=arbitrary-secret-code&error_description=hidden');await expect(page.getByRole('dialog').getByRole('alert')).not.toContainText('arbitrary-secret-code');
});

test('signed-in email members can explicitly link Google with their current account',async({page})=>{
  const origin=process.env.TEST_BASE_URL??'http://127.0.0.1:3002',email=`fm-google-ui-${crypto.randomUUID()}@example.test`;
  const created=await page.request.post('/api/auth/sign-up/email',{headers:{Origin:origin},data:{name:'Synthetic Google linking',email,password:'Synthetic-linking-password-123456',ageGroup:'adult'}});expect(created.ok()).toBe(true);
  const db=new PrismaClient();
  try{
    await page.route('**/api/auth-options',route=>route.fulfill({json:{google:true}}));await page.route('**/api/auth/list-accounts',route=>route.fulfill({json:[{providerId:'credential'}]}));let body:Record<string,unknown>|undefined;
    await page.route('**/api/auth/link-social',async route=>{body=route.request().postDataJSON();await route.fulfill({status:400,json:{code:'account_not_linked',message:'raw-provider-detail'}});});
    await page.goto('/account');await page.getByRole('button',{name:'Link Google to this account',exact:true}).click();await expect(page.locator('.google-account').getByRole('alert')).toContainText('Sign in with email');expect(body).toMatchObject({provider:'google',callbackURL:'/account',errorCallbackURL:'/account?google=error'});
  }finally{await db.user.deleteMany({where:{email}});await db.$disconnect();}
});

for(const width of [360,768,1440])for(const palette of ['light','dark'] as const)test(`configured Google signup at ${width}px in ${palette}, both languages`,async({page})=>{
  await page.setViewportSize({width,height:1000});await page.emulateMedia({colorScheme:palette,reducedMotion:'reduce'});await page.route('**/api/auth-options',route=>route.fulfill({json:{google:true}}));
  for(const language of ['en','ar']){
    await page.goto('/sign-up');const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
    if(language==='ar')await dialog.getByRole('button',{name:/Switch to Arabic/}).click();
    await expect(dialog.getByRole('button',{name:language==='ar'?'المتابعة باستخدام Google':'Continue with Google',exact:true})).toBeEnabled();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
    const box=await dialog.boundingBox();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width+1);
    await dialog.getByLabel(language==='ar'?'الاسم الأول':'First name',{exact:true}).fill('Synthetic');
    await page.screenshot({path:`/tmp/familymind-google-${language}-${width}-${palette}.png`,animations:'disabled'});
  }
});
