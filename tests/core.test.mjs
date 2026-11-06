import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
import {PUZZLES,PUZZLE_MAP} from '../docs/assets/data/index.js';
import {CATEGORIES} from '../docs/assets/types.js';
import {normalize,isCorrect,freshRecord,unseen,selectQuestions,newSession,getScore,getRemainingMs,getSummary,isReviewMatch} from '../docs/assets/engine.js';
import {freshData,loadData,saveData,STORAGE_KEY} from '../docs/assets/storage.js';
import {renderVisual} from '../docs/assets/visuals.js';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');

test('上級者用24問のみ公開対象、全ジャンルと全IDを検査',()=>{
  assert.equal(PUZZLES.length,24);
  assert.equal(PUZZLE_MAP.size,24);
  assert.deepEqual({advanced:PUZZLES.filter(p=>p.difficulty==='advanced').length,expert:PUZZLES.filter(p=>p.difficulty==='expert').length},{advanced:11,expert:13});
  assert.equal(PUZZLES.filter(p=>['beginner','intermediate'].includes(p.difficulty)).length,0);
  assert.ok(new Set(PUZZLES.map(p=>p.category)).size>=9,'公開版のジャンルが少なすぎる');
  for(const p of PUZZLES)assert.match(p.id,/^F\d{3}$/);
});

test('公開24問に解答・許容回答・3ヒント・4項目の解説・レビュー状態',()=>{
  const validKinds=['cards','grid','lines','path','svg','split','text','interaction','composite'];
  for(const p of PUZZLES){
    assert.ok(p.title.length>=3&&p.prompt.length>=12,p.id);
    assert.ok(p.answer.length>0,p.id);
    assert.ok(p.hints.length===3&&p.hints.every(h=>h.trim().length>=6),`ヒント不足: ${p.id}`);
    for(const field of ['clue','steps','aha','transfer'])assert.ok(p.explanation[field]?.length>=(field==='clue'?5:10),`解説不足: ${p.id}/${field}`);
    assert.ok(validKinds.includes(p.visual.kind),p.id);
    assert.ok(isCorrect(p,p.answer),p.id);
    assert.equal(p.version,1,p.id);
    assert.equal(p.qualityStatus,'needs-playtest',p.id);
    assert.ok(p.skillTags?.length>=2,p.id);
    assert.ok(p.mechanism?.length>0,p.id);
    for(const a of p.aliases)assert.ok(isCorrect(p,a),p.id);
    const html=renderVisual(p.visual,{uiSelection:[],uiRotation:0});
    assert.ok(html.startsWith('<figure')&&!html.includes('undefined'),p.id);
  }
});

test('視覚的資料を使う問題が半数以上で、操作・SVG・複数資料が動作',()=>{
  assert.ok(PUZZLES.filter(p=>['svg','grid','path','composite','interaction'].includes(p.visual.kind)).length>=19);
  assert.ok(renderVisual(PUZZLE_MAP.get('F023').visual).includes('data-interaction="order"'));
  assert.ok(renderVisual(PUZZLE_MAP.get('F001').visual).includes('<svg'));
});

test('正規化はカナ・全角英字・空白に対応し曖昧な誤答を通さない',()=>{
  assert.equal(normalize('  ＣＯＤＥ  '),'code');
  assert.ok(isCorrect(PUZZLE_MAP.get('F024'),'ＣＯＤＥ'));
  assert.ok(isCorrect(PUZZLE_MAP.get('F026'),'カ ギ ア ナ'));
  assert.equal(isCorrect(PUZZLE_MAP.get('F026'),'かぎあね'),false);
  assert.equal(isCorrect(PUZZLE_MAP.get('F024'),'cod'),false);
});

