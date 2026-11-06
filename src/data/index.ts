import {beginner} from './beginner';
import {intermediate} from './intermediate';
import {advanced} from './advanced';
import {expert} from './expert';
import {curated} from './curated';
// 難易度ごとに収録した問題と、品質改善後の問題を一つの問題集に統合。
export const PUZZLES=[...beginner,...intermediate,...advanced,...expert,...curated]
  .sort((a,b)=>a.id.localeCompare(b.id));
export const PUZZLE_MAP=new Map(PUZZLES.map(p=>[p.id,p]));
