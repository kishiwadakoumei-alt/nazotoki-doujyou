export const CATEGORIES = [
  ['word', '文字・言葉'], ['number', '数字・規則性'], ['spatial', '図形・空間'],
  ['cipher', '暗号解読'], ['association', 'イラスト・連想'], ['observation', '観察力'],
  ['direction', '方向・位置'], ['japanese', 'かな・漢字'], ['logic', '論理パズル'],
  ['lateral', '発想の転換'], ['integration', '情報統合'], ['multistep', '多段階推理'],
] as const;
export type Category = typeof CATEGORIES[number][0];
export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export const DIFFICULTIES: {id: Difficulty; label: string; short: string}[] = [
  {id:'beginner', label:'初級',short:'LEVEL 01'},
  {id:'intermediate', label:'中級',short:'LEVEL 02'},
  {id:'advanced', label:'上級',short:'LEVEL 03'},
  {id:'expert', label:'超上級',short:'LEVEL 04'},
];
export type Visual =
  | { kind: 'cards'; items: string[]; columns?: number; caption?: string }
  | { kind: 'grid'; rows: string[][]; caption?: string }
  | { kind: 'lines'; lines: string[]; caption?: string }
  | { kind: 'path'; rows: string[][]; caption?: string }
  | { kind: 'svg'; body: string; caption?: string }
  | { kind: 'split'; panels: { heading: string; lines: string[] }[]; caption?: string }
  | { kind: 'text'; content: string }
  | { kind: 'composite'; panels: {heading: string; visual: Visual; note?: string}[]; caption?: string }
  | { kind: 'interaction'; task: 'select' | 'order' | 'rotate'; items: string[]; caption?: string };
export interface Puzzle {
  id: string;
  category: Category;
  difficulty: Difficulty;
  title: string;
  prompt: string;
  visual: Visual;
  answer: string;
  aliases: string[];
  hints: [string, string, string];
  explanation: { clue: string; steps: string; aha: string; transfer: string };
  visualRequired: boolean;
  /** 問題本文の変更履歴を追跡するための版。旧問題のIDは使い回さない。 */
  version?: number;
  skillTags?: string[];
  mechanism?: string;
  qualityStatus?: 'needs-playtest' | 'reviewed';
}
export type Mode = 'trial' | 'training' | 'assessment' | 'review';
export type ReviewFilter = 'wrong'|'hint'|'skip'|'bookmark'|'slow';
export interface Attempt {
  at: string; answer: string; correct: boolean; elapsedSec: number;
  mode: Mode; firstForQuestion: boolean; hintsUsed: number;
}
export interface QuestionRecord {
  firstAttemptAt: string | null;
  firstCorrect: boolean | null;
  attempts: Attempt[];
  maxHintsUsed: number;
  everSkipped: boolean;
  bookmarked: boolean;
  solved: boolean;
  firstElapsedSec: number | null;
  lastSeenAt: string | null;
}
export interface SessionAnswer {
  id: string; submitted: boolean; answer: string; correct: boolean;
  attempts: number; hintsUsed: number; skipped: boolean; spentSec: number;
  revealed: boolean; firstSeen: boolean; uiSelection?:number[]; uiRotation?:number;
}
export interface ActiveSession {
  id: string; mode: Mode; questionIds: string[]; index: number;
  answers: Record<string, SessionAnswer>;
  startedAt: number; deadlineAt: number|null;
  lastEntryAt: number; firstUnseenCount: number;
  isInfinite: boolean; totalSolved: number; lap?:number;
  category?: Category; difficulty?: Difficulty;
}
export interface SessionSummary {
  id: string; mode: Mode; endedAt: string; score: number; total: number;
  elapsedSec: number; initialUnseen: number; initialCorrect: number;
  firstSeenAnswered: number; hintsUsedQuestions: number;
  timeout: boolean;
  answers: SessionAnswer[];
}
export interface SavedData {
  version: 2; records: Record<string, QuestionRecord>;
  summaries: SessionSummary[];
  active: ActiveSession | null;
}
