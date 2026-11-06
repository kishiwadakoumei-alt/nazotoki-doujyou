import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
import {PUZZLES,PUZZLE_MAP} from '../docs/assets/data/index.js';
import {CATEGORIES,DIFFICULTIES} from '../docs/assets/types.js';
import {normalize,isCorrect,freshRecord,unseen,selectQuestions,newSession,getScore,getRemainingMs,getSummary,shuffle,isReviewMatch} from '../docs/assets/engine.js';
import {freshData} from '../docs/assets/storage.js';
import {renderVisual} from '../docs/assets/visuals.js';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const counts = Object.fromEntries(DIFFICULTIES.map(d=>[d.id,PUZZLES.filter(p=>p.difficulty===d.id).length]));
test('問題100問を正確な難易度配分で収録している',()=>{
  assert.equal(PUZZLES.length,100);
  assert.equal(PUZZLE_MAP.size,100);
  assert.deepEqual(counts,{beginner:20,intermediate:30,advanced:30,expert:20});
  for(const [id] of CATEGORIES)assert.ok(PUZZLES.some(p=>p.category===id),`ジャンル不足: ${id}`);
});
test('全問題に正答・3段階ヒント・4パート解説があり、描画形式が正しい',()=>{
  const validKinds=['cards','grid','lines','path','svg','split','text','interaction'];
  for(const p of PUZZLES){
    assert.match(p.id,/^[BIAE]\d\d$/);
    assert.ok(CATEGORIES.some(c=>c[0]===p.category),p.id);
    assert.ok(typeof p.title==='string'&&p.title.length>=2,p.id);
    assert.ok(typeof p.prompt==='string'&&p.prompt.length>=6,p.id);
    assert.ok(typeof p.answer==='string'&&p.answer.length>0,p.id);
    assert.equal(p.hints.length,3,p.id);
    for(const hint of p.hints)assert.ok(hint.trim().length>=3,`ヒント不足: ${p.id}`);
    for(const part of ['clue','steps','aha','transfer'])assert.ok(p.explanation[part]?.trim().length>=3,`解説不足: ${p.id}/${part}`);
    assert.ok(validKinds.includes(p.visual.kind),p.id);
    assert.ok(isCorrect(p,p.answer),`正答が不正: ${p.id}`);
    for(const a of p.aliases)assert.ok(isCorrect(p,a),`許容回答が判定できない: ${p.id}`);
    assert.ok(renderVisual(p.visual).startsWith('<figure'),p.id);
  }
});
test('視覚レイアウトの理解が必要な出題形式が半数を上回る',()=>{
  const visual=PUZZLES.filter(p=>['grid','path','svg','interaction','split'].includes(p.visual.kind));
  assert.ok(visual.length>=50,`視覚出題形式: ${visual.length}/100`);
});
test('仮名・英字・全角半角・空白の正規化と厳格照合',()=>{
  const p=PUZZLES.find(q=>q.id==='B01');
  assert.ok(isCorrect(p,'ホシゾラ'));
  assert.ok(isCorrect(p,'  ほ　し ぞ ら  '));
  assert.equal(normalize('  ＣＡＴ  '),'cat');
  assert.ok(isCorrect(PUZZLES.find(q=>q.id==='I27'),'ＣＡＴ'));
  assert.equal(isCorrect(p,'ほし'),false);
  assert.equal(isCorrect(p,'ほしぞろ'),false);
});
test('未見優先と問題重複制御',()=>{
  const d=freshData(),p=PUZZLES.find(q=>q.id==='B01');
  assert.equal(unseen(p,d),true);
  d.records[p.id]={...freshRecord(),lastSeenAt:new Date().toISOString()};
  assert.equal(unseen(p,d),false,'一度表示した問題は初見に戻らない');
  const selected=selectQuestions(PUZZLES,d,{mode:'training',count:100,random:()=>0.5});
  assert.equal(selected.length,100);
  assert.equal(new Set(selected.map(x=>x.id)).size,100);
  assert.equal(selected.at(-1).id,p.id,'既見を後回しにする');
});
test('実力測定は初見限定、トライアルは初級3・中級4・上級3',()=>{
  const d=freshData();
  const assessment=selectQuestions(PUZZLES,d,{mode:'assessment',count:20,random:()=>0.7});
  assert.equal(assessment.length,20);
  assert.equal(new Set(assessment.map(p=>p.id)).size,20);
  const trial=selectQuestions(PUZZLES,d,{mode:'trial',count:10,random:()=>0.5});
  assert.equal(trial.length,10);
  assert.deepEqual({beginner:trial.filter(p=>p.difficulty==='beginner').length,intermediate:trial.filter(p=>p.difficulty==='intermediate').length,advanced:trial.filter(p=>p.difficulty==='advanced').length},{beginner:3,intermediate:4,advanced:3});
  for(const p of PUZZLES)d.records[p.id]={...freshRecord(),lastSeenAt:new Date().toISOString()};
  assert.equal(selectQuestions(PUZZLES,d,{mode:'assessment',count:20}).length,0,'既見は実力測定に混ぜない');
});
test('時間制限は絶対時刻で進む・更新によって延長しない',()=>{
  const d=freshData(),s=newSession(PUZZLES.slice(0,10),d,'trial',false);
  assert.equal(s.deadlineAt-s.startedAt,300_000);
  assert.equal(getRemainingMs(s,s.startedAt+15_000),285_000);
  assert.equal(getRemainingMs(s,s.deadlineAt+10_000),0);
  const a=newSession(PUZZLES.slice(0,20),d,'assessment',false);
  assert.equal(a.deadlineAt-a.startedAt,1_200_000);
  assert.equal(newSession(PUZZLES.slice(0,10),d,'training',false).deadlineAt,null);
});
test('初見の解答と練習の正解を混同しない',()=>{
  const d=freshData(),s=newSession(PUZZLES.slice(0,2),d,'training',false);
  const a=s.answers[s.questionIds[0]];
  a.correct=true;a.submitted=true;a.attempts=2;a.firstSeen=true;a.hintsUsed=1;
  assert.equal(getScore(s),1);
  const sum=getSummary(s,false,s.startedAt+120_000);
  assert.equal(sum.score,1);
  assert.equal(sum.initialCorrect,0);
  assert.equal(sum.hintsUsedQuestions,1);
  assert.equal(sum.firstSeenAnswered,1);
});
test('復習の抽出条件が互いに独立する',()=>{
  const r={...freshRecord(),everSkipped:true,bookmarked:true,maxHintsUsed:2,firstElapsedSec:91,attempts:[{at:'',answer:'x',correct:false,elapsedSec:91,mode:'training',firstForQuestion:true,hintsUsed:2}]};
  for(const type of ['wrong','hint','skip','bookmark','slow']) assert.ok(isReviewMatch(r,type),type);
  assert.equal(isReviewMatch(freshRecord(),'wrong'),false);
});
test('HTMLのエスケープと全表示形式のコンテンツ生成',()=>{
  assert.ok(renderVisual({kind:'cards',items:['<script>alert(1)</script>']}).includes('&lt;script&gt;'));
  assert.ok(!renderVisual({kind:'cards',items:['<script>alert(1)</script>']}).includes('<script>'));
  for(const p of PUZZLES){
    const html=renderVisual(p.visual,{uiSelection:[],uiRotation:0});
    assert.ok(html.length>25,p.id);
    assert.ok(!html.includes('undefined'),p.id);
  }
});
test('GitHub Pages用の静的生成物が存在し、相対参照になっている',()=>{
  assert.ok(existsSync(join(root,'docs/index.html')));
  assert.ok(existsSync(join(root,'docs/assets/main.js')));
  assert.ok(existsSync(join(root,'docs/assets/style.css')));
  const html=readFileSync(join(root,'docs/index.html'),'utf8');
  assert.ok(html.includes('./assets/main.js'));
  assert.ok(html.includes('./assets/style.css'));
  assert.ok(!html.includes('src="/src/main.ts"'));
});
test('既知の矛盾を修正し、図と手順の整合性を固定',()=>{
  assert.equal(PUZZLE_MAP.get('I04').answer,'はなび');
  assert.match(PUZZLE_MAP.get('I04').explanation.steps,/1→び/);
  assert.match(PUZZLE_MAP.get('I07').explanation.steps,/ひみつ/);
  assert.match(PUZZLE_MAP.get('I23').prompt,/6つ/);
  assert.equal(PUZZLE_MAP.get('A06').answer,'21');
  assert.equal(PUZZLE_MAP.get('E05').answer,'かぎあな');
});
