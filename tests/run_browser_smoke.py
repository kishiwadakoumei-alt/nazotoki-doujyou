"""In-memory browser smoke test: Chromium set_content avoids network navigation restrictions."""
import json,subprocess,time
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
CJS=Path('/tmp/nazo-forge-cjs')
subprocess.run(['tsc','--project',str(ROOT/'tsconfig.pages.json'),'--module','commonjs','--moduleResolution','node','--outDir',str(CJS)],check=True)
parts=['(function(){const M={}; const cache={};']
for f in CJS.rglob('*.js'):
    mid='/'+f.relative_to(CJS).as_posix().removesuffix('.js')
    parts.append('M['+json.dumps(mid)+']=function(require,module,exports){\n'+f.read_text()+'\n};')
parts.append(r'''
function norm(path){const r=[];for(const p of path.split('/')){if(p==='.'||!p)continue;if(p==='..')r.pop();else r.push(p);}return '/'+r.join('/');}
function load(mid){if(mid.endsWith('.css'))return {};if(mid==='/data')mid='/data/index';let m=cache[mid];if(m)return m.exports;if(!M[mid])throw new Error('missing '+mid);m={exports:{}};cache[mid]=m;M[mid](function(p){return load(norm(mid.substring(0,mid.lastIndexOf('/'))+'/'+p));},m,m.exports);return m.exports;}
load('/main');
})();
''')
js='\n'.join(parts)
css=(ROOT/'src/style.css').read_text()
html='<html lang="ja"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><style>'+css+'</style></head><body><div id="app"></div><script>'+js+'</script></body></html>'
OUT=ROOT/'screenshots';OUT.mkdir(exist_ok=True)
errors=[]
with sync_playwright() as p:
    b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-gpu'])
    desktop=b.new_page(viewport={'width':1440,'height':900},locale='ja-JP')
    desktop.on('pageerror',lambda e:errors.append(str(e)))
    desktop.on('dialog',lambda d:d.accept())
    desktop.evaluate("()=>{let store=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return store.get(k)??null},setItem(k,v){store.set(k,String(v))},removeItem(k){store.delete(k)}}})}")
    desktop.set_content(html,wait_until='load')
    print('home content:',desktop.locator('body').inner_text()[:80])
    assert desktop.get_by_text('閃きを、鍛える。').is_visible()
    desktop.screenshot(path=str(OUT/'home_desktop.png'),full_page=True)
    desktop.locator('[data-action="pick-mode"][data-mode="trial"]').first.click()
    desktop.locator('[data-action="start"]').click()
    assert desktop.locator('.num-chip').count()==10
    score=desktop.locator('.game-stat').first.locator('strong')
    assert score.inner_text().startswith('0')
    # The in-memory browser still sees compiled data through a test-only global import hook.
    answer=desktop.evaluate("()=>{let a=JSON.parse(localStorage.getItem('nazo-forge-v1')).active;return a.questionIds[a.index]}")
    # Get correct answer from puzzle data statically calculated in a Node step from distributed artifacts.
    answers=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {PUZZLES} from './docs/assets/data/index.js';console.log(JSON.stringify(Object.fromEntries(PUZZLES.map(x=>[x.id,x.answer]))))"],cwd=ROOT,text=True))
    desktop.locator('#answer-input').fill(answers[answer]);desktop.locator('#answer-input').press('Enter')
    assert score.inner_text().startswith('1')
    assert '回答を記録しました' in desktop.locator('.feedback').inner_text()
    desktop.locator('[data-action="next"]').click()
    desktop.screenshot(path=str(OUT/'trial_desktop.png'),full_page=True)
    oldtime=json.loads(desktop.evaluate("localStorage.getItem('nazo-forge-v1')"))['active']['deadlineAt']
    assert oldtime>0
    desktop.locator('[data-action="end"]').click()
    assert desktop.locator('.result-item').count()==10
    assert desktop.get_by_text('CHALLENGE COMPLETE.').is_visible()
    desktop.locator('.result-item summary').first.click()
    assert desktop.locator('.explanation-grid').count()>=1
    desktop.locator('[data-action="home"]').first.click()
    desktop.locator('[data-action="pick-mode"][data-mode="training"]').first.click()
    desktop.locator('[data-action="start"]').click()
    desktop.locator('[data-action="hint"]').click()
    assert desktop.locator('.hints').is_visible()
    desktop.locator('#answer-input').fill('でたらめ');desktop.locator('#answer-input').press('Enter')
    assert 'まだ違うようです' in desktop.locator('.feedback').inner_text()
    current=desktop.evaluate("()=>{let a=JSON.parse(localStorage.getItem('nazo-forge-v1')).active;return a.questionIds[a.index]}")
    desktop.locator('#answer-input').fill(answers[current]);desktop.locator('#answer-input').press('Enter')
    assert desktop.locator('.reveal').is_visible()
    desktop.locator('[data-action="bookmark"]').click()
    assert desktop.locator('.bookmark-btn.on').count()==1
    desktop.screenshot(path=str(OUT/'training_desktop.png'),full_page=True)
    desktop.locator('[data-action="stats"]').click()
    assert desktop.get_by_text('難易度別の初見正答率').is_visible()
    desktop.screenshot(path=str(OUT/'analytics_desktop.png'),full_page=True)
    desktop.locator('[data-action="home"]').first.click()
    desktop.locator('[data-action="pick-mode"][data-mode="review"]').first.click()
    desktop.locator('#review-select').select_option('bookmark')
    desktop.locator('[data-action="start"]').click()
    assert desktop.locator('.puzzle-panel').is_visible()
    # Compare persisted state: refresh simulation in a second page where localStorage is preloaded.
    saved=desktop.evaluate("localStorage.getItem('nazo-forge-v1')")
    page2=b.new_page(viewport={'width':1440,'height':900});page2.on('pageerror',lambda e:errors.append(str(e)))
    page2.evaluate("()=>{let store=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return store.get(k)??null},setItem(k,v){store.set(k,String(v))}}})}")
    page2.evaluate('localStorage.setItem("nazo-forge-v1",'+json.dumps(saved)+');')
    page2.set_content(html)
    assert page2.locator('.puzzle-panel').is_visible(),page2.locator('body').inner_text()[:300]
    # SVG test via storage injection on fresh page with a real E05 puzzle session.
    svgpage=b.new_page(viewport={'width':1440,'height':900})
    svgpage.on('pageerror',lambda e:errors.append(str(e)))
    state={'id':'preview','mode':'training','questionIds':['E05'],'index':0,'answers':{'E05':{'id':'E05','submitted':False,'answer':'','correct':False,'attempts':0,'hintsUsed':0,'skipped':False,'spentSec':0,'revealed':False,'firstSeen':True}},'startedAt':int(time.time()*1000),'deadlineAt':None,'lastEntryAt':int(time.time()*1000),'firstUnseenCount':1,'isInfinite':False,'totalSolved':0}
    svgpage.evaluate("()=>{let store=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return store.get(k)??null},setItem(k,v){store.set(k,String(v))}}})}")
    svgpage.evaluate('localStorage.setItem("nazo-forge-v1",'+json.dumps(json.dumps({'version':1,'records':{},'summaries':[],'active':state}))+');')
    svgpage.set_content(html)
    assert svgpage.locator('article > .puzzle-figure .puzzle-svg polygon').count()==2
    svgpage.locator('[data-action="zoom"]').click()
    assert svgpage.locator('#puzzle-zoom').is_visible()
    svgpage.locator('[data-action="close-zoom"]').click()
    assert not svgpage.locator('#puzzle-zoom').is_visible()
    svgpage.screenshot(path=str(OUT/'visual_puzzle_desktop.png'),full_page=True)
    # The interaction renderer supports select / rotate / ordered selection.
    for qid,indices,expected in [('B03',[1],'2'),('B10',['rotate','rotate'],'うえ'),('I24',[2,0,1],'はなび')]:
        interaction=b.new_page(viewport={'width':1000,'height':800})
        interaction.on('pageerror',lambda e:errors.append(str(e)))
        interaction.evaluate("()=>{let store=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return store.get(k)??null},setItem(k,v){store.set(k,String(v))}}})}")
        qstate={**state,'questionIds':[qid],'index':0,'answers':{qid:{'id':qid,'submitted':False,'answer':'','correct':False,'attempts':0,'hintsUsed':0,'skipped':False,'spentSec':0,'revealed':False,'firstSeen':True}},'startedAt':int(time.time()*1000),'lastEntryAt':int(time.time()*1000)}
        interaction.evaluate('localStorage.setItem("nazo-forge-v1",'+json.dumps(json.dumps({'version':1,'records':{},'summaries':[],'active':qstate}))+');')
        interaction.set_content(html)
        for ix in indices:
            if ix=='rotate':interaction.locator('[data-interaction="rotate"][data-step="1"]').first.click()
            else:interaction.locator('[data-interaction][data-index="'+str(ix)+'"]').first.click()
        assert interaction.locator('#answer-input').input_value()==expected,(qid,interaction.locator('#answer-input').input_value())
        interaction.locator('#answer-input').press('Enter')
        assert interaction.locator('.reveal').is_visible(),qid
        interaction.close()
    # Timed expiry on reopening, and assessment privacy during a correct submission.
    expired=b.new_page(viewport={'width':1000,'height':800})
    expired.on('pageerror',lambda e:errors.append(str(e)))
    expired.evaluate("()=>{let store=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return store.get(k)??null},setItem(k,v){store.set(k,String(v))}}})}")
    expired_state={**state,'mode':'trial','startedAt':int(time.time()*1000)-301000,'lastEntryAt':int(time.time()*1000)-301000,'deadlineAt':int(time.time()*1000)-1000}
    expired.evaluate('localStorage.setItem("nazo-forge-v1",'+json.dumps(json.dumps({'version':1,'records':{},'summaries':[],'active':expired_state}))+');')
    expired.set_content(html)
    assert expired.get_by_text('TIME UP.').is_visible()
    assess=b.new_page(viewport={'width':1000,'height':800})
    assess.on('pageerror',lambda e:errors.append(str(e)))
    assess.evaluate("()=>{let store=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return store.get(k)??null},setItem(k,v){store.set(k,String(v))}}})}")
    assess_state={**state,'mode':'assessment','startedAt':int(time.time()*1000),'lastEntryAt':int(time.time()*1000),'deadlineAt':int(time.time()*1000)+1200000}
    assess.evaluate('localStorage.setItem("nazo-forge-v1",'+json.dumps(json.dumps({'version':1,'records':{},'summaries':[],'active':assess_state}))+');')
    assess.set_content(html)
    assert assess.get_by_text('回答数').is_visible()
    assess.locator('#answer-input').fill('かぎあな')
    assess.locator('#answer-input').press('Enter')
    assert assess.locator('.game-stat').first.locator('strong').inner_text().startswith('1')
    assert assess.locator('.num-chip.solved').count()==0
    assert assess.locator('.reveal').count()==0
    assert '正解！' not in assess.locator('.feedback').inner_text()
    mobile=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,locale='ja-JP')
    mobile.on('pageerror',lambda e:errors.append(str(e)))
    mobile.evaluate("()=>{let store=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return store.get(k)??null},setItem(k,v){store.set(k,String(v))}}})}")
    mobile.set_content(html)
    mobile.screenshot(path=str(OUT/'home_mobile.png'),full_page=True)
    mobile.locator('[data-action="pick-mode"][data-mode="training"]').first.click()
    mobile.locator('[data-action="start"]').click()
    mobile.screenshot(path=str(OUT/'puzzle_mobile.png'),full_page=True)
    assert mobile.locator('#answer-input').is_visible()
    over=mobile.evaluate('document.documentElement.scrollWidth-document.documentElement.clientWidth')
    assert over<=2, f'mobile overflows {over}px'
    assert not errors,errors
    print('Browser smoke PASS: trial, submission, navigation, result, hint, wrong/correct, bookmark, stats, review, data reload, SVG, zoom, select/order/rotate, timeout, assessment privacy, mobile')
    print('Mobile horizontal overflow:',over,'pixels')
    print('Screenshots:',len(list(OUT.glob('*.png'))))
    b.close()
