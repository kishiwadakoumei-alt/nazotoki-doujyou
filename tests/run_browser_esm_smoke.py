"""Browser ESM smoke: imports exact docs modules in memory without HTTP access."""
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
modules = {'/'+p.relative_to(root/'docs').as_posix():p.read_text(encoding='utf-8') for p in (root/'docs/assets').rglob('*.js')}
css=(root/'docs/assets/style.css').read_text(encoding='utf-8')
script = r"""
async ({modules}) => {
  const urls = {};
  function resolve(path) {
    if (urls[path]) return urls[path];
    let code = modules[path];
    if (code === undefined) throw new Error('ESM module missing: '+path);
    code = code.replace(/(\bfrom\s*['"])(\.{1,2}\/[^'"\n]+)(['"])/g, (_,first,spec,last) => {
      const target = new URL(spec, 'https://example.test'+path).pathname;
      return first + resolve(target) + last;
    });
    const blob = new Blob([code],{type:'text/javascript'});
    urls[path] = URL.createObjectURL(blob);
    return urls[path];
  }
  await import(resolve('/assets/main.js'));
}
"""
with sync_playwright() as playwright:
    browser=playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    for width,height in [(1440,900),(390,844)]:
        page=browser.new_page(viewport={'width':width,'height':height},locale='ja-JP')
        errors=[]
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.set_content(f'<!doctype html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>{css}</style></head><body><div id="app"></div></body></html>')
        page.evaluate(script,{'modules':modules})
        assert page.get_by_text('閃きを、鍛える。').is_visible(), page.locator('body').inner_text()[:300]
        assert not errors,errors
        if width==1440:
            page.locator('[data-action="pick-mode"][data-mode="trial"]').first.click()
            page.locator('[data-action="start"]').click()
            assert page.locator('.num-chip').count()==10
            assert page.locator('#answer-input').is_visible()
        else:
            assert page.evaluate('document.documentElement.scrollWidth-document.documentElement.clientWidth')<=2
        print(f'PASS ESM docs: {width}x{height}, homepage and interaction; JS errors: {len(errors)}')
        page.close()
    browser.close()
