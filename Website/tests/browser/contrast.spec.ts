import {test,expect} from '@playwright/test';
for(const palette of ['light','dark'] as const)test(`new screens have readable text in ${palette}`,async({page})=>{
 test.setTimeout(120000);await page.emulateMedia({colorScheme:palette,reducedMotion:'reduce'});await page.setViewportSize({width:1440,height:1000});
 for(const route of ['/sign-up','/family','/coach','/check-ins','/notifications','/tasks']){
  await page.goto(route);await expect(page.locator('h1:visible')).toBeVisible();
  const failures=await page.evaluate(()=>{
   const rgb=(s:string)=>{const n=s.match(/[\d.]+/g)?.map(Number)??[];if(n.length<3)return null;return s.startsWith('color(srgb ')?[...n.slice(0,3).map(c=>c*255),n[3]??1]:n;};
   const luminance=(v:number[])=>v.slice(0,3).map(c=>c/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((n,c,i)=>n+c*[.2126,.7152,.0722][i],0);
   const out:Array<{text:string;ratio:number}>=[];const walker=document.createTreeWalker(document.querySelector('main')!,NodeFilter.SHOW_TEXT);let node:Node|null;
   while((node=walker.nextNode())){const text=node.textContent?.trim()??'';const el=node.parentElement;if(!el||text.length<3||!el.getClientRects().length||el.closest('[aria-hidden="true"],button:disabled,option,svg,script,style,summary,details:not([open])'))continue;
    const style=getComputedStyle(el);if(style.visibility==='hidden'||Number(style.opacity)<1)continue;const color=rgb(style.color);if(!color||(color[3]??1)<1)continue;
    let parent:Element|null=el,bg:number[]|null=null;while(parent){const c=rgb(getComputedStyle(parent).backgroundColor);if(c&&(c[3]??1)===1){bg=c;break;}parent=parent.parentElement;}if(!bg)continue;
    const a=luminance(color),b=luminance(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);const large=parseFloat(style.fontSize)>=24||(parseFloat(style.fontSize)>=18.66&&Number(style.fontWeight)>=700);if(ratio<(large?3:4.5)-.03)out.push({text:text.slice(0,70),ratio:Math.round(ratio*100)/100});
   }return out;
  });expect(failures,route).toEqual([]);if(route==='/coach')await page.screenshot({path:`/tmp/familymind-courtyard-final-${palette}.png`,fullPage:false,animations:'disabled'});
 }
});
