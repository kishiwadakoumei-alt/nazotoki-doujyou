
import { CATEGORIES, DIFFICULTIES } from './types.js';
import { PUZZLES, PUZZLE_MAP } from './data/index.js';
import { duration, difficultyLabel, categoryLabel, freshRecord, getRemainingMs, getScore, getSummary, isCorrect, isReviewMatch, newSession, selectQuestions, unseen } from './engine.js';
import { escapeHtml as esc, renderVisual } from './visuals.js';
import { freshData, loadData, saveData, storageIssue } from './storage.js';
const root = document.getElementById('app');
let data = loadData();
let page = data.active ? 'play' : 'home';
let setupMode = 'trial';
let cfg = { count: 10, difficulty: '', category: '', review: 'wrong' };
let lastSummary = null;
let setupError = '';
let feedback = null;
let revealResultAll = false;
let renderScroll = false;
const $ = (selector) => document.querySelector(selector);
const tr = (v) => esc(String(v));
const getRec = (id) => data.records[id] ?? (data.records[id] = freshRecord());
const getActive = () => data.active;
const currentPuzzle = () => { const s = getActive(); return s ? PUZZLE_MAP.get(s.questionIds[s.index]) : undefined; };
const percentage = (v, n) => n > 0 ? Math.round(v / n * 100) : 0;
const sessionLabel = (m) => ({ trial: '謎解きトライアル', training: '自由トレーニング', assessment: '実力測定', review: '復習モード' }[m]);
const modeIcon = (m) => ({ trial: '⏱', training: '◇', assessment: '⌁', review: '↻' }[m]);
const levelTag = (d) => ({ beginner: '初級', intermediate: '中級', advanced: '上級', expert: '超上級' }[d]);
const accuracy = (puzzles) => {
    const seen = puzzles.map(p => data.records[p.id]).filter(r => r && r.firstCorrect !== null);
    return { seen: seen.length, correct: seen.filter(r => r.firstCorrect).length, pct: percentage(seen.filter(r => r.firstCorrect).length, seen.length) };
};
const safeSave = () => { saveData(data); };
function shell(body) {
    const session = data.active;
    return `<div class="app-shell">
  <header class="site-header"><div class="header-inner">
    <button type="button" data-action="home" class="brand" aria-label="ホームに戻る"><span class="brand-mark"><span></span></span><span class="brand-text">NAZO<span>FORGE</span><small>PUZZLE TRAINING LAB</small></span></button>
    <nav class="global-nav" aria-label="メインメニュー"><button data-action="home" class="nav-link ${page === 'home' ? 'is-active' : ''}">ホーム</button><button data-action="stats" class="nav-link ${page === 'stats' ? 'is-active' : ''}">能力分析</button>${session ? `<button data-action="resume" class="nav-resume">${page === 'play' ? 'プレイ中' : 'プレイを再開'} <span class="resume-dot"></span></button>` : ''}</nav>
  </div></header>
  <main class="page-wrap">${storageIssue ? `<div class="storage-warning" role="status">${tr(storageIssue)}</div>` : ''}${body}</main>
  <footer class="site-footer"><span>NAZO FORGE <span class="footer-split">/</span> YOUR MIND IS THE KEY.</span><span>100 ORIGINAL PUZZLES · LOCAL DATA ONLY</span></footer>
  </div>`;
}
function home() {
    const totalDone = PUZZLES.filter(p => data.records[p.id]?.solved).length;
    const initial = accuracy(PUZZLES);
    const lastAssess = data.summaries.find(s => s.mode === 'assessment');
    return `<div class="home-page"><section class="hero"><div class="hero-copy">
    <div class="eyebrow"><span class="eyebrow-dot"></span> THINK DIFFERENT. FIND THE ANSWER.</div>
    <h1>謎を解く。<br><span class="gradient-text">閃きを、鍛える。</span></h1>
    <p class="hero-lead">観察、ひらめき、論理、そして情報のつながり。<br>リアル脱出ゲームで役立つ「初見で解き切る力」を、100問のオリジナル謎で育てよう。</p>
    <div class="hero-buttons"><button data-action="pick-mode" data-mode="trial" class="primary-btn">5分のトライアルに挑む <span>↗</span></button><button data-action="pick-mode" data-mode="training" class="secondary-btn">自由にトレーニング <span>→</span></button></div>
    <div class="hero-features"><span><i></i> 12ジャンル</span><span><i></i> 4段階の難易度</span><span><i></i> 学習記録を保存</span></div>
  </div><div class="hero-art"><div class="art-topline"><span>THE UNKNOWN / NO.001</span><span class="art-star">✦</span></div><div class="art-center"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="art-chip chip-one">△ <span>03</span></div><div class="art-chip chip-two">↗</div><div class="art-chip chip-three">◇</div><div class="art-chip chip-four">あ</div><div class="question-mark">?</div></div><div class="art-caption"><span>OBSERVE → CONNECT → SOLVE</span><span class="art-caption-dots">● ● ●</span></div></div></section>
  <section class="dashboard-strip" aria-label="学習記録"><div><small>解いた問題</small><strong>${totalDone}<span> / ${PUZZLES.length}</span></strong></div><div><small>初見正答率</small><strong>${initial.seen ? `${initial.pct}%` : '—'}</strong></div><div><small>チャレンジ回数</small><strong>${data.summaries.length}</strong></div><div><small>直近の実力測定</small><strong>${lastAssess ? `${percentage(lastAssess.score, lastAssess.total)}%` : '—'}</strong></div></section>
  <div class="section-heading"><div><p class="section-overline">CHOOSE YOUR PATH</p><h2>あなたの挑戦を選ぶ</h2></div><p>その日の気分と目的に合わせて、4つのモードから。</p></div>
  <section class="mode-grid">${modeCard('trial', '01', '謎解きトライアル', '5分で10問。時間のプレッシャーの中で、どこまで閃けるか。', '10 QUESTIONS / 5 MIN', 'timer')}${modeCard('training', '02', '自由トレーニング', '難易度もジャンルも自由自在。ヒントと解説で解き方を磨こう。', '10 – ∞ QUESTIONS', 'grid')}${modeCard('assessment', '03', '実力測定', '初見問題だけで実力を判定。得意・苦手を数字で見つける。', '20 QUESTIONS / 20 MIN', 'chart')}${modeCard('review', '04', '復習モード', '苦戦した問題をもう一度。ひらめきの型を自分のものにする。', 'PERSONALIZED REVIEW', 'repeat')}</section>
  <section class="home-bottom"><div class="bottom-copy"><p class="section-overline">BUILT FOR REAL-WORLD PUZZLES</p><h2>答えを覚えるための<br>問題集ではない。</h2><p>解くたびに「どこを見て、どう考えたか」を振り返る。問題の仕組みに気づく経験を積み重ね、初めて見る謎への対応力を鍛えます。</p></div><div class="bottom-note"><span class="note-symbol">✧</span><div><strong>自分のペースで、何度でも。</strong><p>進捗はこのブラウザに保存されます。別の端末には自動同期されません。</p></div></div></section></div>`;
}
function modeCard(m, num, title, desc, meta, icon) {
    const pict = { timer: '◷', grid: '⊞', chart: '⌁', repeat: '↺' };
    return `<button type="button" data-action="pick-mode" data-mode="${m}" class="mode-card"><div class="mode-card-top"><span class="mode-numeral">${num} / MODE</span><span class="mode-icon">${pict[icon]}</span></div><h3>${title}</h3><p>${desc}</p><div class="mode-card-bottom"><small>${meta}</small><span class="mode-arrow">↗</span></div></button>`;
}
function setup() {
    const m = setupMode;
    const configCount = m === 'review' ? PUZZLES.filter(p => isReviewMatch(data.records[p.id], cfg.review)).length : PUZZLES.filter(p => unseen(p, data)).length;
    const desc = { trial: '10問を5分で。初級から上級の問題がバランスよく出題されます。スコアは回答と同時に更新されます。', training: '問題数・難易度・ジャンルを選んで練習します。解答後にヒントと解説を確認できます。', assessment: '未挑戦の問題だけを使い、初見の実力を測定します。解説と正誤は終了後に表示されます。', review: '記録から復習したい問題を抽出して、何度でも挑戦できます。' };
    const counts = [10, 20, 50, 100, 0];
    return `<div class="setup-page"><button class="back-link" data-action="home">← ホームに戻る</button><div class="setup-heading"><span class="setup-serial">${modeIcon(m)}　CONFIGURE SESSION / ${m.toUpperCase()}</span><h1>${sessionLabel(m)}</h1><p>${desc[m]}</p></div>
  <div class="setup-layout"><div class="setup-form">
  ${m === 'training' ? `<div class="config-block"><div class="config-label">出題する問題数 <span>QUESTION COUNT</span></div><div class="seg-buttons">${counts.map(c => `<button type="button" class="seg-btn ${cfg.count === c ? 'selected' : ''}" data-action="set-count" data-count="${c}">${c === 0 ? '∞ 無限' : c + '問'}</button>`).join('')}</div><small>無限モードは全問題出題後、再出題と表示して次の周回へ進みます。</small></div>` : ''}
  ${(m === 'training' || m === 'review') ? `<div class="config-block"><label class="config-label" for="difficulty-select">難易度 <span>DIFFICULTY</span></label><select id="difficulty-select" data-config="difficulty" class="dark-select"><option value="">すべての難易度</option>${DIFFICULTIES.map(d => `<option value="${d.id}" ${cfg.difficulty === d.id ? 'selected' : ''}>${d.label}</option>`).join('')}</select></div>
  <div class="config-block"><label class="config-label" for="category-select">ジャンル <span>CATEGORY</span></label><select id="category-select" data-config="category" class="dark-select"><option value="">すべてのジャンル</option>${CATEGORIES.map(([id, label]) => `<option value="${id}" ${cfg.category === id ? 'selected' : ''}>${label}</option>`).join('')}</select></div>` : ''}
  ${m === 'review' ? `<div class="config-block"><label class="config-label" for="review-select">復習条件 <span>REVIEW TYPE</span></label><select id="review-select" data-config="review" class="dark-select">${[['wrong', '間違えた問題'], ['hint', 'ヒントを使用した問題'], ['skip', 'スキップした問題'], ['bookmark', 'ブックマークした問題'], ['slow', '初回解答に90秒以上かかった問題']].map(([k, v]) => `<option value="${k}" ${cfg.review === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>` : ''}
  ${m === 'assessment' ? `<div class="info-panel"><strong>初見評価を守るために</strong><p>過去に開いた問題・挑戦した問題は再利用しません。新しい問題が20問に満たない場合は、残りの未見問題のみで測定します。</p><p>未見問題：<b>${configCount}問</b></p></div>` : ''}
  ${m === 'trial' ? `<div class="info-panel"><strong>時間内は正解を非表示</strong><p>各問題に一度だけ回答できます。正解するとスコアが増えます。詳しい正誤・解説は終了後に表示されます。</p></div>` : ''}
  ${setupError ? `<p class="error-msg" role="alert">${tr(setupError)}</p>` : ''}
  <button data-action="start" class="primary-btn start-btn">${m === 'assessment' ? '測定を開始する' : '挑戦をはじめる'} <span>↗</span></button>
  </div><aside class="setup-aside"><div class="setup-aside-decoration">✧</div><p class="section-overline">YOUR TRAINING, YOUR RULES</p><h3>思考の「引き出し」を<br>一つずつ増やす。</h3><p>謎の答えではなく、そこにたどり着いた道筋に注目してください。</p><div class="rule-line"></div><small>保存先：このブラウザのみ<br>GitHub Pages対応・サーバー不要</small></aside></div></div>`;
}
function seenMark(s, i) {
    const a = s.answers[s.questionIds[i]];
    if (a?.correct && s.mode !== 'assessment')
        return 'solved';
    if (a?.skipped)
        return 'skipped';
    if (a?.submitted)
        return 'answered';
    return 'unanswered';
}
function play() {
    const s = data.active;
    if (!s)
        return home();
    const p = currentPuzzle();
    if (!p)
        return `<div class="error-msg">問題データの読み込みに失敗しました。セッションを終了してください。<button data-action="end">終了</button></div>`;
    const a = s.answers[p.id];
    const rec = data.records[p.id];
    const locked = (s.mode === 'trial' || s.mode === 'assessment') ? a.submitted : a.correct;
    const isTimed = s.deadlineAt !== null;
    const left = getRemainingMs(s);
    const hintsAllowed = s.mode === 'training' || s.mode === 'review';
    const effectiveHint = a.hintsUsed;
    const revealed = hintsAllowed && a.correct;
    const badge = levelTag(p.difficulty);
    const qnums = s.questionIds.length <= 20 ? s.questionIds.map((_, i) => `<button type="button" data-action="jump" data-index="${i}" class="num-chip ${s.index === i ? 'current' : ''} ${seenMark(s, i)}" aria-label="問題${i + 1}へ移動">${i + 1}</button>`).join('') : `<div class="progress-short">${s.questionIds.map((_, i) => `<button type="button" data-action="jump" data-index="${i}" class="progress-dot ${s.index === i ? 'current' : ''} ${seenMark(s, i)}" title="問題${i + 1}"></button>`).join('')}</div>`;
    return `<div class="game-page"><div class="game-heading"><div class="game-session"><span class="game-session-dot"></span> ${sessionLabel(s.mode)} ${s.isInfinite ? `<small>ROUND ${s.lap || 1}${(s.lap || 1) > 1 ? ' · 再出題' : ''}</small>` : ''}</div><button data-action="end" class="end-button">終了する <span>×</span></button></div>
  <div class="game-status"><div class="game-stat"><span>${s.mode === 'assessment' ? '回答数' : 'スコア'}</span><strong>${s.mode === 'assessment' ? Object.values(s.answers).filter(a => a.submitted).length : getScore(s)}<small> / ${s.questionIds.length}</small></strong></div><div class="game-stat game-stat-progress"><span>現在の問題</span><strong>${String(s.index + 1).padStart(2, '0')}<small> / ${String(s.questionIds.length).padStart(2, '0')}</small></strong></div><div class="game-stat ${isTimed ? 'game-stat-timer' : ''}"><span>${isTimed ? '残り時間' : '経過時間'}</span><strong id="game-clock" class="${isTimed && (left || 0) < 30000 ? 'time-urgent' : ''}">${isTimed ? duration(Math.ceil((left || 0) / 1000)) : duration(Math.round((Date.now() - s.startedAt) / 1000))}</strong></div></div>
  <div class="session-progress">${qnums}</div>
  <article class="puzzle-panel"><div class="puzzle-panel-top"><div class="puzzle-meta"><span class="puzzle-tag">${badge}</span><span>${tr(categoryLabel(p.category))}</span></div><div class="puzzle-tools"><button type="button" class="zoom-btn" data-action="zoom" aria-label="問題図を拡大する">⛶ 拡大</button><button class="bookmark-btn ${rec?.bookmarked ? 'on' : ''}" data-action="bookmark" aria-label="${rec?.bookmarked ? 'ブックマークを外す' : 'ブックマークする'}" title="ブックマーク">${rec?.bookmarked ? '◆' : '◇'} <span>${rec?.bookmarked ? '保存済み' : '保存'}</span></button></div></div>
  <div class="puzzle-titleline"><span>QUESTION ${String(s.index + 1).padStart(2, '0')}</span><h2>${tr(p.title)}</h2><p>${tr(p.prompt)}</p></div>
  ${renderVisual(p.visual, a)}
  <dialog id="puzzle-zoom" class="puzzle-zoom" aria-label="問題図の拡大表示"><div class="zoom-top"><strong>問題図 / ${tr(p.title)}</strong><button type="button" data-action="close-zoom" aria-label="拡大表示を閉じる">× 閉じる</button></div>${renderVisual(p.visual, a)}</dialog>
  <div class="answer-area"><form id="answer-form" autocomplete="off"><label for="answer-input">YOUR ANSWER <small>解答を入力</small></label><div class="answer-row"><input id="answer-input" name="answer" type="text" inputmode="text" autocomplete="off" spellcheck="false" value="${tr(a.answer)}" ${locked ? 'disabled' : ''} placeholder="ここに答えを入力" aria-label="解答欄"/><button type="submit" class="submit-answer" ${locked ? 'disabled' : ''}>${locked ? '回答済み' : '回答する'} <span>↗</span></button></div></form>
  <div class="answer-actions"><button type="button" data-action="clear" ${locked ? 'disabled' : ''}>入力を消す</button>${hintsAllowed ? `<button type="button" data-action="hint" ${effectiveHint >= 3 ? 'disabled' : ''}>ヒント <span>${effectiveHint}/3</span></button>` : ''}<button type="button" data-action="skip" ${locked ? 'disabled' : ''}>スキップ →</button></div>
  ${feedback?.id === p.id ? `<div class="feedback ${feedback.kind}" role="status">${tr(feedback.text)}</div>` : ''}
  ${hintsAllowed && effectiveHint > 0 ? `<div class="hints"><div class="small-heading">段階的なヒント</div>${p.hints.slice(0, effectiveHint).map((h, i) => `<div><span>HINT ${i + 1}</span><p>${tr(h)}</p></div>`).join('')}</div>` : ''}
  ${revealed ? `<div class="reveal"><div class="reveal-heading"><span>✦ 解き方の解説</span><span>正解：${tr(p.answer)}</span></div>${explain(p)}</div>` : ''}
  </div></article>
  <div class="game-navigation"><button data-action="prev" ${s.index === 0 ? 'disabled' : ''}>← 前の問題</button><span>${s.index + 1} / ${s.questionIds.length}</span><button data-action="next">${s.index === s.questionIds.length - 1 ? (s.isInfinite ? '次のラウンド' : '結果を見る') : '次の問題'} →</button></div>
  <p class="game-key-tip">Enterで回答 · Alt + ← / → で問題移動 · 問題の履歴は保存されます</p></div>`;
}
function explain(p) {
    return `<div class="explanation-grid"><div><small>01 / 手がかり</small><p>${tr(p.explanation.clue)}</p></div><div><small>02 / 論理的な解法</small><p>${tr(p.explanation.steps)}</p></div><div><small>03 / ひらめきの核心</small><p>${tr(p.explanation.aha)}</p></div><div><small>04 / 次に活かす考え方</small><p>${tr(p.explanation.transfer)}</p></div></div>`;
}
function result() {
    const sum = lastSummary || data.summaries[0];
    if (!sum)
        return home();
    const pct = percentage(sum.score, sum.total);
    const grade = pct >= 90 ? 'EXCELLENT' : pct >= 70 ? 'GREAT WORK' : pct >= 50 ? 'GOOD START' : 'KEEP EXPLORING';
    return `<div class="result-page"><button data-action="home" class="back-link">← ホームへ戻る</button><div class="result-hero"><p class="section-overline">SESSION COMPLETE / ${tr(sessionLabel(sum.mode))}</p><h1>${sum.timeout ? 'TIME UP.' : 'CHALLENGE COMPLETE.'}</h1><p>結果は次の「解ける」を育てるための道しるべ。</p><div class="score-circle"><small>RESULT</small><strong>${sum.score}<span> / ${sum.total}</span></strong><em>${grade}</em></div></div>
  <div class="result-stat-row"><div><small>正答率</small><strong>${pct}%</strong></div><div><small>所要時間</small><strong>${duration(sum.elapsedSec)}</strong></div><div><small>初見・無ヒント正解</small><strong>${sum.initialCorrect}<small> / ${sum.firstSeenAnswered}</small></strong></div><div><small>ヒント使用</small><strong>${sum.hintsUsedQuestions}<small>問</small></strong></div></div>
  <div class="result-actions"><button class="primary-btn" data-action="pick-mode" data-mode="${sum.mode}">もう一度挑戦 ↗</button><button class="secondary-btn" data-action="stats">能力分析を見る →</button></div>
  <div class="section-heading result-subheading"><div><p class="section-overline">ANSWER REVIEW</p><h2>問題と解説を振り返る</h2></div><button class="underlined-button" data-action="toggle-all">${revealResultAll ? 'すべて閉じる' : 'すべて開く'}</button></div>
  <div class="result-list">${sum.answers.map((a, i) => {
        const p = PUZZLE_MAP.get(a.id);
        if (!p)
            return '';
        return `<details ${revealResultAll ? 'open' : ''} class="result-item"><summary><span class="result-index">${String(i + 1).padStart(2, '0')}</span><span class="result-title">${tr(p.title)}<small>${tr(categoryLabel(p.category))} / ${tr(difficultyLabel(p.difficulty))}</small></span><span class="result-outcome ${a.correct ? 'result-correct' : 'result-incorrect'}">${a.correct ? '正解' : '未正解'}</span><span class="result-chevron">⌄</span></summary><div class="result-detail"><p class="result-prompt">${tr(p.prompt)}</p>${renderVisual(p.visual)}<p class="result-answer">正解：<strong>${tr(p.answer)}</strong>${a.answer ? ` <span>／ あなたの解答：${tr(a.answer)}</span>` : ''}</p>${explain(p)}</div></details>`;
    }).join('')}</div></div>`;
}
function stats() {
    const total = accuracy(PUZZLES);
    const attempts = PUZZLES.map(p => data.records[p.id]).filter(r => r && r.firstCorrect !== null);
    const avg = attempts.filter(r => r.firstElapsedSec !== null).reduce((x, r) => x + (r.firstElapsedSec || 0), 0) / Math.max(1, attempts.filter(r => r.firstElapsedSec !== null).length);
    const hintCount = attempts.filter(r => r.attempts.find(a => a.firstForQuestion)?.hintsUsed).length;
    const as = data.summaries.filter(s => s.mode === 'assessment');
    const prior = as.length >= 2 ? percentage(as[1].score, as[1].total) : null;
    const latest = as.length ? percentage(as[0].score, as[0].total) : null;
    const weaknesses = CATEGORIES.map(([id, label]) => ({ id, label, ...accuracy(PUZZLES.filter(p => p.category === id)) })).filter(v => v.seen >= 2).sort((a, b) => a.pct - b.pct || b.seen - a.seen).slice(0, 3);
    const bestTrial = data.summaries.filter(s => s.mode === 'trial').reduce((best, s) => Math.max(best, s.score), -1);
    const bestAssessment = data.summaries.filter(s => s.mode === 'assessment').reduce((best, s) => Math.max(best, percentage(s.score, s.total)), -1);
    const overall = total.seen < 20 ? '判定データ不足' : total.pct >= 80 ? '非常に好調' : total.pct >= 60 ? '着実に成長中' : '基礎を強化中';
    return `<div class="stats-page"><div class="stats-header"><p class="section-overline">PROGRESS & ANALYTICS</p><h1>能力を、可視化する。</h1><p>すべて初回挑戦の結果を基準に集計。復習での正解を「初見の正解」として加算しません。</p></div>
  <div class="stats-kpi"><div><small>初見正答率</small><strong>${total.seen ? total.pct + '%' : '—'}</strong><span>${total.correct} / ${total.seen}問</span></div><div><small>初回平均解答時間</small><strong>${attempts.length ? duration(avg) : '—'}</strong><span>初回挑戦分のみ</span></div><div><small>初回のヒント利用率</small><strong>${total.seen ? percentage(hintCount, total.seen) + '%' : '—'}</strong><span>${hintCount}問で使用</span></div><div><small>初回挑戦済み</small><strong>${total.seen}<small> / ${PUZZLES.length}</small></strong><span>残り未見 ${PUZZLES.filter(p => unseen(p, data)).length}問</span></div></div>
  <div class="overall-row"><div><small>総合評価（初回回答ベース）</small><strong>${overall}</strong><p>初回挑戦20問以上で判定。初見正答率80%以上：非常に好調、60%以上：着実に成長中、それ未満：基礎を強化中。脱出成功率の予測ではありません。</p></div><div><small>トライアル自己ベスト</small><strong>${bestTrial < 0 ? '—' : bestTrial + ' / 10'}</strong></div><div><small>実力測定自己ベスト</small><strong>${bestAssessment < 0 ? '—' : bestAssessment + '%'}</strong></div></div>
  <div class="stat-sections"><section class="analysis-box"><div class="analysis-title"><h2>難易度別の初見正答率</h2><small>DIFFICULTY</small></div>${DIFFICULTIES.map(d => barStat(d.label, accuracy(PUZZLES.filter(p => p.difficulty === d.id)))).join('')}</section>
  <section class="analysis-box"><div class="analysis-title"><h2>ジャンル別の初見正答率</h2><small>CATEGORIES</small></div>${CATEGORIES.map(([id, name]) => barStat(name, accuracy(PUZZLES.filter(p => p.category === id)))).join('')}</section>
  <section class="analysis-box"><div class="analysis-title"><h2>実力測定の推移</h2><small>ASSESSMENTS</small></div>${as.length ? `<div class="compare-row"><div><small>最新</small><strong>${latest}%</strong></div><div><small>前回</small><strong>${prior === null ? '—' : prior + '%'}</strong></div><div><small>前回比</small><strong>${prior === null ? '—' : `${(latest || 0) - prior > 0 ? '+' : ''}${(latest || 0) - prior}pt`}</strong></div></div><div class="history-list">${as.slice(0, 6).map(x => `<div><span>${tr(new Date(x.endedAt).toLocaleDateString('ja-JP'))}</span><b>${x.score}/${x.total}</b><span>${percentage(x.score, x.total)}%</span></div>`).join('')}</div>` : `<p class="empty-info">まだ実力測定の記録はありません。未見問題を使って初回の実力を測定しましょう。</p>`}</section>
  <section class="analysis-box"><div class="analysis-title"><h2>次に伸ばしたい分野</h2><small>TRAINING FOCUS</small></div>${weaknesses.length ? weaknesses.map((w, i) => `<div class="weakness-row"><span class="weakness-num">0${i + 1}</span><div><strong>${tr(w.label)}</strong><small>初見${w.seen}問中 ${w.correct}問正解</small></div><b>${w.pct}%</b></div>`).join('') : `<p class="empty-info">各ジャンル2問以上の初回挑戦記録ができると、苦手な分野がここに表示されます。</p>`}<button data-action="pick-mode" data-mode="training" class="underlined-button">トレーニングする →</button></section></div>
  <div class="local-note"><div><strong>プライバシー・データの保存</strong><p>記録は現在使用しているブラウザのlocalStorageに保存され、別端末と自動で同期されません。ブラウザの保存データを削除すると記録も消えます。</p></div><button type="button" class="danger-link" data-action="clear-records">記録を初期化する</button></div></div>`;
}
function barStat(label, s) {
    return `<div class="bar-stat"><div class="bar-stat-text"><span>${tr(label)}</span><small>${s.seen ? `${s.correct}/${s.seen}問` : '未挑戦'}</small><b>${s.seen ? s.pct + '%' : '—'}</b></div><div class="bar-track"><span style="width:${s.seen ? s.pct : 0}%"></span></div></div>`;
}
function render() {
    const sc = window.scrollY;
    root.innerHTML = shell(page === 'home' ? home() : page === 'setup' ? setup() : page === 'play' ? play() : page === 'result' ? result() : stats());
    if (renderScroll) {
        window.scrollTo(0, 0);
        renderScroll = false;
    }
    else if (page !== 'play')
        window.scrollTo(0, sc);
    updateClock();
}
function changePage(p) { page = p; renderScroll = true; render(); }
function enterQuestion(index) {
    const s = data.active;
    if (!s)
        return;
    if (s.deadlineAt !== null && getRemainingMs(s) === 0) {
        finishSession(true);
        return;
    }
    const now = Date.now();
    const old = s.answers[s.questionIds[s.index]];
    if (old)
        old.spentSec += Math.max(0, Math.floor((now - s.lastEntryAt) / 1000));
    s.index = Math.min(s.questionIds.length - 1, Math.max(0, index));
    s.lastEntryAt = now;
    const id = s.questionIds[s.index];
    getRec(id).lastSeenAt ??= new Date(now).toISOString();
    feedback = null;
    safeSave();
    render();
    // ホイールスクロールや問題切替で画面中央から離れない。
    window.scrollTo({ top: 0, behavior: 'instant' });
}
function markFirstAttempt(p, correct, hintsUsed, elapsedSec, mode, answer, firstSeen) {
    const rec = getRec(p.id);
    const isFirst = rec.firstAttemptAt === null;
    const at = new Date().toISOString();
    if (isFirst) {
        rec.firstAttemptAt = at;
        rec.firstCorrect = firstSeen && correct && hintsUsed === 0;
        rec.firstElapsedSec = elapsedSec;
    }
    rec.attempts.push({ at, answer, correct, elapsedSec, mode, firstForQuestion: isFirst, hintsUsed });
    rec.solved ||= correct;
    rec.lastSeenAt = at;
    rec.maxHintsUsed = Math.max(rec.maxHintsUsed, hintsUsed);
}
function submitAnswer(raw) {
    const s = data.active, p = currentPuzzle();
    if (!s || !p)
        return;
    const a = s.answers[p.id];
    if ((s.mode === 'trial' || s.mode === 'assessment') && a.submitted)
        return;
    if (s.deadlineAt !== null && getRemainingMs(s) === 0) {
        finishSession(true);
        return;
    }
    if (a.correct)
        return;
    const answer = raw.trim();
    if (!answer) {
        feedback = { id: p.id, text: '答えを入力してください。', kind: 'bad' };
        render();
        $('#answer-input')?.focus();
        return;
    }
    const now = Date.now();
    a.spentSec += Math.max(0, Math.floor((now - s.lastEntryAt) / 1000));
    s.lastEntryAt = now;
    const correct = isCorrect(p, answer);
    a.answer = answer;
    a.submitted = true;
    a.attempts++;
    a.correct = correct;
    markFirstAttempt(p, correct, a.hintsUsed, a.spentSec, s.mode, answer, a.firstSeen);
    feedback = { id: p.id, text: s.mode === 'trial' || s.mode === 'assessment' ? '回答を記録しました。終了後に正誤と解説を確認できます。' : correct ? '正解！解説で考え方を確認しよう。' : 'まだ違うようです。別の見方を試してみましょう。', kind: s.mode === 'trial' || s.mode === 'assessment' ? 'info' : correct ? 'good' : 'bad' };
    safeSave();
    render();
    if (!correct && (s.mode === 'training' || s.mode === 'review'))
        document.querySelector('#answer-input')?.select();
}
function skipQuestion() {
    const s = data.active, p = currentPuzzle();
    if (!s || !p)
        return;
    if (s.deadlineAt !== null && getRemainingMs(s) === 0) {
        finishSession(true);
        return;
    }
    const a = s.answers[p.id];
    if (a.correct || ((s.mode === 'trial' || s.mode === 'assessment') && a.submitted))
        return;
    const now = Date.now();
    a.spentSec += Math.max(0, Math.floor((now - s.lastEntryAt) / 1000));
    s.lastEntryAt = now;
    a.skipped = true;
    const r = getRec(p.id);
    r.everSkipped = true;
    r.lastSeenAt = new Date(now).toISOString();
    if (r.firstAttemptAt === null) {
        r.firstAttemptAt = r.lastSeenAt;
        r.firstCorrect = false;
        r.firstElapsedSec = a.spentSec;
    }
    safeSave();
    if (s.index < s.questionIds.length - 1)
        enterQuestion(s.index + 1);
    else if (s.isInfinite)
        nextInfiniteRound();
    else
        finishSession(false);
}
function useHint() {
    const s = data.active, p = currentPuzzle();
    if (!s || !p || !['training', 'review'].includes(s.mode))
        return;
    const a = s.answers[p.id];
    if (a.hintsUsed >= 3 || a.correct)
        return;
    a.hintsUsed++;
    getRec(p.id).maxHintsUsed = Math.max(getRec(p.id).maxHintsUsed, a.hintsUsed);
    safeSave();
    render();
}
function beginSession() {
    if (data.active && !window.confirm('現在の挑戦を終了して新しい挑戦を始めますか？'))
        return;
    if (data.active)
        finishSession(false, false);
    const mode = setupMode;
    const opts = { mode, count: mode === 'trial' ? 10 : mode === 'assessment' ? 20 : cfg.count === 0 ? PUZZLES.length : cfg.count };
    if ((mode === 'training' || mode === 'review') && cfg.difficulty)
        opts.difficulty = cfg.difficulty;
    if ((mode === 'training' || mode === 'review') && cfg.category)
        opts.category = cfg.category;
    if (mode === 'review')
        opts.review = cfg.review;
    const pool = selectQuestions(PUZZLES, data, opts);
    if (!pool.length) {
        setupError = mode === 'assessment' ? '未見問題がありません。実力測定は初見問題のみで行います。' : mode === 'review' ? '条件に合う復習問題がありません。別の条件を選んでください。' : '該当する問題がありません。条件を変更してください。';
        render();
        return;
    }
    const s = newSession(pool, data, mode, mode === 'training' && cfg.count === 0, { difficulty: opts.difficulty, category: opts.category });
    s.lap = 1;
    data.active = s;
    getRec(s.questionIds[0]).lastSeenAt ??= new Date().toISOString();
    safeSave();
    feedback = null;
    changePage('play');
}
function finishSession(timeout = false, show = true) {
    const s = data.active;
    if (!s)
        return;
    const now = Date.now();
    const effectiveNow = Math.min(now, s.deadlineAt ?? now);
    const cur = s.answers[s.questionIds[s.index]];
    if (cur)
        cur.spentSec += Math.max(0, Math.floor((effectiveNow - s.lastEntryAt) / 1000));
    const summary = getSummary(s, timeout, now);
    data.summaries.unshift(summary);
    // 長期利用時のブラウザ保存容量を考慮し、最近のセッションを優先します。
    if (data.summaries.length > 180)
        data.summaries.length = 180;
    data.active = null;
    lastSummary = summary;
    safeSave();
    feedback = null;
    if (show)
        changePage('result');
}
function nextInfiniteRound() {
    const s = data.active;
    if (!s)
        return;
    const oldLap = s.lap || 1;
    const mode = s.mode;
    const opts = { mode, count: PUZZLES.length, difficulty: s.difficulty, category: s.category };
    finishSession(false, false);
    const pool = selectQuestions(PUZZLES, data, opts);
    if (!pool.length) {
        changePage('home');
        return;
    }
    data.active = newSession(pool, data, mode, true, { difficulty: s.difficulty, category: s.category });
    data.active.lap = oldLap + 1;
    getRec(pool[0].id).lastSeenAt ??= new Date().toISOString();
    feedback = { id: pool[0].id, text: `全問題を出題しました。ROUND ${oldLap + 1} は再出題です。`, kind: 'info' };
    safeSave();
    changePage('play');
}
function updateClock() {
    if (!data.active)
        return;
    const s = data.active;
    const el = $('#game-clock');
    if (s.deadlineAt !== null) {
        const remain = getRemainingMs(s) || 0;
        if (remain <= 0) {
            finishSession(true);
            return;
        }
        if (el) {
            el.textContent = duration(Math.ceil(remain / 1000));
            el.classList.toggle('time-urgent', remain <= 30000);
        }
    }
    else if (el)
        el.textContent = duration(Math.round((Date.now() - s.startedAt) / 1000));
}
document.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || b.disabled)
        return;
    const action = b.dataset.action;
    if (action === 'home') {
        if (data.active && page === 'play') {
            enterQuestion(data.active.index);
        }
        changePage('home');
        return;
    }
    if (action === 'stats') {
        changePage('stats');
        return;
    }
    if (action === 'resume') {
        if (data.active)
            changePage('play');
        return;
    }
    if (action === 'pick-mode') {
        setupMode = (b.dataset.mode || 'trial');
        setupError = '';
        cfg = { count: 10, difficulty: '', category: '', review: 'wrong' };
        changePage('setup');
        return;
    }
    if (action === 'set-count') {
        cfg.count = Number(b.dataset.count);
        render();
        return;
    }
    if (action === 'start') {
        beginSession();
        return;
    }
    if (action === 'end') {
        if (window.confirm('今回の挑戦を終了して結果を表示しますか？'))
            finishSession(false);
        return;
    }
    if (action === 'jump') {
        if (data.active?.deadlineAt !== null && data.active && getRemainingMs(data.active) === 0) {
            finishSession(true);
            return;
        }
        enterQuestion(Number(b.dataset.index));
        return;
    }
    if (action === 'prev' && data.active) {
        enterQuestion(data.active.index - 1);
        return;
    }
    if (action === 'next' && data.active) {
        if (data.active.deadlineAt !== null && getRemainingMs(data.active) === 0) {
            finishSession(true);
            return;
        }
        if (data.active.index < data.active.questionIds.length - 1)
            enterQuestion(data.active.index + 1);
        else if (data.active.isInfinite)
            nextInfiniteRound();
        else
            finishSession(false);
        return;
    }
    if (action === 'zoom') {
        document.querySelector('#puzzle-zoom')?.showModal();
        return;
    }
    if (action === 'close-zoom') {
        document.querySelector('#puzzle-zoom')?.close();
        return;
    }
    if (action === 'bookmark') {
        const p = currentPuzzle();
        if (!p)
            return;
        const r = getRec(p.id);
        r.bookmarked = !r.bookmarked;
        safeSave();
        render();
        return;
    }
    if (action === 'clear') {
        const s = data.active, p = currentPuzzle();
        if (!s || !p)
            return;
        const a = s.answers[p.id];
        if ((s.mode === 'trial' || s.mode === 'assessment') && a.submitted || a.correct)
            return;
        a.answer = '';
        a.uiSelection = [];
        a.uiRotation = 0;
        safeSave();
        render();
        $('#answer-input')?.focus();
        return;
    }
    if (action === 'hint') {
        useHint();
        return;
    }
    if (action === 'skip') {
        skipQuestion();
        return;
    }
    if (action === 'toggle-all') {
        revealResultAll = !revealResultAll;
        render();
        return;
    }
    if (action === 'clear-records') {
        if (!window.confirm('このブラウザにあるすべての成績・復習履歴を削除します。元に戻せません。続けますか？'))
            return;
        if (!window.confirm('最終確認：保存しているすべての記録を初期化しますか？'))
            return;
        data = freshData();
        safeSave();
        changePage('home');
        return;
    }
    if (b.dataset.interaction) {
        const p = currentPuzzle(), s = data.active;
        if (!p || !s || p.visual.kind !== 'interaction')
            return;
        const a = s.answers[p.id];
        if (a.correct || ((s.mode === 'trial' || s.mode === 'assessment') && a.submitted))
            return;
        if (b.dataset.interaction === 'select') {
            const i = Number(b.dataset.index);
            a.uiSelection = [i];
            a.answer = String(i + 1);
        }
        if (b.dataset.interaction === 'order') {
            const i = Number(b.dataset.index);
            const items = a.uiSelection || [];
            if (!items.includes(i))
                items.push(i);
            a.uiSelection = items;
            a.answer = items.map(x => p.visual.kind === 'interaction' ? p.visual.items[x] : '').join('');
        }
        if (b.dataset.interaction === 'reset') {
            a.uiSelection = [];
            a.answer = '';
        }
        if (b.dataset.interaction === 'rotate') {
            a.uiRotation = (((a.uiRotation || 0) + Number(b.dataset.step)) % 4 + 4) % 4;
            a.answer = ['した', 'ひだり', 'うえ', 'みぎ'][a.uiRotation];
        }
        safeSave();
        render();
        return;
    }
});
document.addEventListener('submit', e => { if (e.target?.id === 'answer-form') {
    e.preventDefault();
    const inp = document.querySelector('#answer-input');
    submitAnswer(inp?.value || '');
} });
document.addEventListener('input', e => {
    const target = e.target;
    if (target?.id !== 'answer-input')
        return;
    const p = currentPuzzle(), s = data.active;
    if (!p || !s)
        return;
    s.answers[p.id].answer = target.value;
    safeSave();
});
document.addEventListener('change', e => {
    const el = e.target;
    if (!el?.dataset?.config)
        return;
    if (el.dataset.config === 'difficulty')
        cfg.difficulty = el.value;
    if (el.dataset.config === 'category')
        cfg.category = el.value;
    if (el.dataset.config === 'review')
        cfg.review = el.value;
    setupError = '';
    render();
});
document.addEventListener('keydown', e => {
    if (e.altKey && e.key === 'ArrowLeft' && data.active && page === 'play') {
        e.preventDefault();
        enterQuestion(data.active.index - 1);
    }
    if (e.altKey && e.key === 'ArrowRight' && data.active && page === 'play') {
        e.preventDefault();
        if (data.active.index < data.active.questionIds.length - 1)
            enterQuestion(data.active.index + 1);
    }
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible')
    updateClock(); });
window.addEventListener('focus', updateClock);
window.addEventListener('storage', e => { if (e.key === 'nazo-forge-v1' && e.newValue) {
    data = loadData();
    render();
} });
if (data.active) {
    const s = data.active;
    if (s.questionIds.some(id => !PUZZLE_MAP.has(id)) || s.index < 0 || s.index >= s.questionIds.length) {
        data.active = null;
        safeSave();
        page = 'home';
    }
    else
        getRec(s.questionIds[s.index]).lastSeenAt ??= new Date().toISOString();
}
render();
setInterval(updateClock, 500);
