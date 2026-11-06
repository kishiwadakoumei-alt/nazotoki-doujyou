import test from 'node:test';
import assert from 'node:assert/strict';
import {challenges} from '../docs/assets/data/challenges.js';
const PUZZLE_MAP=new Map(challenges.map(p=>[p.id,p]));
const get=id=>{const p=PUZZLE_MAP.get(id);assert.ok(p,id);return p;};
const check=(id,answer)=>assert.equal(answer,get(id).answer,id);

test('F001 SVGに実在するマス目・4矢印の移動が解答と一致',()=>{
  const p=get('F001');assert.equal(p.visual.kind,'svg');
  const regex=/<text x="(\d+)" y="(\d+)" text-anchor="middle" font-size="23" fill="#f4edff">([^<]+)<\/text>/g;
  const cells=new Map();
  for(const m of p.visual.body.matchAll(regex))cells.set(`${(Number(m[2])-41)/43}:${(Number(m[1])-40)/43}`,m[3]);
  assert.equal(cells.size,25);
  let r=3,c=1,text='';
  for(const [dr,dc] of [[-1,0],[0,2],[1,0],[0,-2]]){r+=dr;c+=dc;text+=cells.get(`${r}:${c}`);}
  check('F001',text);
});

test('F006 時刻の境界条件で唯一の列車が残り、逆読みになる',()=>{
  const p=get('F006');const trains=p.visual.panels[1].visual.panels;
  const valid=trains.filter(t=>{
    const m=t.lines[0].match(/発 (\d\d):(\d\d) \/ 着 (\d\d):(\d\d)/);
    assert.ok(m);
    return Number(m[1])*60+Number(m[2])>=9*60+15 && Number(m[3])*60+Number(m[4])<9*60+30;
  });
  assert.equal(valid.length,1);
  check('F006',[...valid[0].lines[1].split('：')[1]].reverse().join(''));
});

test('F012 図形の角数と点数→行列座標で秘密を復号',()=>{
  const p=get('F012').visual.panels;
  const board=p[1].visual.rows;
  const corners={'△':3,'□':4};
  const result=p[0].visual.items.map(item=>{
    const [shape]=[...item];const dots=([...(item.split('　')[0].match(/・/g)||[])]).length;
    return board[corners[shape]-1][dots-1];
  }).join('');
  check('F012',result);
});

test('F015 すべての単純経路を列挙して一意の最短路を導く',()=>{
  const p=get('F015').visual.panels;
  const edges=new Map();
  for(const line of p[0].visual.lines)for(const m of line.matchAll(/([SABCDG])－(\d+)－([SABCDG])/g)){
    const [_,a,wt,b]=m;
    for(const [u,v] of [[a,b],[b,a]])edges.set(u,[...(edges.get(u)||[]),{v,w:Number(wt)}]);
  }
  const paths=[];
  function visit(at,seen,cost,route){
    if(at==='G'){paths.push({cost,route});return;}
    for(const e of edges.get(at)||[])if(!seen.includes(e.v))visit(e.v,[...seen,e.v],cost+e.w,[...route,e.v]);
  }
  visit('S',['S'],0,['S']);
  const min=Math.min(...paths.map(x=>x.cost)),best=paths.filter(x=>x.cost===min);
  assert.equal(best.length,1);assert.deepEqual(best[0].route,['S','A','C','D','G']);
  const letters=Object.fromEntries(p[1].visual.items.map(s=>s.split('：')));
  check('F015',best[0].route.slice(1,-1).map(id=>letters[id]).join(''));
});

test('F027 枠・イラスト名・点数を独立に変換し順番通り連結',()=>{
  const cards=get('F027').visual.panels[0].visual.items;
  const shapes={'△':3,'□':4,'⬟':5};
  const names={'🕰':'とけい','🦐':'えび','🐪':'らくだ'};
  const tokens=cards.map(item=>{
    const [shape,emoji,dots]=item.split('　');const raw=emoji.replaceAll('️','');
    assert.ok(names[raw],item);
    const index=[...dots].filter(x=>x==='・').length-1;
    return {order:shapes[shape],char:Array.from(names[raw])[index]};
  });
  assert.equal(tokens.length,3);
  check('F027',tokens.sort((a,b)=>a.order-b.order).map(x=>x.char).join(''));
});

test('F030 時刻条件で列車を特定して座標3個を文字盤で読む',()=>{
  const pan=get('F030').visual.panels,grid=pan[2].visual.rows;
  const after=14*60+5,before=14*60+25;
  const candidates=pan[1].visual.lines.map(line=>{
    const m=line.match(/^([A-D])：(\d\d):(\d\d)→(\d\d):(\d\d) \/ (.+)$/);
    assert.ok(m,line);
    return {id:m[1],from:Number(m[2])*60+Number(m[3]),to:Number(m[4])*60+Number(m[5]),coords:m[6].split('・')};
  }).filter(x=>x.from>=after&&x.to<=before);
  assert.equal(candidates.length,1);
  check('F030',candidates[0].coords.map(x=>grid[Number(x[0])-1][Number(x[1])-1]).join(''));
});