test('未見優先・重複なし・10問/20問/全数を正しく抽選',()=>{
  const d=freshData(),p=PUZZLES[0];assert.ok(unseen(p,d));
  d.records[p.id]={...freshRecord(),lastSeenAt:new Date().toISOString()};
  assert.ok(!unseen(p,d));
  const training=selectQuestions(PUZZLES,d,{mode:'training',count:100,random:()=>0.3});
  assert.equal(training.length,24);assert.equal(new Set(training.map(p=>p.id)).size,24);
  assert.equal(training.at(-1).id,p.id);
  const trial=selectQuestions(PUZZLES,d,{mode:'trial',count:10,random:()=>0.4});
  assert.equal(trial.length,10);assert.equal(trial.filter(p=>p.difficulty==='advanced').length,6);assert.equal(trial.filter(p=>p.difficulty==='expert').length,4);
  const assess=selectQuestions(PUZZLES,d,{mode:'assessment',count:20,random:()=>0.4});
  assert.equal(assess.length,20);assert.equal(assess.filter(p=>p.difficulty==='advanced').length,10);assert.equal(assess.filter(p=>p.difficulty==='expert').length,10);
  for(const q of PUZZLES)d.records[q.id]={...freshRecord(),lastSeenAt:new Date().toISOString()};
  assert.equal(selectQuestions(PUZZLES,d,{mode:'assessment',count:20}).length,0);
});

test('タイマーは絶対時刻方式、休止やリロードで時間延長されない',()=>{
  const d=freshData(),s=newSession(PUZZLES.slice(0,10),d,'trial',false);
  assert.equal(s.deadlineAt-s.startedAt,300000);
  assert.equal(getRemainingMs(s,s.startedAt+15000),285000);
  assert.equal(getRemainingMs(s,s.deadlineAt+10000),0);
  const a=newSession(PUZZLES.slice(0,20),d,'assessment',false);
  assert.equal(a.deadlineAt-a.startedAt,1200000);
  assert.equal(newSession(PUZZLES.slice(0,10),d,'training',false).deadlineAt,null);
});

test('初見無ヒントと復習後の正解を混同しない',()=>{
  const d=freshData(),s=newSession(PUZZLES.slice(0,2),d,'training',false);
  const a=s.answers[s.questionIds[0]];
  a.correct=true;a.submitted=true;a.attempts=2;a.firstSeen=true;a.hintsUsed=1;
  assert.equal(getScore(s),1);
  const sum=getSummary(s,false,s.startedAt+120000);
  assert.equal(sum.initialCorrect,0);assert.equal(sum.hintsUsedQuestions,1);assert.equal(sum.firstSeenAnswered,1);
});

test('復習カテゴリの判定は独立している',()=>{
  const r={...freshRecord(),everSkipped:true,bookmarked:true,maxHintsUsed:2,firstElapsedSec:91,attempts:[{at:'',answer:'x',correct:false,elapsedSec:91,mode:'training',firstForQuestion:true,hintsUsed:2}]};
  for(const type of ['wrong','hint','skip','bookmark','slow'])assert.ok(isReviewMatch(r,type),type);
  assert.equal(isReviewMatch(freshRecord(),'wrong'),false);
});

test('ローカル保存v1からv2へ既存成績を保持して移行し、記録を再保存',()=>{
  const items=new Map();
  globalThis.localStorage={getItem:k=>items.get(k)??null,setItem:(k,v)=>items.set(k,v),removeItem:k=>items.delete(k)};
  const old={version:1,records:{F001:{...freshRecord(),solved:true,bookmarked:true}},summaries:[],active:null};
  items.set(STORAGE_KEY,JSON.stringify(old));
  const migrated=loadData();assert.equal(migrated.version,2);
  assert.ok(migrated.records.F001.solved);assert.ok(migrated.records.F001.bookmarked);
  assert.ok(saveData(migrated));assert.equal(JSON.parse(items.get(STORAGE_KEY)).version,2);
});

test('HTMLインジェクションを防ぎ、生成したdocsは相対パスを参照',()=>{
  const html=renderVisual({kind:'cards',items:['<script>alert(1)</script>']});
  assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));
  for(const path of ['docs/index.html','docs/assets/main.js','docs/assets/style.css','docs/assets/data/challenges.js'])assert.ok(existsSync(join(root,path)),path);
  const entry=readFileSync(join(root,'docs/index.html'),'utf8');
  assert.ok(entry.includes('./assets/main.js')&&entry.includes('./assets/style.css'));
  assert.ok(!entry.includes('src="/src/main.ts"'));
});
