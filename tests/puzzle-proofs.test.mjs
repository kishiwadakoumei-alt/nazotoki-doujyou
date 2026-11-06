import test from 'node:test';
import assert from 'node:assert/strict';
import {challenges} from '../docs/assets/data/challenges.js';
const PUZZLE_MAP=new Map(challenges.map(p=>[p.id,p]));
const get=id=>{const p=PUZZLE_MAP.get(id);assert.ok(p,`missing ${id}`);return p;};
const grid=(id,i=0)=>{const v=get(id).visual;if(v.kind==='grid'||v.kind==='path')return v.rows;assert.equal(v.kind,'composite');return v.panels[i].visual.rows;};
const answer=(id,x)=>assert.equal(x,get(id).answer,`問題 ${id} の導出結果と登録正答が異なる`);
const perms=xs=>xs.length?xs.flatMap((x,i)=>perms(xs.filter((_,j)=>j!==i)).map(rest=>[x,...rest])):[[]];

test('F002 回転→反転→斜め抽出が正答と一致',()=>{
  const a=grid('F002');const n=a.length;
  const clockwise=Array.from({length:n},(_,y)=>Array.from({length:n},(_,x)=>a[n-1-x][y]));
  const mirrored=clockwise.map(row=>row.toReversed());
  answer('F002',[mirrored[2][0],mirrored[1][1],mirrored[0][2]].join(''));
});

test('F003 / F016 透明板の穴交差と文字の一致',()=>{
  for(const [id,shift] of [['F003',0],['F016',1]]){
    const panels=get(id).visual.panels;
    const a=panels[0].visual.rows,b=panels[1].visual.rows,letters=panels[2].visual.rows;
    let s='';for(let r=0;r<a.length;r++)for(let c=0;c<a[r].length;c++){
      const v=id==='F003'?b[a.length-1-r][a[r].length-1-c]:b[r][c-shift];
      if(a[r][c]===(id==='F003'?'○':'●')&&v===(id==='F003'?'○':'●'))s+=letters[r][c];
    }
    answer(id,s);
  }
});

test('F004 / F025 真偽を全候補検証すると唯一解',()=>{
  const options='ABCD';const truth=target=>[
    target==='A',['A','B'].includes(target),['A','C'].includes(target),!['A','B'].includes(target)
  ];
  assert.deepEqual(options.split('').map(x=>truth(x).filter(Boolean).length),[3,1,2,1]);
  assert.deepEqual(options.split('').filter(x=>truth(x).filter(Boolean).length===2),['C']);
  const board=get('F004').visual.panels[2].visual.rows;
  answer('F004',board[1][3]+board[0][2]);
  const satisfying=[];
  for(let flags=0;flags<32;flags++){
    const [a,b,c,d,e]=Array.from({length:5},(_,i)=>(flags>>i)&1);
    if(a+b+c+d+e===2 && a!==b && b!==c && d===e)satisfying.push([a,b,c,d,e]);
  }
  assert.deepEqual(satisfying,[[1,0,1,0,0]]);
  const letters=get('F025').visual.panels[2].visual.rows;
  answer('F025',letters[0][3]+letters[1][1]);
});

test('F007/F024 方位つき5ビットの復号が正答と一致',()=>{
  for(const id of ['F007','F024']){
    const lines=get(id).visual.panels[0].visual.lines;
    const chars=lines.map(x=>{
      const bits=[...x].filter(c=>['●','○','■','□'].includes(c)).map(c=>'●■'.includes(c)?'1':'0');
      const sorted=x.includes('←')?bits.toReversed():bits;
      const n=parseInt(sorted.join(''),2);return String.fromCharCode(64+n);
    });answer(id,chars.join('').toLowerCase());
  }
});

test('F008 折り線の対称位置を4地点に戻す',()=>{
  const a=grid('F008');
  answer('F008',[[0,1],[0,2],[3,2],[3,1]].map(([r,c])=>a[r][c]).join(''));
});

test('F009 一本道の全マス移動、角だけ抽出が整合',()=>{
  const a=get('F009').visual.rows;
  const points=a.flatMap((r,y)=>r.flatMap((v,x)=>v!=='■'?[[y,x]]:[]));
  const start=points.find(([y,x])=>a[y][x]==='S');const end=points.find(([y,x])=>a[y][x]==='G');
  const paths=[];function dfs(path,seen){
    const [y,x]=path.at(-1);if(y===end[0]&&x===end[1]){paths.push(path);return;}
    for(const [dy,dx] of [[0,1],[1,0],[0,-1],[-1,0]]){const yy=y+dy,xx=x+dx,key=`${yy}:${xx}`;if(!seen.has(key)&&a[yy]?.[xx]&&a[yy][xx]!=='■'){dfs([...path,[yy,xx]],new Set([...seen,key]));}}
  }
  dfs([start],new Set([start.join(':')]));assert.equal(paths.length,1);
  const path=paths[0];let turns='';for(let i=1;i<path.length-1;i++){
    const prev=[path[i][0]-path[i-1][0],path[i][1]-path[i-1][1]];
    const next=[path[i+1][0]-path[i][0],path[i+1][1]-path[i][1]];
    if(prev.join()!=next.join())turns+=a[path[i][0]][path[i][1]];
  }answer('F009',turns);
});

