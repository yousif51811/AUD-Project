import sys
from playwright.sync_api import sync_playwright
url, w = sys.argv[1], int(sys.argv[2])
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':w,'height':900})
    pg.goto(url); pg.wait_for_load_state('networkidle'); pg.wait_for_timeout(800)
    res=pg.evaluate('''()=>{const W=document.documentElement.clientWidth;const out=[];document.querySelectorAll('body *').forEach(e=>{const r=e.getBoundingClientRect();if(r.right>W+1&&r.width>0){let p=e.parentElement,clip=false;while(p&&p!==document.body){const o=getComputedStyle(p).overflowX;if(o!=='visible'){clip=true;break}p=p.parentElement}if(!clip)out.push(e.tagName+'.'+(e.className&&e.className.baseVal===undefined?e.className:'svg')+' '+Math.round(r.right))}});return out.slice(0,12)}''')
    print('\n'.join(res)); b.close()
