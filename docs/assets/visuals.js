export const C = (items, columns, caption) => ({ kind: 'cards', items, columns, caption });
export const G = (rows, caption) => ({ kind: 'grid', rows, caption });
export const L = (lines, caption) => ({ kind: 'lines', lines, caption });
export const P = (rows, caption) => ({ kind: 'path', rows, caption });
export const S = (body, caption) => ({ kind: 'svg', body, caption });
export const B = (panels, caption) => ({ kind: 'split', panels, caption });
export const T = (content) => ({ kind: 'text', content });
export const I = (task, items, caption) => ({ kind: 'interaction', task, items, caption });
export function escapeHtml(s) {
    return s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
const e = escapeHtml;
export function renderVisual(v, state) {
    const caption = 'caption' in v && v.caption ? `<figcaption>${e(v.caption)}</figcaption>` : '';
    let html = '';
    switch (v.kind) {
        case 'cards':
            html = `<div class="visual-cards" style="--cols:${v.columns || Math.min(v.items.length, 4)}">${v.items.map((x, i) => `<div class="visual-card"><span class="card-index">${String(i + 1).padStart(2, '0')}</span><span>${e(x)}</span></div>`).join('')}</div>`;
            break;
        case 'grid':
            html = `<div class="visual-grid" role="img" aria-label="${e(v.rows.map(x => x.join('、')).join('／'))}" style="--cols:${Math.max(...v.rows.map(r => r.length))}">${v.rows.flatMap((r) => r.map(x => `<div class="visual-cell">${e(x)}</div>`)).join('')}</div>`;
            break;
        case 'path':
            html = `<div class="visual-path" role="img" aria-label="${e(v.rows.map(x => x.join('、')).join('／'))}" style="--cols:${Math.max(...v.rows.map(r => r.length))}">${v.rows.flatMap((r) => r.map(x => `<div class="path-cell ${x === '■' ? 'path-wall' : ''}">${e(x)}</div>`)).join('')}</div>`;
            break;
        case 'lines':
            html = `<div class="visual-lines">${v.lines.map(x => `<div>${e(x)}</div>`).join('')}</div>`;
            break;
        case 'split':
            html = `<div class="visual-split">${v.panels.map(p => `<section><div class="split-heading">${e(p.heading)}</div>${p.lines.map(x => `<div class="split-line">${e(x)}</div>`).join('')}</section>`).join('')}</div>`;
            break;
        case 'svg':
            html = `<svg class="puzzle-svg" viewBox="0 0 540 250" role="img" aria-label="${e(v.caption || '図形を使った謎')}">${v.body}</svg>`;
            break;
        case 'text':
            html = `<div class="visual-text">${e(v.content)}</div>`;
            break;
        case 'composite':
            html = `<div class="visual-composite">${v.panels.map(panel => `<section class="visual-composite-card"><h3>${e(panel.heading)}</h3>${renderVisual(panel.visual, state)}${panel.note ? `<p class="composite-note">${e(panel.note)}</p>` : ''}</section>`).join('')}</div>`;
            break;
        case 'interaction': {
            if (v.task === 'select')
                html = `<div class="interaction-choices">${v.items.map((x, i) => `<button type="button" class="interaction-choice ${(state?.uiSelection || []).includes(i) ? 'is-selected' : ''}" data-interaction="select" data-index="${i}"><small>${i + 1}</small><span>${e(x)}</span></button>`).join('')}</div>`;
            if (v.task === 'order') {
                const chosen = state?.uiSelection || [];
                html = `<div class="interaction-choices">${v.items.map((x, i) => `<button type="button" class="interaction-choice ${chosen.includes(i) ? 'is-selected' : ''}" data-interaction="order" data-index="${i}" ${chosen.includes(i) ? 'disabled' : ''}><small>${i + 1}</small><span>${e(x)}</span></button>`).join('')}</div><div class="ordered-answer">選んだ順：${chosen.length ? chosen.map(i => e(v.items[i])).join(' → ') : 'まだ選ばれていません'} <button type="button" data-interaction="reset" class="text-link">やり直す</button></div>`;
            }
            if (v.task === 'rotate')
                html = `<div class="rotation-control"><button data-interaction="rotate" data-step="-1" aria-label="左に90度回転">↶ 左に回す</button><span class="rotate-shape" role="img" aria-label="回転できる矢印" style="transform:rotate(${((state?.uiRotation || 0) + 4) % 4 * 90}deg)">${e(v.items[0] || '↓')}</span><button data-interaction="rotate" data-step="1" aria-label="右に90度回転">右に回す ↷</button></div>`;
            break;
        }
    }
    return `<figure class="puzzle-figure">${html}${caption}</figure>`;
}
