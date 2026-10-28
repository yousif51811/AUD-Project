import {expect,test,type Page} from '@playwright/test';
const response={answer:'A synthetic shared suggestion.',sources:['sample-profile'],actions:[{title:'A five-minute shared pause',reason:'Make a little room to connect.',day:1,minutes:5,participantIds:['omar'],category:'connection'}]};
async function configured(page:Page){await page.route('**/api/ai/config',route=>route.fulfill({json:{available:true,model:'gemini-3.5-flash-lite'}}));}
async function ask(page:Page,question='Help us make the afternoon calmer'){
 await page.getByLabel('Ask about your week',{exact:true}).fill(question);await page.getByRole('button',{name:'Ask the assistant',exact:true}).click();
}
test('shared Gemini sends directly with policy links and requires action confirmation',async({page})=>{
 await configured(page);const calls:Record<string,unknown>[]=[];await page.route('**/api/ai/answer',route=>{calls.push(route.request().postDataJSON());return route.fulfill({json:response});});
 await page.goto('/dashboard');await expect(page.getByLabel('Answer with')).toHaveValue('server');await expect(page.getByLabel('Answer with')).toContainText('Server-side · Gemini · available');expect(calls).toHaveLength(0);
 await expect(page.locator('#assistant-policy')).toContainText('through FamilyMind’s backend to Google');
 await expect(page.locator('#assistant-policy').getByRole('link',{name:'Google Gemini Terms of Service'})).toHaveAttribute('href','https://ai.google.dev/gemini-api/terms');
 await expect(page.locator('#assistant-policy').getByRole('link',{name:'Privacy Policy'})).toHaveAttribute('href','https://policies.google.com/privacy');
 await page.getByLabel('Ask about your week').fill('Help us make the afternoon calmer');expect(calls).toHaveLength(0);
 await page.getByLabel('Ask about your week').press('Enter');await expect(page.getByText(response.answer,{exact:true})).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(0);
 expect(calls).toHaveLength(1);expect(Object.keys(calls[0]).sort()).toEqual(['facts','language','memberIds','question']);expect(JSON.stringify(calls)).not.toMatch(/apiKey|systemInstruction|endpoint/);
 await expect(page.getByLabel('Ask about your week')).toHaveValue('');await expect(page.locator('.family-task-list')).not.toContainText(response.actions[0].title);
 await page.getByRole('button',{name:'Confirm these actions',exact:true}).click();await expect(page.locator('.family-task-list')).toContainText(response.actions[0].title);
});
test('unavailable shared AI and missing personal keys retain the question',async({page})=>{
 await page.route('**/api/ai/config',route=>route.fulfill({json:{available:false,model:'gemini-3.5-flash-lite'}}));await page.goto('/dashboard');await expect(page.getByLabel('Answer with')).toContainText(' · unavailable');
 const question='Help us make tomorrow easier';await page.getByLabel('Ask about your week').fill(question);await page.getByRole('button',{name:'Ask the assistant',exact:true}).click();await expect(page.locator('.home-assistant [role=alert]')).toContainText('unavailable');await expect(page.getByLabel('Ask about your week')).toHaveValue(question);
 await page.getByLabel('Answer with').selectOption('groq');await page.getByRole('button',{name:'Ask the assistant',exact:true}).click();await expect(page.locator('.home-assistant [role=alert]')).toContainText('in AI settings first');await expect(page.getByLabel('Ask about your week')).toHaveValue(question);
});
test('quota and malformed shared answers retain the question without fallback or partial changes',async({page})=>{
 await configured(page);let calls=0;await page.route('**/api/ai/answer',route=>{calls++;return calls===1?route.fulfill({status:429,json:{message:'DO_NOT_DISPLAY'}}):route.fulfill({json:{...response,actions:[{...response.actions[0],participantIds:['unknown']}]}});});
 const external:string[]=[];page.on('request',r=>{if(/generativelanguage.googleapis.com|api.groq.com|openrouter.ai\/api/.test(r.url()))external.push(r.url());});
 await page.goto('/dashboard');await expect(page.getByLabel('Answer with')).toContainText(' · available');const original=await page.locator('.family-task-list').innerText();
 for(let i=0;i<2;i++){await ask(page);await expect(page.locator('.home-assistant [role=alert]')).toBeVisible();await expect(page.getByLabel('Ask about your week')).toHaveValue('Help us make the afternoon calmer');expect(await page.locator('.family-task-list').innerText()).toBe(original);}
 expect(calls).toBe(2);expect(external).toEqual([]);await expect(page.locator('.home-assistant')).not.toContainText('DO_NOT_DISPLAY');
});
test('cancellation retains a shared question and ignores a late answer',async({page})=>{
 await configured(page);let release:()=>void=()=>{};await page.route('**/api/ai/answer',async route=>{await new Promise<void>(resolve=>{release=resolve;});await route.fulfill({json:response}).catch(()=>{});});
 await page.goto('/dashboard');await expect(page.getByLabel('Answer with')).toContainText(' · available');await ask(page);await expect(page.getByRole('button',{name:'Cancel',exact:true})).toBeVisible();await page.getByRole('button',{name:'Cancel',exact:true}).click();release();
 await expect(page.getByLabel('Ask about your week')).toHaveValue('Help us make the afternoon calmer');await expect(page.getByText(response.answer,{exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Confirm these actions'})).toHaveCount(0);
});
for(const blocked of [false,true])test(`walkthrough and sample reset restore fresh data, session storage blocked=${blocked}`,async({page})=>{
 if(blocked)await page.addInitScript(()=>{for(const name of ['getItem','setItem','removeItem'] as const){const original=Storage.prototype[name];Object.defineProperty(Storage.prototype,name,{configurable:true,value:function(this:Storage,...args:string[]){if(this===sessionStorage)throw new DOMException('blocked','SecurityError');return Reflect.apply(original,this,args);}});}});
 await page.goto('/demo');await page.getByRole('button',{name:/Mariam Mother/}).click();const task=page.locator('.family-task-list input[type=checkbox]').first();await task.check();
 await page.getByRole('link',{name:'How are you doing?',exact:true}).click();await page.getByLabel('A note for yourself').fill('Synthetic note to reset');await page.getByRole('button',{name:'Save check-in',exact:true}).click();await expect(page.getByText('Synthetic note to reset',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Family & more',exact:true}).click();await page.getByRole('link',{name:/Meet the sample family/}).click();await page.getByRole('link',{name:'Open presenter walkthrough',exact:true}).click();await page.getByRole('button',{name:'Meet the family',exact:true}).click();
 await page.getByRole('link',{name:'Home',exact:true}).first().click();await expect(page.getByText(/Good afternoon, Omar/)).toBeVisible();await expect(task).not.toBeChecked();
 await task.check();await page.getByRole('button',{name:'Family & more',exact:true}).click();await page.getByRole('link',{name:/Meet the sample family/}).click();await page.getByRole('link',{name:'Open presenter walkthrough',exact:true}).click();await page.getByRole('button',{name:'Step 1: Meet the family',exact:true}).click();await page.getByRole('button',{name:'Start over',exact:true}).click();await page.getByRole('link',{name:'Home',exact:true}).first().click();await expect(task).not.toBeChecked();
 await page.getByRole('link',{name:'How are you doing?',exact:true}).click();await expect(page.getByText('Synthetic note to reset',{exact:true})).toHaveCount(0);
 // The separate sample reset button uses the same operation.
 await page.getByRole('button',{name:'Family & more',exact:true}).click();await page.getByRole('link',{name:/Meet the sample family/}).click();await page.getByRole('button',{name:'Reset sample family',exact:true}).click();await page.getByRole('button',{name:/Omar Father/}).click();await expect(task).not.toBeChecked();
});
test('Arabic device language is automatic, Settings overrides survive reload and Device restores it',async({browser})=>{
 const context=await browser.newContext({locale:'ar-AE'}),page=await context.newPage();
 try{await page.goto('/settings');await expect(page.locator('html')).toHaveAttribute('lang','ar');await expect(page.locator('html')).toHaveAttribute('dir','rtl');await expect(page.getByLabel('لغة الموقع',{exact:true})).toHaveValue('system');
 await page.getByLabel('لغة الموقع',{exact:true}).selectOption('en');await expect(page.locator('html')).toHaveAttribute('lang','en');await page.reload();await expect(page.getByLabel('Website language',{exact:true})).toHaveValue('en');
 await page.getByLabel('Website language',{exact:true}).selectOption('system');await expect(page.locator('html')).toHaveAttribute('lang','ar');await page.reload();await expect(page.getByLabel('لغة الموقع',{exact:true})).toHaveValue('system');
 }finally{await context.close();}
});

for (const width of [360,768,1440]) for (const theme of ['light','dark'] as const) for (const language of ['en','ar']) test(`assistant inline policy ${width} ${theme} ${language}`,async({page})=>{
 await page.setViewportSize({width,height:1000});await page.emulateMedia({colorScheme:theme,reducedMotion:'reduce'});
 await page.addInitScript(language=>localStorage.setItem('familymind:language:v1',language),language);
 await configured(page);await page.goto('/dashboard');const policy=page.locator('#assistant-policy');await expect(policy).toBeVisible();await expect(policy.getByRole('link')).toHaveCount(2);if(language==='ar'){await expect(policy).not.toContainText('By sending');await expect(policy).not.toContainText(' and ');}
 for(const [value,url] of [['groq','https://console.groq.com/docs/legal/services-agreement'],['gemini','https://ai.google.dev/gemini-api/terms'],['openrouter','https://openrouter.ai/terms'],['server','https://ai.google.dev/gemini-api/terms']]){
  await page.getByRole('combobox').filter({has:page.locator('option[value="server"]')}).selectOption(value);await expect(policy.getByRole('link').first()).toHaveAttribute('href',url);
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
 await policy.screenshot({path:`/tmp/familymind-policy-${width}-${theme}-${language}.png`});
});
