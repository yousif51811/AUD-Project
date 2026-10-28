import {test,expect} from '@playwright/test';

test('the complete presenter walkthrough can calculate, plan, confirm optimization and finish',async({page})=>{
 await page.goto('/tour');await page.getByRole('button',{name:'Meet the family',exact:true}).click();
 for(let step=1;step<=8;step++){
  await expect(page).toHaveURL(new RegExp(`step=${step}$`));await expect(page.locator('#demo-title')).toBeVisible();
  if(step===3){await page.getByRole('button',{name:'See My Family Results',exact:true}).click();await expect(page.getByText('45/100',{exact:false}).first()).toBeVisible();}
  if(step===5){await page.getByRole('button',{name:'Generate My Weekly Plan',exact:true}).click();await expect(page.locator('.mini-plan li').first()).toBeVisible();}
  if(step===6){await expect(page.getByRole('region',{name:'Proposed changes',exact:true})).toBeVisible();await page.getByRole('button',{name:/^Apply \d+ Selected Changes?$/}).click();await expect(page.getByRole('alertdialog')).toBeVisible();await page.getByRole('button',{name:'Confirm and apply',exact:true}).click();await expect(page.getByRole('alertdialog')).toHaveCount(0);}
  if(step===8){await expect(page.getByText('No schedule changes have been applied yet.',{exact:false})).toHaveCount(0);await expect(page.locator('.impact-num').first()).not.toHaveText('0');await page.getByRole('link',{name:'Open the family dashboard',exact:true}).click();await expect(page.getByRole('heading',{name:'A little more together.'})).toBeVisible();await page.getByRole('link',{name:'Calendar',exact:true}).first().click();await expect(page.locator('h1:visible')).toBeVisible();}
  else await page.getByRole('button',{name:/^Next:/}).click();
 }
});
