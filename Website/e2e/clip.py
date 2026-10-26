import sys
from playwright.sync_api import sync_playwright
url,out,w,sel=sys.argv[1],sys.argv[2],int(sys.argv[3]),sys.argv[4]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':w,'height':900})
    pg.goto(url); pg.wait_for_load_state('networkidle'); pg.wait_for_timeout(1200)
    el=pg.locator(sel).first; el.scroll_into_view_if_needed(); pg.wait_for_timeout(1200); el.screenshot(path=out); b.close()
