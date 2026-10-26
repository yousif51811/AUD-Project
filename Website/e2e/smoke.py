import sys, json
from playwright.sync_api import sync_playwright
BASE='http://localhost:4173'
ROUTES=['/','/onboarding','/assessment','/results','/dashboard','/coach','/plan','/schedule','/student','/care','/memories','/trust','/demo','/nope']
WIDTHS=[360,390,430,768,1024,1366,1440,1920]
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch()
    for w in WIDTHS:
        ctx=b.new_context(viewport={'width':w,'height':900})
        pg=ctx.new_page()
        pg.on('console', lambda m: errs.append((w,m.type,m.text)) if m.type in ('error','warning') else None)
        pg.on('pageerror', lambda e: errs.append((w,'pageerror',str(e))))
        for r in ROUTES:
            pg.goto(BASE+r+('?intro=off' if r=='/' else ''))
            pg.wait_for_load_state('networkidle')
            ov=pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
            h1=pg.locator('h1').count()
            if ov>0 or h1==0: print('ISSUE',w,r,'overflow',ov,'h1',h1)
            if w in (390,1440): pg.screenshot(path=f'shots/{w}{r.replace("/","_") or "_"}.png', full_page=True)
        ctx.close()
    b.close()
print('errors:',errs[:20])