test('F010 F014 F019 の数式と6×6ナンバープレースの唯一解',()=>{
  answer('F010',String(4*(7+4)));
  const raw=grid('F014');assert.equal(raw.length,6);
  const given=raw.map(row=>row.map(x=>/^\d$/.test(x)?Number(x):0));
  const solutions=[];
  function solve(){
    if(solutions.length>1)return;
    let best=null;
    for(let r=0;r<6;r++)for(let c=0;c<6;c++)if(!given[r][c]){
      const occupied=new Set([...given[r],...given.map(x=>x[c]),...given.slice(Math.floor(r/2)*2,Math.floor(r/2)*2+2).flatMap(x=>x.slice(Math.floor(c/3)*3,Math.floor(c/3)*3+3))]);
      const possible=[1,2,3,4,5,6].filter(n=>!occupied.has(n));
      if(!possible.length)return;
      if(!best||possible.length<best.possible.length)best={r,c,possible};
    }
    if(!best){solutions.push(given.map(row=>row.slice()));return;}
    for(const v of best.possible){given[best.r][best.c]=v;solve();given[best.r][best.c]=0;if(solutions.length>1)return;}
  }
  solve();assert.equal(solutions.length,1,'6×6ナンバープレースが唯一に定まらない');
  const solved=solutions[0];const chars=['','あ','か','み','ぎ','な','つ'];
  answer('F014',[[0,1],[1,0],[2,5],[3,0]].map(([r,c])=>chars[solved[r][c]]).join(''));
  answer('F019',String(6+4-5+3*4));
});

test('F011 監視記録の差分座標→文字抽出',()=>{
  const [baseline,records,pad]=get('F011').visual.panels.map(x=>x.visual);
  const target=baseline.lines[0].replaceAll(' ','');
  const text=records.lines.map((line,r)=>{
    const actual=line.split('：')[1].replaceAll(' ','');
    const changes=[...actual].flatMap((x,i)=>x!==target[i]?[i]:[]);
    assert.equal(changes.length,1);
    return pad.rows[r][changes[0]];
  }).join('');answer('F011',text);
});

test('F013 方向と◆の位置で一意な順序が決まる',()=>{
  const lines=get('F013').visual.panels[0].visual.lines;
  const vals=lines.map(line=>{
    const chars=[...line.slice(2)].filter(x=>x!==' ');
    const p=chars.indexOf('◆');return {index:p, char:line.includes('→')?chars[p+1]:chars[p-1]};
  });
  assert.deepEqual(vals.map(v=>v.index).toSorted(),[0,1,2,3]);
  answer('F013',vals.toSorted((a,b)=>a.index-b.index).map(x=>x.char).join(''));
});

test('F016 重複位置補正、F020 日付ソート→座標の統合',()=>{
  const p=get('F020').visual.panels;
  const grid=p[2].visual.rows;
  const co={ミナ:[2,3],レイ:[1,2],ユウ:[3,1]};
  const order=['レイ','ユウ','ミナ'];
  answer('F020',order.map(n=>{const [r,c]=co[n];return grid[r-1][c-1]}).join(''));
});

test('F017 F023 F028 順序制約の全順列検証',()=>{
  const a=perms(['A','B','C','D','E']).filter(o=>o.indexOf('B')===o.indexOf('A')+1&&o.at(-1)==='C'&&o.indexOf('D')>o.indexOf('B')&&o.indexOf('D')<o.indexOf('C')&&o.indexOf('E')<o.indexOf('A'));
  assert.deepEqual(a,[['E','A','B','D','C']]);answer('F017',a[0].map(k=>({E:'ひ',A:'み',B:'つ',D:'ば',C:'こ'})[k]).join(''));
  const b=perms(['ほ','し','の','か','け','ら']).filter(o=>o.indexOf('か')===o.indexOf('し')+2&&o.indexOf('け')===o.indexOf('か')+1&&o.indexOf('し')===o.indexOf('ほ')+1&&o.indexOf('の')===o.indexOf('か')-1&&o.at(-1)==='ら');
  assert.deepEqual(b,[['ほ','し','の','か','け','ら']]);answer('F023',b[0].join(''));
  const c=perms(['青','赤','緑','黄','白','黒']).filter(o=>o.indexOf('緑')===o.indexOf('赤')+1&&o.indexOf('赤')===o.indexOf('黄')+1&&o.at(-1)==='黒'&&o.indexOf('白')>o.indexOf('青')&&o.indexOf('白')<o.indexOf('黒')&&o.indexOf('青')===o.indexOf('緑')+1);
  assert.deepEqual(c,[['黄','赤','緑','青','白','黒']]);
  const pad=get('F028').visual.panels[2].visual.rows;
  const coord={'黄':[1,2],'緑':[2,3],'青':[3,1],'黒':[4,4]};
  answer('F028',[0,2,3,5].map(i=>{const [r,col]=coord[c[0][i]];return pad[r-1][col-1];}).join(''));
});

test('F018 連立符号と字表を総当たりで復号',()=>{
  const cases=perms([1,2,3,4]).filter(([t,o,s,g])=>t+o===5&&o+s===6&&t+s===3);
  assert.deepEqual(cases,[[1,4,2,3]]);
  const [t,o,s,g]=cases[0],letters=['','あ','か','な','ぎ'];
  answer('F018',[s,o,t,g].map(n=>letters[n]).join(''));
});

test('F021 斜め方位変換とF026 形状座標を検証',()=>{
  const b=grid('F021');answer('F021',b[2][2]+b[3][1]);
  const c=get('F026').visual.panels[1].visual.rows;
  answer('F026',[[3,2],[4,4],[5,1],[6,5]].map(([corners,dots])=>c[corners-3][dots-1]).join(''));
});

test('F029/F030 独立資料の結合を検算',()=>{
  const c={26:'ひ',21:'み',10:'つ'};
  answer('F029',[17+9,21,3+4+3].map(n=>c[n]).join(''));
  const b=grid('F030',2);answer('F030',[[2,1],[3,2],[1,3]].map(([r,c])=>b[r-1][c-1]).join(''));
});
