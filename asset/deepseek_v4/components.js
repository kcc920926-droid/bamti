"use strict";
/* ═══════════════════════════════════════════════════════════════════
   KIT — pure component interactions (TypeScript)
   · 전역 네임스페이스 window.KIT 로 노출 (모듈 번들 불필요)
   · 문서 로드 시 data-* 속성 기반 선언적 초기화 자동 실행
   · 사용처: index.html (갤러리) / 실제 프로젝트에서 파일 복사 후 재사용
   ═══════════════════════════════════════════════════════════════════ */
/* ── 기본 유틸 ──────────────────────────────────────────────────── */
const qs = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const ICONS = {
    ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m8.5 12.5 2.5 2.5 5-6"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-5"/><path d="M12 8h.01"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
    danger: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>',
};
const uid = () => `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
/* ── 테마 ────────────────────────────────────────────────────────── */
const THEME_KEY = 'kit-theme';
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try {
        localStorage.setItem(THEME_KEY, theme);
    }
    catch { /* file:// 에서는 무시 */ }
}
function initTheme() {
    const saved = (() => {
        try {
            return localStorage.getItem(THEME_KEY);
        }
        catch {
            return null;
        }
    })();
    const pref = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    applyTheme(saved ?? pref);
    qsa('[data-theme-toggle]').forEach(btn => {
        btn.addEventListener('click', () => {
            const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            applyTheme(next);
            toast(`테마를 ${next === 'dark' ? '다크' : '라이트'}로 전환했어요`, { kind: 'info' });
        });
    });
}
/* ── 토스트 ──────────────────────────────────────────────────────── */
function toast(msg, opts = {}) {
    const { kind = 'info', ttl = 3400, title } = opts;
    let region = qs('.toast-region');
    if (!region) {
        region = document.createElement('div');
        region.className = 'toast-region';
        region.setAttribute('role', 'status');
        document.body.appendChild(region);
    }
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    const t = title ?? kind.charAt(0).toUpperCase() + kind.slice(1);
    el.innerHTML = `
    <span class="t-icon">${ICONS[kind]}</span>
    <div class="t-body">
      <div class="t-title">${escapeHtml(t)}</div>
      <div class="t-msg">${escapeHtml(msg)}</div>
    </div>
    <button class="t-close" aria-label="닫기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
  `;
    region.appendChild(el);
    const kill = () => {
        el.classList.add('out');
        const rm = () => el.remove();
        el.addEventListener('animationend', rm, { once: true });
        setTimeout(rm, 420); // animation 미지원 (reduced-motion 등) 폴백
    };
    qs('.t-close', el)?.addEventListener('click', kill);
    setTimeout(kill, ttl);
    if (qsa('.toast', region).length > 4)
        qsa('.toast', region)[0]?.classList.add('out');
}
function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
/* ── 링 게이지 ───────────────────────────────────────────────────── */
function renderRing(el, value, opts = {}) {
    const size = opts.size ?? 130;
    const stroke = opts.stroke ?? 10;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    el.classList.add('ring-gauge');
    let valEl = null;
    if (!qs('svg', el)) {
        const cap = opts.caption ? `<div class="rg-cap">${opts.caption}</div>` : '';
        el.innerHTML = `
      <svg viewBox="0 0 ${size} ${size}">
        <circle class="rg-track" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"/>
        <circle class="rg-prog" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
                stroke-width="${stroke}" stroke-dasharray="${c}" stroke-dashoffset="${c}"/>
      </svg>
      <div class="rg-val">${Math.round(value)}%</div>${cap}`;
        valEl = qs('.rg-val', el);
    }
    const set = (v) => {
        const n = clamp(v, 0, 100);
        const prog = qs('.rg-prog', el);
        if (prog)
            prog.style.strokeDashoffset = String(c * (1 - n / 100));
        el.classList.toggle('ok', n >= 70);
        el.classList.toggle('danger', n <= 30);
        const vv = valEl ?? qs('.rg-val', el);
        if (vv)
            vv.textContent = `${Math.round(n)}%`;
    };
    set(value);
    return { set };
}
/* 빌트인 [data-ring] 자동 렌더 */
function initRings() {
    qsa('[data-ring]').forEach(el => {
        renderRing(el, Number(el.getAttribute('data-ring') ?? 0), { size: el.offsetWidth || 130 });
    });
}
/* ── 모달 / 드로어 ───────────────────────────────────────────────── */
function openModal(id) {
    const backdrop = qs(`#${id}`);
    if (!backdrop)
        return;
    backdrop.setAttribute('open', '');
    document.body.style.overflow = 'hidden';
    const first = qs('button, a, input, [tabindex]', backdrop);
    first?.focus();
}
function closeModal(id) {
    const backdrop = qs(`#${id}`);
    if (!backdrop)
        return;
    backdrop.removeAttribute('open');
    document.body.style.overflow = '';
}
function initOverlays() {
    qsa('[data-modal-open]').forEach(b => b.addEventListener('click', () => openModal(b.dataset.modalOpen)));
    qsa('[data-drawer-open]').forEach(b => b.addEventListener('click', () => openModal(b.dataset.drawerOpen)));
    qsa('[data-modal-close]').forEach(b => b.addEventListener('click', () => {
        const back = b.closest('.modal-backdrop, .drawer-backdrop');
        if (back)
            closeModal(back.id);
    }));
    qsa('.modal-backdrop, .drawer-backdrop').forEach(back => {
        back.addEventListener('click', e => { if (e.target === back)
            closeModal(back.id); });
    });
    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape')
            return;
        qsa('.modal-backdrop[open], .drawer-backdrop[open]').forEach(b => closeModal(b.id));
    });
}
/* confirm 다이얼로그 */
function confirmDialog(msg, title = '확인 필요') {
    return new Promise(resolve => {
        const id = `confirm-${uid()}`;
        const back = document.createElement('div');
        back.id = id;
        back.className = 'modal-backdrop';
        back.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="m-head"><div><div class="m-title">${escapeHtml(title)}</div></div></div>
        <div class="m-body">${escapeHtml(msg)}</div>
        <div class="m-foot">
          <button class="btn btn-secondary" data-c-no>취소</button>
          <button class="btn btn-danger" data-c-yes>삭제</button>
        </div>
      </div>`;
        document.body.appendChild(back);
        const done = (v) => {
            closeModal(id);
            setTimeout(() => back.remove(), 260);
            resolve(v);
        };
        qs('[data-c-no]', back).addEventListener('click', () => done(false));
        qs('[data-c-yes]', back).addEventListener('click', () => done(true));
        openModal(id);
    });
}
/* ── 드롭다운 ────────────────────────────────────────────────────── */
function initDropdowns() {
    document.addEventListener('click', (e) => {
        const trig = e.target.closest('[data-dropdown]');
        qsa('.drop-menu[open]').forEach(m => {
            const owner = m.closest('.dropdown')?.querySelector('[data-dropdown]');
            if (owner !== trig)
                m.removeAttribute('open');
        });
        if (trig) {
            const menu = trig.parentElement.querySelector('.drop-menu');
            menu?.toggleAttribute('open');
            e.stopPropagation();
        }
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape')
            qsa('.drop-menu[open]').forEach(m => m.removeAttribute('open'));
    });
    qsa('.drop-menu .mi:not([aria-disabled="true"])').forEach(mi => {
        mi.addEventListener('click', () => { mi.closest('.drop-menu')?.removeAttribute('open'); });
    });
}
/* ── 탭 ──────────────────────────────────────────────────────────── */
function initTabs() {
    qsa('[data-tabs]').forEach(group => {
        const btns = qsa('.tab', group);
        btns.forEach(btn => btn.addEventListener('click', () => {
            btns.forEach(b => b.setAttribute('aria-selected', String(b === btn)));
            const target = btn.dataset.tab;
            qsa('[data-panel]', group).forEach(p => p.style.display = p.dataset.panel === target ? '' : 'none');
        }));
        btns[0]?.click();
    });
}
/* ── 아코디언 ────────────────────────────────────────────────────── */
function initAccordions() {
    qsa('.acc-head').forEach(head => {
        head.addEventListener('click', () => {
            const item = head.closest('.acc-item');
            const root = head.closest('.accordion');
            if (root.dataset.exclusive === 'true' && !item.hasAttribute('open')) {
                qsa('.acc-item[open]', root).forEach(o => o.removeAttribute('open'));
            }
            item.toggleAttribute('open');
        });
    });
}
/* ── 세그먼티드 / nav 액티브 ─────────────────────────────────────── */
function initSegmented() {
    qsa('[data-seg]').forEach(seg => {
        qsa('.seg-btn', seg).forEach(btn => btn.addEventListener('click', () => {
            qsa('.seg-btn', seg).forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
            const msg = seg.dataset.segMsg;
            if (msg)
                toast(msg.replace('{v}', btn.dataset.value ?? btn.textContent ?? ''), { kind: 'ok', title: '세그먼트' });
        }));
    });
}
/* ── 슬라이더 값 버블 ────────────────────────────────────────────── */
function initSliders() {
    qsa('input[type="range"][data-bubble]').forEach(range => {
        const wrap = range.parentElement.querySelector('.range-bubble');
        if (!wrap)
            return;
        const paint = () => {
            const pct = ((Number(range.value) - Number(range.min)) / (Number(range.max) - Number(range.min))) * 100;
            range.style.setProperty('--fill', `${pct}%`);
            wrap.textContent = `${range.value}${range.dataset.unit ?? ''}`;
            wrap.style.left = `calc(${pct}% )`;
        };
        range.addEventListener('input', paint);
        paint();
    });
    /* 링 게이지 연동 데모 */
    const slider = qs('#ring-slider');
    const ring = qs('#ring-demo');
    if (slider && ring) {
        const g = renderRing(ring, Number(slider.value), { caption: '진행률' });
        slider.addEventListener('input', () => g.set(Number(slider.value)));
    }
    /* 프로그레스 데모 */
    const progSlider = qs('#prog-slider');
    const progBar = qs('#prog-demo .bar');
    const progPct = qs('#prog-pct');
    if (progSlider && progBar && progPct) {
        const paint = () => {
            progBar.style.width = `${progSlider.value}%`;
            progPct.textContent = `${progSlider.value}%`;
        };
        progSlider.addEventListener('input', paint);
        paint();
    }
}
/* ── 패스워드 표시/숨김 ──────────────────────────────────────────── */
const I_EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 12S6 4.5 12 4.5 22.5 12 22.5 12 18 19.5 12 19.5 1.5 12 1.5 12Z"/><circle cx="12" cy="12" r="3.2"/></svg>';
const I_EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4l16 16"/><path d="M10.6 5.2A9.9 9.9 0 0 1 12 5c6 0 10.5 7 10.5 7a19.3 19.3 0 0 1-3.2 4M6.2 6.3A18.5 18.5 0 0 0 1.5 12S6 19 12 19a9.6 9.6 0 0 0 3.4-.6"/><path d="M9.6 9.6a3.2 3.2 0 0 0 4.5 4.5"/></svg>';
function initPasswordToggle() {
    qsa('[data-pw-toggle]').forEach(btn => {
        btn.innerHTML = I_EYE_OFF;
        btn.addEventListener('click', () => {
            const inp = qs('#' + btn.dataset.pwToggle);
            if (!inp)
                return;
            const show = inp.type === 'password';
            inp.type = show ? 'text' : 'password';
            btn.innerHTML = show ? I_EYE : I_EYE_OFF;
            btn.setAttribute('aria-label', show ? '숨기기' : '보기');
        });
    });
}
/* ── 인풋 클리어 버튼 ────────────────────────────────────────────── */
function initClearButtons() {
    qsa('[data-clear]').forEach(btn => {
        btn.addEventListener('click', () => {
            const inp = qs('#' + btn.dataset.clear);
            if (inp) {
                inp.value = '';
                inp.focus();
            }
            const suf = btn.closest('.suffix');
            if (suf)
                delete suf.dataset.show;
        });
    });
    document.addEventListener('input', e => {
        const inp = e.target;
        if (!inp.matches('.input'))
            return;
        const wrap = inp.closest('.input-wrap');
        const btn = wrap?.querySelector('[data-clear]');
        const suf = btn?.closest('.suffix');
        if (btn && suf) {
            if (inp.value)
                suf.dataset.show = '1';
            else
                delete suf.dataset.show;
        }
    });
}
/* ── 알림 배너 닫기 (data 속성 불필요 — .a-close) ────────────────── */
function initAlerts() {
    document.addEventListener('click', e => {
        const closeBtn = e.target.closest('.a-close');
        if (closeBtn)
            closeBtn.closest('.alert')?.remove();
    });
}
/* ── 텍스트영역 카운터 ───────────────────────────────────────────── */
function initCounters() {
    qsa('[data-counter]').forEach(counter => {
        const txt = qs(counter.dataset.counter);
        if (!txt)
            return;
        const paint = () => {
            const max = Number(counter.dataset.max ?? 0);
            const badge = `${txt.value.length}${max ? ` / ${max}` : ''}`;
            counter.textContent = badge;
            counter.classList.toggle('faint', !max || txt.value.length < max);
        };
        txt.addEventListener('input', paint);
        paint();
    });
}
/* ── OTP ─────────────────────────────────────────────────────────── */
function initOtp() {
    qsa('[data-otp]').forEach(otp => {
        const inputs = qsa('.otp', otp);
        inputs.forEach((inp, i) => {
            inp.addEventListener('input', () => {
                inp.value = inp.value.replace(/\D/g, '').slice(0, 1);
                inp.classList.toggle('filled', !!inp.value);
                if (inp.value && i < inputs.length - 1)
                    inputs[i + 1].focus();
            });
            inp.addEventListener('keydown', e => {
                if (e.key === 'Backspace' && !inp.value && i > 0)
                    inputs[i - 1].focus();
            });
            inp.addEventListener('paste', e => {
                e.preventDefault();
                const digits = (e.clipboardData?.getData('text') ?? '').replace(/\D/g, '').slice(0, inputs.length);
                digits.split('').forEach((d, j) => {
                    if (inputs[j]) {
                        inputs[j].value = d;
                        inputs[j].classList.add('filled');
                    }
                });
                inputs[Math.min(digits.length, inputs.length - 1)].focus();
            });
        });
        if (inputs.length > 4) {
            const btn = qs('.btn', otp.parentElement);
            btn?.addEventListener('click', () => {
                inputs.forEach(inp => { inp.value = ''; inp.classList.remove('filled'); });
                inputs[0].focus();
                toast('인증번호를 지웠어요', { kind: 'info', title: 'OTP' });
            });
        }
    });
}
/* ── 칩 인풋 (태그) ──────────────────────────────────────────────── */
function initChipsInputs() {
    qsa('[data-chips]').forEach(wrap => {
        const input = qs('input', wrap);
        const add = (raw) => {
            const v = raw.trim().replace(/,$/, '');
            if (!v)
                return;
            if (wrap.dataset.max && qsa('.chip', wrap).length >= Number(wrap.dataset.max)) {
                toast('태그는 최대 5개까지', { kind: 'warn', title: '태그' });
                return;
            }
            const chip = document.createElement('span');
            chip.className = 'chip';
            chip.innerHTML = `${escapeHtml(v)}<button class="x" aria-label="제거"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>`;
            chip.querySelector('.x').addEventListener('click', () => chip.remove());
            input.before(chip);
        };
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                add(input.value);
                input.value = '';
            }
            if (e.key === 'Backspace' && !input.value) {
                wrap.querySelector('.chip:last-child')?.remove();
            }
        });
        input.addEventListener('blur', () => {
            if (input.value) {
                add(input.value);
                input.value = '';
            }
        });
        input.addEventListener('paste', () => setTimeout(() => {
            input.value.split(',').forEach(t => add(t));
            input.value = '';
        }, 0));
    });
}
/* ── 콤보박스 ────────────────────────────────────────────────────── */
function initComboboxes() {
    qsa('[data-combo]').forEach(box => {
        const input = qs('input', box);
        const list = qs('.combo-list', box);
        const items = qsa('.co-item', list);
        const open = () => {
            list.setAttribute('open', '');
            list.querySelectorAll('.co-item').forEach(i => {
                const hay = (i.textContent ?? '').toLowerCase();
                i.style.display = hay.includes(input.value.toLowerCase()) ? '' : 'none';
            });
        };
        input.addEventListener('focus', open);
        input.addEventListener('click', open);
        input.addEventListener('input', open);
        input.addEventListener('keydown', e => {
            if (e.key === 'ArrowDown')
                (list.querySelector('.co-item:not([style*="none"])'))?.focus();
        });
        const itemVal = (item) => item.dataset.value ?? (item.textContent ?? '').replace(item.querySelector('.sub')?.textContent ?? '', '').trim();
        items.forEach(item => item.addEventListener('mousedown', (e) => {
            e.preventDefault();
            input.value = itemVal(item);
            list.removeAttribute('open');
            toast(`"${input.value}" 선택됨`, { kind: 'ok', title: '콤보박스' });
        }));
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                const visible = qsa('.co-item', list).find(i => i.style.display !== 'none');
                if (visible) {
                    input.value = itemVal(visible);
                    list.removeAttribute('open');
                }
            }
        });
        document.addEventListener('click', e => {
            if (!box.contains(e.target))
                list.removeAttribute('open');
        });
    });
}
/* ── 별점 ────────────────────────────────────────────────────────── */
function initRatings() {
    qsa('[data-rating]').forEach(rating => {
        const stars = qsa('.star', rating);
        const sync = (v) => {
            stars.forEach((s, i) => s.classList.toggle('on', i < v));
            rating.dataset.value = String(v);
        };
        stars.forEach((star, i) => {
            star.addEventListener('click', () => {
                const v = Number(rating.dataset.value ?? 0);
                sync(v === i + 1 ? 0 : i + 1);
                const v2 = Number(rating.dataset.value ?? 0);
                toast(v2 ? `${v2}점 주셨네요` : '별점을 지웠어요', { kind: 'info', title: '별점' });
            });
        });
        sync(Number(rating.dataset.value ?? 0));
    });
}
/* ── 복사 버튼 ───────────────────────────────────────────────────── */
function initCopy() {
    qsa('[data-copy]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const target = btn.dataset.copy;
            const el = qs(target);
            const text = el ? el.textContent ?? '' : target;
            try {
                await navigator.clipboard.writeText(text);
                toast('클립보드에 복사됨', { kind: 'ok', title: '복사' });
            }
            catch {
                const ta = document.createElement('textarea');
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                ta.remove();
                toast('클립보드에 복사됨 (fallback)', { kind: 'ok', title: '복사' });
            }
        });
    });
}
/* ── 테이블 정렬 ─────────────────────────────────────────────────── */
function initTableSort() {
    qsa('[data-sort]').forEach(table => {
        qsa('th.sortable', table).forEach(th => {
            th.addEventListener('click', () => {
                const idx = Array.from(th.parentElement.children).indexOf(th);
                const dir = th.dataset.dir === 'asc' ? 'desc' : 'asc';
                qsa('th.sortable', table).forEach(h => { delete h.dataset.dir; });
                th.dataset.dir = dir;
                const rows = Array.from(table.tBodies[0]?.rows ?? []);
                const num = th.dataset.num === 'true';
                const get = (r) => {
                    const v = r.cells[idx]?.textContent?.trim() ?? '';
                    return num ? parseFloat(v.replace(/[^0-9.-]/g, '')) || 0 : v;
                };
                rows.sort((a, b) => {
                    const va = get(a), vb = get(b);
                    const cmp = (num ? va - vb : String(va).localeCompare(String(vb), 'ko'));
                    return dir === 'asc' ? cmp : -cmp;
                });
                const tb = table.tBodies[0];
                rows.forEach(r => tb.appendChild(r));
                toast(`${th.textContent?.trim()} ${dir === 'asc' ? '오름차순' : '내림차순'} 정렬`, { kind: 'info', title: '테이블' });
            });
        });
    });
}
/* ── 테이블 선택 (체크박스 + 툴바) ────────────────────────────────── */
function initTableSelect() {
    qsa('[data-select-all]').forEach(all => {
        const tb = all.closest('.table-wrap');
        all.addEventListener('change', () => {
            qsa('.row-check', tb).forEach(c => c.checked = all.checked);
            syncSelCount(tb);
        });
        qsa('.row-check', tb).forEach(c => c.addEventListener('change', () => {
            const checks = qsa('.row-check', tb);
            all.checked = checks.every(x => x.checked);
            all.indeterminate = checks.some(x => x.checked) && !checks.every(x => x.checked);
            syncSelCount(tb);
        }));
    });
}
function syncSelCount(tb) {
    const n = qsa('.row-check:checked', tb).length;
    const count = tb.querySelector('.sel-count');
    const bulk = tb.querySelector('.bulk-bar');
    if (!count)
        return;
    count.textContent = n ? `${n}개 선택됨` : '';
    if (bulk)
        bulk.style.display = n ? 'flex' : 'none';
}
/* ── 트리 뷰 ─────────────────────────────────────────────────────── */
function initTrees() {
    qsa('[data-tree]').forEach(tree => {
        qsa('.tr-toggle', tree).forEach(tog => {
            tog.addEventListener('click', () => {
                tog.classList.toggle('open');
                const kids = tog.closest('.tr-node')?.querySelector(':scope > .tr-children');
                kids?.classList.toggle('collapsed');
            });
        });
        qsa('.tr-row', tree).forEach(row => {
            row.addEventListener('click', () => {
                qsa('.tr-row.selected', tree).forEach(r => r.classList.remove('selected'));
                row.classList.add('selected');
            });
        });
    });
}
/* ── 페이지네이션 ─────────────────────────────────────────────────── */
function initPagination() {
    qsa('[data-pagination]').forEach(pg => {
        const btn = (sel) => qs(sel, pg);
        const pages = qsa('.pg-btn:not(.pg-prev):not(.pg-next)', pg);
        const set = (p) => {
            pages.forEach(b => b.classList.toggle('current', Number(b.dataset.page) === p));
            btn('.pg-prev').disabled = p === 1;
            btn('.pg-next').disabled = p === pages.length;
            pg.dataset.page = String(p);
        };
        pages.forEach(b => b.addEventListener('click', () => {
            set(Number(b.dataset.page));
            toast(`${b.dataset.page}페이지로 이동`, { kind: 'info', title: '페이지네이션' });
        }));
        btn('.pg-prev').addEventListener('click', () => set(Math.max(1, Number(pg.dataset.page ?? 1) - 1)));
        btn('.pg-next').addEventListener('click', () => set(Math.min(pages.length, Number(pg.dataset.page ?? 1) + 1)));
        set(1);
    });
}
/* ── 스텝퍼 ──────────────────────────────────────────────────────── */
function initSteppers() {
    qsa('[data-stepper]').forEach(sp => {
        const steps = qsa('.step', sp);
        const btnPrev = qs('.btn', sp.parentElement)?.matches('[data-step-prev]')
            ? qs('[data-step-prev]', sp.parentElement) : null;
        const btnNext = qs('[data-step-next]', sp.parentElement);
        let cur = Number(sp.dataset.current ?? 0);
        const paint = () => {
            steps.forEach((s, i) => {
                s.classList.toggle('done', i < cur);
                s.classList.toggle('active', i === cur);
            });
            if (btnPrev)
                btnPrev.disabled = cur === 0;
            if (btnNext) {
                btnNext.disabled = cur === steps.length - 1;
                btnNext.textContent = cur === steps.length - 2 ? '완료' : '다음';
            }
        };
        btnNext?.addEventListener('click', () => {
            if (cur < steps.length - 1) {
                cur++;
                paint();
            }
            else
                toast('모든 단계 완료!', { kind: 'ok', title: '스텝퍼' });
        });
        btnPrev?.addEventListener('click', () => { if (cur > 0) {
            cur--;
            paint();
        } });
        paint();
    });
}
/* ── 커맨드 팔레트 ───────────────────────────────────────────────── */
function initPalette() {
    const back = qs('[data-palette]');
    if (!back)
        return;
    const input = qs('.p-input-row input', back);
    const list = qs('.p-list', back);
    const HTML = list.innerHTML;
    const open = () => {
        back.setAttribute('open', '');
        list.innerHTML = HTML;
        input.value = '';
        setTimeout(() => input.focus(), 30);
    };
    const close = () => back.removeAttribute('open');
    document.addEventListener('keydown', e => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            open();
        }
        if (e.key === 'Escape' && back.hasAttribute('open'))
            close();
    });
    back.addEventListener('click', e => { if (e.target === back)
        close(); });
    const run = (item) => {
        const target = item.dataset.target;
        close();
        if (target) {
            qs(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        const label = item.textContent?.trim() ?? '';
        toast(`실행: ${label}`, { kind: 'ok', title: '커맨드' });
    };
    input.addEventListener('input', () => {
        const q = input.value.toLowerCase();
        qsa('.p-item', list).forEach(it => {
            const hay = (it.textContent ?? '').toLowerCase();
            it.style.display = hay.includes(q) ? '' : 'none';
        });
        qsa('.p-sec', list).forEach(sec => {
            const visible = qsa('.p-item', sec).some(it => it.style.display !== 'none');
            sec.style.display = visible ? '' : 'none';
        });
    });
    list.addEventListener('click', e => {
        const item = e.target.closest('.p-item');
        if (item)
            run(item);
    });
    input.addEventListener('keydown', e => {
        const items = qsa('.p-item', list).filter(it => it.style.display !== 'none');
        const idx = items.findIndex(it => it.getAttribute('aria-selected') === 'true');
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const ni = clamp(idx + (e.key === 'ArrowDown' ? 1 : -1), 0, items.length - 1);
            items.forEach(it => it.removeAttribute('aria-selected'));
            items[ni]?.setAttribute('aria-selected', 'true');
            items[ni]?.scrollIntoView({ block: 'nearest' });
        }
        else if (e.key === 'Enter') {
            const pick = idx >= 0 ? items[idx] : items[0];
            if (pick)
                run(pick);
        }
        else if (e.key === 'Escape')
            close();
    });
    qsa('.p-item', list).forEach(it => it.addEventListener('mousemove', () => {
        qsa('.p-item', list).forEach(x => x.removeAttribute('aria-selected'));
        it.setAttribute('aria-selected', 'true');
    }));
}
/* ── 드롭존 ──────────────────────────────────────────────────────── */
function initDropzones() {
    qsa('[data-dropzone]').forEach(dz => {
        const input = qs('input[type="file"]', dz) ?? qs('input[type="file"]', dz.parentElement);
        const label = qs('.dz-label', dz);
        const fake = (name, size) => {
            if (label) {
                label.innerHTML = `<strong class="mono" style="color:var(--text)">${escapeHtml(name)}</strong> · ${escapeHtml(size)}`;
            }
            toast(`파일 추가됨: ${name}`, { kind: 'ok', title: '드롭존' });
        };
        dz.addEventListener('click', () => input?.click());
        dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag'); });
        dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
        dz.addEventListener('drop', e => {
            e.preventDefault();
            dz.classList.remove('drag');
            const f = e.dataTransfer?.files?.[0];
            if (f)
                fake(f.name, `${(f.size / 1024).toFixed(1)}KB`);
        });
        input?.addEventListener('change', () => {
            const f = input.files?.[0];
            if (f)
                fake(f.name, `${(f.size / 1024).toFixed(1)}KB`);
        });
    });
}
/* ── 로딩 버튼 데모 ──────────────────────────────────────────────── */
function initLoadingButtons() {
    qsa('[data-loading]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled)
                return;
            const text = btn.textContent;
            btn.classList.add('loading');
            btn.setAttribute('aria-busy', 'true');
            btn.disabled = true;
            setTimeout(() => {
                btn.classList.remove('loading');
                btn.disabled = false;
                btn.removeAttribute('aria-busy');
                btn.textContent = text;
                toast('작업 완료!', { kind: 'ok', title: '로딩 버튼' });
            }, 1600);
        });
    });
}
/* ── 스켈레톤 토글 ───────────────────────────────────────────────── */
function initSkeletonToggle() {
    qsa('[data-skeleton-toggle]').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = qs('#' + btn.dataset.skeletonToggle);
            if (!target)
                return;
            const swapping = target.dataset.swap;
            target.dataset.swap = target.innerHTML;
            target.innerHTML = swapping ?? btn.dataset.skeletonHtml ?? '';
        });
    });
}
/* ── 팝오버 (선언형) ─────────────────────────────────────────────── */
function initPopovers() {
    qsa('[data-popover-open]').forEach(trigger => {
        trigger.addEventListener('click', () => {
            const id = trigger.dataset.popoverOpen;
            const pv = qs(`#${id}`);
            if (!pv)
                return;
            pv.toggleAttribute('open');
            if (pv.hasAttribute('open')) {
                const r = trigger.getBoundingClientRect();
                pv.style.left = `${Math.min(r.left, window.innerWidth - pv.offsetWidth - 12)}px`;
                pv.style.top = `${r.bottom + 8}px`;
            }
        });
    });
    document.addEventListener('click', e => {
        if (!e.target.closest('[data-popover-open], .popover')) {
            qsa('.popover[open]').forEach(p => p.removeAttribute('open'));
        }
    });
}
/* ── 툴팁 (data-tip) 은 CSS 전용 (무동작) ─────────────────────────── */
/* ── 스플릿 버튼 캐럿 클릭 → 드롭다운 (data-dropdown 에 통합됨) ──────── */
/* ── 초기화 ──────────────────────────────────────────────────────── */
function init() {
    initTheme();
    initRings();
    initOverlays();
    initDropdowns();
    initTabs();
    initAccordions();
    initSegmented();
    initSliders();
    initPasswordToggle();
    initClearButtons();
    initCounters();
    initOtp();
    initChipsInputs();
    initComboboxes();
    initRatings();
    initCopy();
    initTableSort();
    initTableSelect();
    initTrees();
    initPagination();
    initSteppers();
    initPalette();
    initDropzones();
    initLoadingButtons();
    initSkeletonToggle();
    initPopovers();
    initAlerts();
}
/* ── 전역 API ────────────────────────────────────────────────────── */
const KIT = {
    version: '1.0.0',
    toast,
    confirm: confirmDialog,
    openModal,
    closeModal,
    ring: renderRing,
    theme: { apply: applyTheme },
    init,
};
if (typeof window !== 'undefined') {
    window.KIT = KIT;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    }
    else {
        init();
    }
}
