import { CATEGORIES, DIFFICULTIES } from './types.js';
export function normalize(input) {
    return input.normalize('NFKC').toLowerCase().replace(/[\s\u3000]/gu, '').replace(/[ァ-ヶ]/gu, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}
export function isCorrect(p, answer) {
    const a = normalize(answer);
    return a !== '' && [p.answer, ...p.aliases].some(v => normalize(v) === a);
}
export function shuffle(arr, random = Math.random) {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}
export function freshRecord() { return { firstAttemptAt: null, firstCorrect: null, attempts: [], maxHintsUsed: 0, everSkipped: false, bookmarked: false, solved: false, firstElapsedSec: null, lastSeenAt: null }; }
export function unseen(p, data) { return !data.records[p.id]?.firstAttemptAt && !data.records[p.id]?.lastSeenAt && !data.records[p.id]?.everSkipped; }
export function selectQuestions(puzzles, data, opts) {
    const rand = opts.random || Math.random;
    let pool = puzzles.filter(p => (!opts.difficulty || p.difficulty === opts.difficulty) && (!opts.category || p.category === opts.category));
    if (opts.mode === 'review')
        pool = pool.filter(p => isReviewMatch(data.records[p.id], opts.review || 'wrong'));
    const first = shuffle(pool.filter(p => unseen(p, data)), rand);
    if (opts.mode === 'assessment') {
        // 初見の正答率を守るため、既出問題の補充はしない。
        const quotas = { beginner: 4, intermediate: 6, advanced: 6, expert: 4 };
        const chosen = [];
        for (const d of DIFFICULTIES) {
            chosen.push(...first.filter(p => p.difficulty === d.id).slice(0, quotas[d.id]));
        }
        const ids = new Set(chosen.map(p => p.id));
        chosen.push(...first.filter(p => !ids.has(p.id)).slice(0, Math.max(0, opts.count - chosen.length)));
        return shuffle(chosen.slice(0, opts.count), rand);
    }
    if (opts.mode === 'trial') {
        const desired = { beginner: 3, intermediate: 4, advanced: 3, expert: 0 };
        const chosen = [];
        for (const d of DIFFICULTIES.slice(0, 3)) {
            const level = shuffle(pool.filter(p => p.difficulty === d.id), rand);
            const ordered = [...level.filter(p => unseen(p, data)), ...level.filter(p => !unseen(p, data))];
            chosen.push(...ordered.slice(0, desired[d.id]));
        }
        return shuffle(chosen, rand);
    }
    const seen = shuffle(pool.filter(p => !unseen(p, data)), rand);
    return [...first, ...seen].slice(0, opts.count);
}
export function isReviewMatch(r, filter) {
    if (!r)
        return false;
    switch (filter) {
        case 'wrong': return r.attempts.some(a => !a.correct);
        case 'hint': return r.maxHintsUsed > 0;
        case 'skip': return r.everSkipped;
        case 'bookmark': return r.bookmarked;
        case 'slow': return r.firstElapsedSec !== null && r.firstElapsedSec >= 90;
    }
}
export function newSession(puzzles, data, mode, infinite, options) {
    const now = Date.now();
    const answers = {};
    puzzles.forEach(p => answers[p.id] = { id: p.id, submitted: false, answer: '', correct: false, attempts: 0, hintsUsed: 0, skipped: false, spentSec: 0, revealed: false, firstSeen: unseen(p, data) });
    const deadlineAt = mode === 'trial' ? now + 5 * 60_000 : mode === 'assessment' ? now + 20 * 60_000 : null;
    return { id: `s-${now}-${Math.random().toString(36).slice(2, 7)}`, mode, questionIds: puzzles.map(p => p.id), index: 0, answers, startedAt: now, deadlineAt, lastEntryAt: now, firstUnseenCount: puzzles.filter(p => unseen(p, data)).length, isInfinite: infinite, totalSolved: 0, ...options };
}
export function getRemainingMs(session, now = Date.now()) { return session.deadlineAt === null ? null : Math.max(0, session.deadlineAt - now); }
export function getScore(session) { return Object.values(session.answers).filter(a => a.correct).length; }
export function getSummary(session, timeout = false, now = Date.now()) {
    const answers = Object.values(session.answers);
    const seen = answers.filter(a => a.firstSeen && a.attempts > 0);
    return { id: session.id, mode: session.mode, endedAt: new Date(now).toISOString(), score: getScore(session), total: session.questionIds.length, elapsedSec: Math.round((Math.min(now, session.deadlineAt || now) - session.startedAt) / 1000), initialUnseen: session.firstUnseenCount, initialCorrect: seen.filter(a => a.correct && a.attempts === 1 && a.hintsUsed === 0).length, firstSeenAnswered: seen.length, hintsUsedQuestions: answers.filter(a => a.hintsUsed > 0).length, timeout, answers: answers.map(a => ({ ...a })) };
}
export function categoryLabel(c) { return CATEGORIES.find(x => x[0] === c)[1]; }
export function difficultyLabel(d) { return DIFFICULTIES.find(x => x.id === d).label; }
export function duration(sec) { const s = Math.max(0, Math.round(sec)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
