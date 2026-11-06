import {challenges} from './challenges';
/** Quality gate: short, direct-extraction exercises are not included in the playable pool. */
export const DEFERRED_IDS=['F005','F006','F010','F012','F029','F030'] as const;
const deferred=new Set<string>(DEFERRED_IDS);
export const PUZZLES=challenges.filter(p=>!deferred.has(p.id)).sort((a,b)=>a.id.localeCompare(b.id));
export const PUZZLE_MAP=new Map(PUZZLES.map(p=>[p.id,p]));
