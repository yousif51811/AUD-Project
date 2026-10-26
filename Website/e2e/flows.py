import re, sys
from playwright.sync_api import sync_playwright
BASE = 'http://localhost:4173'
errs = []
def ok(name): print('PASS', name, flush=True)
def scene(pg): return int(re.search(r'scene-(\d)', pg.locator('.intro').get_attribute('class')).group(1))
NEXT = re.compile('Next:')


with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1366, 'height': 900})
    pg = ctx.new_page()
    pg.on('console', lambda m: errs.append((m.type, m.text)) if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: errs.append(('pageerror', str(e))))

    def go(path):
        pg.goto(BASE + path); pg.wait_for_selector('h1'); pg.wait_for_load_state('networkidle'); pg.wait_for_timeout(150)

    # --- Intro ---
    go('/'); pg.wait_for_selector('.intro')
    assert pg.evaluate("document.documentElement.classList.contains('intro-lock')")
    pg.wait_for_timeout(4500)
    pg.get_by_role('button', name='Pause').click()
    s1 = scene(pg); pg.wait_for_timeout(5000); s2 = scene(pg); assert s1 == s2, 'pause failed'
    pg.get_by_role('button', name='Resume').click(); pg.wait_for_timeout(5000)
    s3 = scene(pg); assert s3 > s2, 'resume failed'
    pg.get_by_role('button', name='Skip intro').click(); pg.wait_for_selector('.intro', state='detached')
    assert not pg.evaluate("document.documentElement.classList.contains('intro-lock')")
    pg.evaluate("window.scrollTo(0,400)"); assert pg.evaluate('window.scrollY') > 0
    ok('intro skip/pause/resume/unlock')
    pg.reload(); pg.wait_for_timeout(800); assert pg.locator('.intro').count() == 0; ok('intro once per session')
    pg.get_by_role('button', name='Replay Intro').click(); pg.wait_for_selector('.intro'); pg.keyboard.press('Escape'); pg.wait_for_selector('.intro', state='detached'); ok('replay + Esc')
    for i in range(4):
        pg.get_by_role('button', name='Replay Intro').click(); pg.wait_for_selector('.intro'); pg.get_by_role('button', name='Skip intro').click(); pg.wait_for_selector('.intro', state='detached')
    ok('repeated replay')
    pg.get_by_role('button', name='Replay Intro').click(); pg.wait_for_selector('.intro'); pg.wait_for_selector('.intro', state='detached', timeout=40000); ok('intro completes naturally')

    rc = b.new_context(reduced_motion='reduce', viewport={'width': 1200, 'height': 800}); rp = rc.new_page(); rp.goto(BASE + '/'); rp.wait_for_selector('.intro-static')
    rp.get_by_role('button', name='Enter Website').click(); rp.wait_for_selector('.intro', state='detached'); ok('reduced motion intro'); rc.close()

    # --- Nav / routes ---
    go('/?intro=off')
    for label, path in [('Assessment', '/assessment'), ('Dashboard', '/dashboard'), ('AI Coach', '/coach'), ('Weekly Plan', '/plan'), ('Trust & Safety', '/trust'), ('Overview', '/')]:
        pg.locator('.primary-nav').get_by_role('link', name=label).click(); pg.wait_for_url('**' + path)
    pg.get_by_role('link', name='Launch Demo').first.click(); pg.wait_for_url('**/demo'); ok('primary nav')
    go('/?intro=off'); pg.get_by_role('link', name='Start Family Check-In').first.click(); pg.wait_for_url('**/assessment'); ok('CTA start')
    go('/?intro=off'); pg.get_by_role('link', name='View the Live Family Story').click(); pg.wait_for_url('**/demo'); ok('CTA story')

    # --- Assessment ---
    go('/assessment')
    pg.get_by_role('button', name='Next question').click(); assert pg.get_by_text('Please choose an answer').count() > 0; ok('validation')
    best = ['Four or more times', 'Low', 'Strong and open', 'Fair', 'None or low', 'No routine support is needed', 'None were missed', 'Good']
    for a in best:
        pg.get_by_role('radio', name=re.compile('^' + re.escape(a))).check()
        pg.get_by_role('button', name=re.compile('Next question|Review and finish')).click()
    pg.locator('#note').fill('<b>calm</b> evenings'); pg.get_by_role('button', name='See My Family Results').click(); pg.wait_for_url('**/results'); pg.wait_for_selector('.score-num')
    assert pg.get_by_text('Strong Foundation').count() > 0 and pg.locator('.score-num').first.inner_text() == '100'; ok('score 100 from best answers')
    pg.locator('button', has_text='How this was calculated').click(); assert pg.get_by_text('100 − 0').count() > 0; ok('calc panel')
    go('/assessment')
    pg.get_by_role('button', name='Fill with Al Noor demo answers').click(); pg.get_by_role('button', name='See My Family Results').click(); pg.wait_for_url('**/results'); pg.wait_for_selector('.score-num')
    assert pg.locator('.score-num').first.inner_text() == '45'; assert pg.get_by_text('Needs Attention').count() > 0; ok('demo => 45 Needs Attention')
    pg.get_by_role('button', name='Add to Family Plan').first.click(); ok('rec add to plan')

    # --- Coach ---
    go('/coach'); pg.get_by_role('button', name='My child is stressed about exams.').click()
    pg.wait_for_selector('text=One action for today', timeout=8000); assert pg.get_by_text("Move Zayed's Wednesday kitchen task to Omar.").count() > 0
    pg.get_by_role('button', name='Add Actions to Plan').click(); pg.wait_for_selector('.toast'); ok('coach scenario + add to plan')
    pg.get_by_role('button', name='Edit', exact=True).click(); pg.locator('#ed-today').fill('Walk together for ten minutes'); pg.get_by_role('button', name='Save changes').click(); assert pg.get_by_text('Walk together for ten minutes').count() > 0; ok('coach edit')
    pg.get_by_role('button', name='Reject').click(); assert pg.get_by_text('You set this recommendation aside').count() > 0; ok('coach reject')
    pg.locator('#coach-in').fill('I want to kill myself'); pg.get_by_role('button', name='Get guidance').click(); pg.wait_for_selector('text=cannot monitor emergencies', timeout=8000)
    assert pg.get_by_role('button', name='Add Actions to Plan').count() == 0; ok('crisis routing')
    pg.get_by_role('button', name='Clear conversation').click(); assert pg.get_by_text('What is on your mind this week?').count() > 0; ok('clear conv')

    # --- Plan ---
    go('/plan'); pg.wait_for_selector('.plan-action'); n0 = pg.locator('.plan-action').count()
    pg.get_by_label('Mark complete: 10-minute family check-in after dinner').check(); ok('plan toggle')
    sw = pg.get_by_role('switch', name=re.compile('Reduce Workload'))
    sw.check(); assert pg.locator('.plan-action').count() == 7; sw.uncheck(); assert pg.locator('.plan-action').count() == n0; ok('reduce workload')
    pg.get_by_role('button', name=re.compile('^Edit: ')).first.click(); pg.locator('#pa-t').fill('Edited action title'); pg.get_by_role('button', name='Save action').click(); assert pg.get_by_text('Edited action title').count() > 0; ok('plan edit')
    pg.get_by_role('button', name=re.compile('^Replace: ')).first.click(); pg.get_by_role('button', name='Use this action').first.click(); ok('plan replace')
    pg.get_by_role('button', name=re.compile('^Regenerate: ')).first.click(); ok('plan regenerate')
    pg.get_by_role('button', name='Add action').click(); pg.locator('#pa-t').fill('Extra'); pg.locator('#pa-d').select_option('2'); pg.get_by_role('button', name='Save action').click(); assert pg.get_by_text('already has 2 actions').count() > 0; ok('plan day cap validation')
    pg.keyboard.press('Escape')
    pg.get_by_role('button', name='Reset sample plan').click(); ok('reset sample plan')

    # --- Schedule ---
    go('/schedule'); assert pg.get_by_text('1 scheduling conflict').count() > 0
    pg.get_by_role('button', name=re.compile('Review 8 proposed changes')).click()
    assert pg.get_by_text('Move “Kitchen cleanup after dinner” from Zayed to Omar').count() > 0
    pg.get_by_role('button', name='Apply 8 Selected Changes').click(); assert pg.get_by_role('alertdialog').count() == 1
    pg.keyboard.press('Escape'); assert pg.get_by_role('alertdialog').count() == 0; ok('confirm dialog + Esc')
    pg.get_by_role('button', name='Apply 8 Selected Changes').click(); pg.get_by_role('button', name='Confirm and apply').click(); pg.wait_for_selector('text=Applied 8 changes')
    assert pg.get_by_text('No conflicts.').count() > 0; ok('apply fixes conflicts')
    pg.get_by_role('button', name='Undo last change').click(); assert pg.get_by_text('1 scheduling conflict').count() > 0; ok('undo')
    pg.get_by_role('button', name='Add event').click(); pg.locator('#ev-t').fill('Family board games'); pg.get_by_role('checkbox', name=re.compile('^Omar')).check(); pg.locator('#ev-s').fill('19:00'); pg.locator('#ev-e').fill('18:00'); pg.get_by_role('button', name='Add to schedule').click(); assert pg.get_by_text('End time must be after').count() > 0
    pg.locator('#ev-e').fill('20:00'); pg.get_by_role('button', name='Add to schedule').click(); pg.wait_for_selector('text=Event added'); ok('event add + validation')
    pg.get_by_role('button', name='Day view').click(); pg.get_by_role('button', name='Week view').click()
    pg.get_by_role('button', name='Edit Family board games').first.click(); pg.locator('#ev-t').fill('Family game night'); pg.get_by_role('button', name='Save changes').click(); assert pg.get_by_text('Family game night').count() > 0; ok('event edit')
    pg.get_by_role('button', name='Delete Family game night').first.click(); pg.get_by_role('button', name='Delete event').click(); assert pg.get_by_text('Family game night').count() == 0; ok('event delete')
    pg.get_by_role('button', name='Older Adult Care', exact=True).click(); assert pg.locator('.event').count() > 0; ok('filter chips')

    # --- Care ---
    go('/care'); pg.get_by_role('button', name='Confirm', exact=True).nth(1).click(); assert pg.get_by_text('✓ Confirmed').count() > 0; ok('care confirm')
    pg.get_by_role('button', name='Remind Later').nth(0).click(); ok('care remind later')
    pg.get_by_role('button', name='Ask Family Member').first.click(); pg.get_by_role('button', name='Send request').click(); ok('care ask')
    pg.get_by_role('button', name='Assign Backup').first.click(); pg.get_by_role('button', name='Assign Care Backup').click(); assert pg.get_by_text('waiting for agreement').count() > 0; ok('care backup (unagreed)')
    pg.get_by_role('button', name='Simulate: reminder not confirmed').click(); pg.wait_for_selector('.toast:has-text("No backup notification sent")')
    pg.get_by_role('button', name='Assign Backup').first.click(); pg.get_by_role('switch', name=re.compile('Both people')).check(); pg.get_by_role('button', name='Assign Care Backup').click()
    pg.get_by_role('button', name='Simulate: reminder not confirmed').click(); pg.wait_for_selector('.toast:has-text("Backup notified")'); ok('two-stage reminder (only when agreed + required)')
    pg.get_by_role('button', name='Add trusted contact').click(); pg.get_by_role('button', name='Save contact').click(); assert pg.get_by_text('Enter the contact’s name').count() > 0; pg.locator('#ec-n').fill('Aunt Noura'); pg.get_by_role('button', name='Save contact').click(); assert pg.get_by_text('Aunt Noura').count() > 0; ok('emergency contact')

    # --- Memories ---
    go('/memories'); assert pg.locator('.memory-card').count() == 4
    pg.get_by_role('button', name='Add memory').click(); pg.get_by_role('button', name='Save memory').click(); assert pg.get_by_text('Give the memory a short title').count() > 0
    pg.locator('#me-t').fill('Pizza night'); pg.locator('#me-m').fill('Everyone made their own pizza.'); pg.get_by_role('button', name='Save memory').click(); assert pg.locator('.memory-card').count() == 5; ok('memory add')
    pg.locator('#mq').fill('pizza'); assert pg.locator('.memory-card').count() == 1; pg.locator('#mq').fill('zzzz'); assert pg.get_by_text('No memories match').count() > 0; pg.locator('#mq').fill(''); ok('memory search')
    pg.locator('#mt').select_option('Story'); assert pg.locator('.memory-card').count() == 1; pg.locator('#mt').select_option('All')
    pg.get_by_role('button', name='Edit Pizza night').click(); pg.locator('#me-t').fill('Pizza Friday'); pg.get_by_role('button', name='Save memory').click(); assert pg.get_by_text('Pizza Friday').count() > 0; ok('memory edit')
    pg.reload(); pg.wait_for_selector('.memory-card'); assert pg.get_by_text('Pizza Friday').count() > 0; ok('persistence after refresh')
    pg.get_by_role('button', name='Delete Pizza Friday').click(); pg.get_by_role('button', name='Delete memory').click(); assert pg.locator('.memory-card').count() == 4; ok('memory delete')

    # --- Student ---
    go('/student'); pg.get_by_role('button', name='Start').click(); pg.wait_for_timeout(1500); pg.get_by_role('button', name='Pause').click(); ok('timer')
    pg.locator('#sl-in').fill('99'); pg.get_by_role('button', name='Log sleep').click(); assert pg.get_by_text('between 2 and 14').count() > 0; pg.locator('#sl-in').fill('7'); pg.get_by_role('button', name='Log sleep').click()
    pg.get_by_role('button', name='Share Summary with household').click(); assert pg.get_by_text('Request: I am feeling').count() > 0; ok('student share')

    # --- Trust & clear ---
    go('/trust'); pg.locator('#why-sel').select_option(index=2); ok('why panel')
    pg.get_by_role('button', name='Clear Local Data').click(); pg.get_by_role('alertdialog').get_by_role('button', name='Clear Local Data').click()
    go('/dashboard'); assert pg.get_by_text('Your dashboard starts with a check-in').count() > 0; ok('empty dashboard after clear')
    pg.reload(); pg.wait_for_selector('h1'); pg.wait_for_timeout(300); assert pg.get_by_text('Your dashboard starts with a check-in').count() > 0; ok('clear persists (no reseed)')
    for r in ['/results', '/plan', '/schedule', '/student', '/care', '/memories', '/coach']:
        go(r); assert pg.locator('h1').count() >= 1
    ok('empty states render on all routes')
    go('/dashboard'); pg.locator('#main').get_by_role('button', name='Restore Al Noor demo').click(); assert pg.get_by_text('Good afternoon, Al Noor family').count() > 0; ok('restore demo')

    # --- Onboarding ---
    go('/onboarding'); pg.get_by_role('button', name=re.compile('I understand')).click(); pg.get_by_role('button', name='Continue').click(); assert pg.get_by_text('Please fix').count() > 0
    pg.locator('#hh-name').fill('The Hassan Family'); pg.locator('#m-name').fill('Hassan'); pg.get_by_role('button', name='Add to household').click(); pg.get_by_role('button', name='Continue').click()
    pg.get_by_label('Communicate more openly').check(); pg.get_by_role('button', name='Continue').click(); pg.get_by_role('button', name='Continue').click()
    pg.get_by_role('button', name='Create my household').click(); pg.wait_for_url('**/assessment'); ok('onboarding custom')
    go('/dashboard'); assert pg.get_by_text('Your dashboard starts with a check-in').count() > 0 or pg.get_by_text('Hassan family').count() > 0; ok('custom household state')

    # --- Demo full run ---
    go('/demo'); pg.get_by_role('button', name='Begin the demonstration').click()
    assert pg.get_by_role('alertdialog').count() == 1, 'custom data should prompt before demo replaces it'
    pg.get_by_role('button', name='Replace and begin').click()
    pg.wait_for_selector('text=Meet the Al Noor Family')
    pg.get_by_role('button', name='Presenter notes').click()
    assert pg.get_by_text('Omar Al Noor').count() > 0; pg.get_by_role('button', name=NEXT).click()
    pg.get_by_role('button', name=NEXT).click()
    pg.get_by_role('button', name='See My Family Results').click(); assert pg.locator('.score-num').first.inner_text() == '45'
    pg.get_by_role('button', name=NEXT).click(); pg.get_by_role('button', name=NEXT).click()
    pg.get_by_role('button', name='Generate My Weekly Plan').click(); assert pg.get_by_text('Gratitude reflection').count() > 0
    pg.get_by_role('button', name=NEXT).click()
    pg.get_by_role('button', name='Apply 8 Selected Changes').click(); pg.get_by_role('button', name='Confirm and apply').click()
    pg.get_by_role('button', name=NEXT).click(); assert pg.get_by_text('cannot monitor emergencies').count() > 0
    pg.get_by_role('button', name=NEXT).click()
    print(pg.locator('.impact-grid').inner_text().replace('\n', ' | '))
    assert pg.get_by_text('FamilyMind AI does not replace the family’s judgment').count() > 0; ok('demo full run')
    pg.reload(); pg.wait_for_selector('h1'); pg.wait_for_timeout(500); assert pg.get_by_text('Show the final family actions').count() > 0; ok('demo step refresh')
    pg.get_by_role('button', name='Restart Demo').first.click(); pg.get_by_role('heading', name='Meet the Al Noor Family').wait_for(); ok('demo restart')
    pg.get_by_role('button', name='Exit Demo').first.click(); pg.wait_for_url(BASE + '/')

    # --- Mobile nav + focus ---
    mc = b.new_context(viewport={'width': 390, 'height': 800}); mp = mc.new_page(); mp.goto(BASE + '/dashboard')
    mp.get_by_role('button', name='Open menu').click(); assert mp.get_by_role('dialog').count() == 1
    for _ in range(25): mp.keyboard.press('Tab')
    assert mp.evaluate("document.querySelector('[role=dialog]').contains(document.activeElement)"); mp.keyboard.press('Escape')
    assert mp.evaluate("document.activeElement.getAttribute('aria-label')") == 'Open menu'; ok('mobile nav focus trap/restore')
    mp.get_by_role('button', name='Open menu').click(); mp.get_by_role('navigation', name='Mobile primary').get_by_role('link', name='Memory Vault').click(); mp.wait_for_url('**/memories'); ok('mobile nav link')
    b.close()
print('console errors:', errs)
