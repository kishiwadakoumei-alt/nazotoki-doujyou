export const STORAGE_KEY = 'nazo-forge-v1';
export const freshData = () => ({ version: 2, records: {}, summaries: [], active: null });
export let storageIssue = '';
/** Corrupt or unknown-version records must never be overwritten. */
export let damagedSource = null;
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
function validActive(v) {
    if (!isObject(v))
        return false;
    if (!['trial', 'training', 'assessment', 'review'].includes(String(v.mode)))
        return false;
    if (!Array.isArray(v.questionIds) || v.questionIds.length < 1 || !v.questionIds.every(x => typeof x === 'string'))
        return false;
    if (!Number.isInteger(v.index) || v.index < 0 || v.index >= v.questionIds.length)
        return false;
    if (!Number.isFinite(v.startedAt) || !Number.isFinite(v.lastEntryAt))
        return false;
    if (v.deadlineAt !== null && !Number.isFinite(v.deadlineAt))
        return false;
    const answers = v.answers;
    if (!isObject(answers))
        return false;
    return v.questionIds.every(id => {
        const a = answers[id];
        return isObject(a) && a.id === id && typeof a.submitted === 'boolean' && typeof a.correct === 'boolean' && typeof a.answer === 'string' && Number.isFinite(a.attempts) && Number.isFinite(a.spentSec) && Number.isFinite(a.hintsUsed);
    });
}
export function loadData() {
    let raw = null;
    try {
        raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return freshData();
        const v = JSON.parse(raw);
        if (!isObject(v) || ![1, 2].includes(Number(v.version)) || !isObject(v.records) || !Array.isArray(v.summaries))
            throw new Error('invalid version / structure');
        if (!v.summaries.every(x => isObject(x) && typeof x.mode === 'string' && Array.isArray(x.answers) && Number.isFinite(x.score) && Number.isFinite(x.total)))
            throw new Error('invalid summaries');
        if (!Object.values(v.records).every(r => isObject(r) && Array.isArray(r.attempts) && typeof r.bookmarked === 'boolean' && typeof r.solved === 'boolean' && typeof r.everSkipped === 'boolean'))
            throw new Error('invalid records');
        const data = { ...v, version: 2 };
        if (v.version === 1)
            storageIssue = '既存の学習記録を新形式へ移行しました。過去の回答履歴は保持されています。';
        damagedSource = null;
        if (data.active && !validActive(data.active)) {
            data.active = null;
            storageIssue = '前回のプレイ状態が破損していたため破棄しました。保存済みの解答記録は保持しています。';
        }
        return data;
    }
    catch {
        damagedSource = raw;
        storageIssue = '保存済みデータが読み込めませんでした。元データを保護し、新しい記録はメモリ上で開始しています。「元データを保存」からJSONを退避できます。';
        return freshData();
    }
}
export function saveData(data) {
    if (damagedSource !== null)
        return false;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return true;
    }
    catch {
        storageIssue = 'ブラウザの保存領域を使用できません。今回の記録はページを閉じると消える可能性があります。';
        return false;
    }
}
