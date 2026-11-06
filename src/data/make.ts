import type {Category,Difficulty,Puzzle,Visual} from '../types';
export type PuzzleRow = [
  id:string, category:Category, title:string, prompt:string, visual:Visual,
  answer:string, hints:[string,string,string],
  explanation:[string,string,string,string],
  aliases?:string[], visualRequired?:boolean
];
export function make(difficulty:Difficulty, rows:PuzzleRow[]):Puzzle[]{
  return rows.map(([id,category,title,prompt,visual,answer,hints,[clue,steps,aha,transfer],aliases=[],visualRequired=true])=>({
    id,category,difficulty,title,prompt,visual,answer,aliases,hints,
    explanation:{clue,steps,aha,transfer}, visualRequired
  }));
}
