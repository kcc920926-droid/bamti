"use strict";
/* ============================================================
   부품 대장 — 동작
   외부 의존 없음. 각 부품은 data 속성으로 스스로를 표시하고,
   여기서 한 번씩 훑어 붙인다. 없는 부품이 있어도 조용히 넘어간다.
   ============================================================ */
/* ── 공용 도구 ───────────────────────────────────────── */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
/** 화면 낭독기에만 알린다. */
function announce(text) {
    const live = $('[data-live]');
    if (!live)
        return;
    live.textContent = '';
    window.setTimeout(() => { live.textContent = text; }, 30);
}
function nudge(el) {
    el.dataset.nudge = 'true';
    window.setTimeout(() => { delete el.dataset.nudge; }, 420);
}
function initTheme() {
    const root = document.documentElement;
    const saved = localStorage.getItem('ledger.theme') ?? 'auto';
    const apply = (t) => {
        if (t === 'auto')
            root.removeAttribute('data-theme');
        else
            root.setAttribute('data-theme', t);
        $$('[data-theme-set]').forEach((b) => {
            b.setAttribute('aria-checked', String(b.dataset.themeSet === t));
        });
        localStorage.setItem('ledger.theme', t);
    };
    apply(saved);
    $$('[data-theme-set]').forEach((btn) => {
        btn.addEventListener('click', () => apply(btn.dataset.themeSet ?? 'auto'));
    });
}
function initDensity() {
    const root = document.documentElement;
    const saved = localStorage.getItem('ledger.density') ?? 'comfortable';
    const apply = (d) => {
        if (d === 'compact')
            root.setAttribute('data-density', 'compact');
        else
            root.removeAttribute('data-density');
        $$('[data-density]').forEach((b) => {
            b.setAttribute('aria-checked', String(b.dataset.density === d));
        });
        localStorage.setItem('ledger.density', d);
    };
    apply(saved);
    $$('[data-density]').forEach((btn) => {
        btn.addEventListener('click', () => apply(btn.dataset.density ?? 'comfortable'));
    });
}
/* ── 색인 레일 (좁은 화면) ───────────────────────────── */
function initRail() {
    const rail = $('[data-rail]');
    const scrim = $('[data-rail-scrim]');
    const toggle = $('[data-rail-toggle]');
    if (!rail || !scrim || !toggle)
        return;
    const set = (open) => {
        rail.dataset.open = String(open);
        scrim.dataset.open = String(open);
        toggle.setAttribute('aria-expanded', String(open));
    };
    toggle.addEventListener('click', () => set(rail.dataset.open !== 'true'));
    scrim.addEventListener('click', () => set(false));
    $$('.index-link', rail).forEach((a) => a.addEventListener('click', () => set(false)));
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && rail.dataset.open === 'true')
            set(false);
    });
}
const PARTS = $$('[data-part]').map((el) => {
    const chapter = el.closest('[data-chapter]')?.getAttribute('data-chapter') ?? '';
    const name = $('.part__name', el)?.textContent?.replace(/\s+/g, ' ').trim() ?? el.id;
    const no = $('.part__no', el)?.textContent?.trim() ?? '';
    const keywords = el.dataset.name ?? '';
    return {
        id: el.id,
        name: name.replace(no, '').replace(/#$/, '').trim(),
        no,
        chapter,
        el,
        haystack: (keywords + ' ' + name + ' ' + chapter + ' ' + no).toLowerCase(),
    };
});
/* ── 걸러내기 ────────────────────────────────────────── */
function initFilter() {
    const input = $('#partFilter');
    const empty = $('[data-filter-empty]');
    const count = $('[data-part-count]');
    if (count)
        count.textContent = String(PARTS.length) + '종';
    if (!input)
        return;
    let timer = 0;
    const run = () => {
        const q = input.value.trim().toLowerCase();
        let shown = 0;
        PARTS.forEach((p) => {
            const hit = q === '' || p.haystack.includes(q);
            p.el.hidden = !hit;
            if (hit)
                shown += 1;
        });
        $$('[data-chapter]').forEach((ch) => {
            const any = $$('[data-part]', ch).some((p) => !p.hidden);
            ch.hidden = q !== '' && !any;
        });
        if (empty)
            empty.dataset.on = String(q !== '' && shown === 0);
        if (count)
            count.textContent = q === '' ? String(PARTS.length) + '종' : shown + ' / ' + PARTS.length;
        if (q !== '')
            announce(shown + '개 부품이 일치합니다.');
    };
    input.addEventListener('input', () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(run, 140);
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && input.value !== '') {
            input.value = '';
            run();
            e.stopPropagation();
        }
    });
    $('[data-filter-reset]')?.addEventListener('click', () => {
        input.value = '';
        run();
        input.focus();
    });
    // "/" 로 걸러내기 칸으로
    document.addEventListener('keydown', (e) => {
        const t = e.target;
        const typing = t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
        if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            input.focus();
            input.select();
        }
    });
}
/* ── 현재 위치 표시 ──────────────────────────────────── */
function initScrollspy() {
    const links = $$('.index-link[href^="#ch-"]');
    const trail = $('[data-trail]');
    const targets = links
        .map((a) => document.getElementById(a.hash.slice(1)))
        .filter((el) => el !== null);
    if (!targets.length)
        return;
    let lock = 0;
    const mark = (id) => {
        links.forEach((a) => {
            const on = a.hash === '#' + id;
            if (on)
                a.setAttribute('aria-current', 'true');
            else
                a.removeAttribute('aria-current');
        });
        if (trail) {
            const section = document.getElementById(id);
            const label = section?.dataset.chapter;
            const no = section ? $('.chapter__title .no', section)?.textContent?.trim() : undefined;
            trail.textContent = label ? (no ? no + ' ' + label : label) : '표제';
        }
    };
    const io = new IntersectionObserver((entries) => {
        if (Date.now() < lock)
            return;
        const visible = entries
            .filter((en) => en.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible)
            mark(visible.target.id);
    }, { rootMargin: '-20% 0px -70% 0px', threshold: 0 });
    targets.forEach((t) => io.observe(t));
    links.forEach((a) => a.addEventListener('click', () => {
        lock = Date.now() + 700;
        mark(a.hash.slice(1));
    }));
}
/* ── 복사 ────────────────────────────────────────────── */
async function writeClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    }
    catch {
        // 권한이 없거나 file:// 인 경우의 대체 경로
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        let ok = false;
        try {
            ok = document.execCommand('copy');
        }
        catch {
            ok = false;
        }
        ta.remove();
        return ok;
    }
}
function flashIcon(btn) {
    const svg = $('svg use', btn);
    if (!svg)
        return;
    const before = svg.getAttribute('href') ?? '';
    svg.setAttribute('href', '#i-check');
    window.setTimeout(() => svg.setAttribute('href', before), 1400);
}
function initCopy() {
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-copy]');
        if (!btn)
            return;
        void writeClipboard(btn.dataset.copy ?? '').then((ok) => {
            if (ok) {
                flashIcon(btn);
                toast(ok ? '복사했습니다' : '복사하지 못했습니다', ok ? 'success' : 'danger');
            }
        });
    });
    // 색 견본 · 아이콘 격자
    $$('[data-token]').forEach((sw) => {
        sw.addEventListener('click', () => {
            const token = sw.dataset.token ?? '';
            void writeClipboard('var(' + token + ')').then(() => toast('var(' + token + ') 복사', 'info'));
        });
    });
    $$('[data-icon]').forEach((cell) => {
        cell.addEventListener('click', () => {
            const id = cell.dataset.icon ?? '';
            const snippet = '<svg aria-hidden="true"><use href="#' + id + '"></use></svg>';
            void writeClipboard(snippet).then((ok) => {
                if (!ok)
                    return;
                cell.dataset.copied = 'true';
                window.setTimeout(() => { delete cell.dataset.copied; }, 900);
                announce(id + ' 아이콘 코드를 복사했습니다.');
            });
        });
    });
}
const TONE_ICON = {
    success: '#i-ok',
    danger: '#i-danger',
    info: '#i-info',
    undo: '#i-refresh',
};
function toast(message, tone = 'info') {
    const region = $('[data-toast-region]');
    if (!region)
        return;
    while (region.children.length >= 3)
        region.firstElementChild?.remove();
    const life = tone === 'undo' ? 8000 : 5000;
    const el = document.createElement('div');
    el.className = 'toast';
    el.dataset.tone = tone === 'undo' ? 'info' : tone;
    el.innerHTML =
        '<svg class="toast__ico" aria-hidden="true"><use href="' + TONE_ICON[tone] + '"></use></svg>' +
            '<div><div class="toast__title"></div></div>' +
            (tone === 'undo'
                ? '<button class="btn btn--sm" type="button" data-toast-undo>되돌리기</button>'
                : '<button class="btn btn--quiet btn--icon btn--sm" type="button" aria-label="닫기">' +
                    '<svg aria-hidden="true"><use href="#i-x"></use></svg></button>') +
            '<span class="toast__bar"><i style="animation-duration:' + life + 'ms"></i></span>';
    const title = $('.toast__title', el);
    if (title)
        title.textContent = message;
    const close = () => {
        el.dataset.leaving = 'true';
        window.setTimeout(() => el.remove(), 200);
    };
    $('button', el)?.addEventListener('click', () => {
        if (tone === 'undo')
            announce('되돌렸습니다.');
        close();
    });
    region.appendChild(el);
    let timer = window.setTimeout(close, life);
    el.addEventListener('mouseenter', () => window.clearTimeout(timer));
    el.addEventListener('mouseleave', () => { timer = window.setTimeout(close, 1600); });
}
function initToastTriggers() {
    $$('[data-toast]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const [msg, tone] = (btn.dataset.toast ?? '').split('|');
            toast(msg ?? '', tone ?? 'info');
        });
    });
    $('[data-toast-clear]')?.addEventListener('click', () => {
        $$('.toast').forEach((t) => t.remove());
    });
    $$('[data-dismiss]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const box = btn.closest('.alert, .banner');
            if (!box)
                return;
            box.style.transition = 'opacity 180ms, transform 180ms';
            box.style.opacity = '0';
            box.style.transform = 'translateX(8px)';
            window.setTimeout(() => { box.style.display = 'none'; }, 190);
            announce('알림을 닫았습니다.');
        });
    });
}
/* ── 명령 팔레트 ─────────────────────────────────────── */
function initPalette() {
    const scrim = $('[data-palette]');
    const input = $('[data-palette-input]');
    const results = $('[data-palette-results]');
    if (!scrim || !input || !results)
        return;
    let index = 0;
    let matches = [];
    let opener = null;
    const render = () => {
        const q = input.value.trim().toLowerCase();
        matches = (q === '' ? PARTS : PARTS.filter((p) => p.haystack.includes(q))).slice(0, 40);
        index = 0;
        if (!matches.length) {
            results.innerHTML = '<p class="combo__empty">일치하는 부품이 없습니다.</p>';
            return;
        }
        let html = '';
        let group = '';
        matches.forEach((p, i) => {
            if (p.chapter !== group) {
                group = p.chapter;
                html += '<p class="palette__group">' + group + '</p>';
            }
            html +=
                '<button class="palette__opt" type="button" role="option" data-i="' + i + '"' +
                    (i === 0 ? ' aria-selected="true"' : ' aria-selected="false"') + '>' +
                    '<span>' + p.name + '</span><small>' + p.no + '</small></button>';
        });
        results.innerHTML = html;
    };
    const highlight = () => {
        $$('.palette__opt', results).forEach((opt) => {
            const on = Number(opt.dataset.i) === index;
            opt.setAttribute('aria-selected', String(on));
            if (on)
                opt.scrollIntoView({ block: 'nearest' });
        });
    };
    const close = () => {
        scrim.hidden = true;
        opener?.focus();
    };
    const open = () => {
        opener = document.activeElement;
        scrim.hidden = false;
        input.value = '';
        render();
        input.focus();
    };
    const go = (i) => {
        const p = matches[i];
        if (!p)
            return;
        close();
        p.el.scrollIntoView({ block: 'start', behavior: 'smooth' });
        window.setTimeout(() => { location.hash = '#' + p.id; }, 320);
        announce(p.name + ' 부품으로 이동했습니다.');
    };
    $$('[data-palette-open]').forEach((b) => b.addEventListener('click', open));
    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            if (scrim.hidden)
                open();
            else
                close();
        }
        else if (e.key === 'Escape' && !scrim.hidden) {
            close();
        }
    });
    input.addEventListener('input', render);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            index = clamp(index + 1, 0, matches.length - 1);
            highlight();
        }
        else if (e.key === 'ArrowUp') {
            e.preventDefault();
            index = clamp(index - 1, 0, matches.length - 1);
            highlight();
        }
        else if (e.key === 'Enter') {
            e.preventDefault();
            go(index);
        }
    });
    results.addEventListener('click', (e) => {
        const opt = e.target.closest('.palette__opt');
        if (opt)
            go(Number(opt.dataset.i));
    });
    scrim.addEventListener('click', (e) => { if (e.target === scrim)
        close(); });
    // 표시용 단축키를 기기에 맞게 고친다
    if (!isMac) {
        $$('.kbd').forEach((k) => {
            if (k.textContent === '⌘K')
                k.textContent = 'Ctrl K';
            else if (k.textContent === '⌘')
                k.textContent = 'Ctrl';
            else if (k.textContent === '⇧')
                k.textContent = 'Shift';
        });
    }
}
/* ── 모달 · 서랍 · 판 ────────────────────────────────── */
function initDialogs() {
    let opener = null;
    const openDialog = (id) => {
        const dlg = document.getElementById(id);
        if (!dlg)
            return;
        opener = document.activeElement;
        if (typeof dlg.showModal === 'function')
            dlg.showModal();
        else
            dlg.setAttribute('open', '');
        const auto = $('[data-autofocus]', dlg) ?? $('input, button, select, textarea', dlg);
        auto?.focus();
    };
    $$('[data-modal-open]').forEach((btn) => {
        btn.addEventListener('click', () => openDialog(btn.dataset.modalOpen ?? ''));
    });
    $$('[data-confirm-open]').forEach((btn) => {
        btn.addEventListener('click', () => openDialog('dlg-confirm'));
    });
    $$('dialog').forEach((dlg) => {
        $$('[data-modal-close]', dlg).forEach((btn) => btn.addEventListener('click', () => dlg.close()));
        // 바탕을 눌러 닫기 — 판 안쪽 클릭은 무시
        dlg.addEventListener('click', (e) => {
            if (e.target === dlg)
                dlg.close();
        });
        dlg.addEventListener('close', () => opener?.focus());
    });
}
/* ── 드롭다운 (버튼 + 메뉴) ──────────────────────────── */
function initDropdowns() {
    const closeAll = (except) => {
        $$('[data-dropdown]').forEach((d) => {
            if (d === except)
                return;
            d.dataset.open = 'false';
            $('[data-dropdown-trigger]', d)?.setAttribute('aria-expanded', 'false');
        });
    };
    $$('[data-dropdown]').forEach((dd) => {
        const trigger = $('[data-dropdown-trigger]', dd);
        const menu = $('.menu', dd);
        if (!trigger || !menu)
            return;
        const items = () => $$('.menu__item:not([aria-disabled="true"])', menu);
        const setOpen = (open) => {
            if (open)
                closeAll(dd);
            dd.dataset.open = String(open);
            trigger.setAttribute('aria-expanded', String(open));
            if (open)
                items()[0]?.focus();
            else
                trigger.focus();
        };
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            setOpen(dd.dataset.open !== 'true');
        });
        trigger.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setOpen(true);
            }
        });
        menu.addEventListener('keydown', (e) => {
            const list = items();
            const at = list.indexOf(document.activeElement);
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                list[clamp(at + 1, 0, list.length - 1)]?.focus();
            }
            else if (e.key === 'ArrowUp') {
                e.preventDefault();
                list[clamp(at - 1, 0, list.length - 1)]?.focus();
            }
            else if (e.key === 'Home') {
                e.preventDefault();
                list[0]?.focus();
            }
            else if (e.key === 'End') {
                e.preventDefault();
                list[list.length - 1]?.focus();
            }
            else if (e.key === 'Escape') {
                e.preventDefault();
                setOpen(false);
            }
            else if (e.key === 'Tab')
                setOpen(false);
        });
        $$('.menu__item', menu).forEach((item) => {
            item.addEventListener('click', () => {
                if (item.dataset.menuCheck === undefined)
                    setOpen(false);
            });
        });
    });
    document.addEventListener('click', () => closeAll());
    // 메뉴 안의 켜고 끄는 항목
    $$('[data-menu-check]').forEach((item) => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const on = item.getAttribute('aria-checked') === 'true';
            item.setAttribute('aria-checked', String(!on));
            const slot = $('.menu__check', item);
            if (slot) {
                slot.innerHTML = !on
                    ? '<svg width="14" height="14" aria-hidden="true"><use href="#i-check"></use></svg>'
                    : '';
            }
        });
    });
}
/* ── 도움말 풍선 ─────────────────────────────────────── */
function initTips() {
    $$('[data-tip]').forEach((host) => {
        const show = () => { host.dataset.open = 'true'; };
        const hide = () => { host.dataset.open = 'false'; };
        host.addEventListener('mouseenter', show);
        host.addEventListener('mouseleave', hide);
        host.addEventListener('focusin', show);
        host.addEventListener('focusout', hide);
        host.addEventListener('keydown', (e) => { if (e.key === 'Escape')
            hide(); });
    });
}
/* ── 붙는 판 ─────────────────────────────────────────── */
function initPopovers() {
    $$('[data-popover]').forEach((host) => {
        const trigger = $('[data-pop-trigger]', host);
        const pop = $('[data-pop]', host);
        if (!trigger || !pop)
            return;
        const setOpen = (open) => {
            pop.hidden = !open;
            trigger.setAttribute('aria-expanded', String(open));
            if (open)
                $('input, select, button', pop)?.focus();
            else
                trigger.focus();
        };
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            setOpen(pop.hidden === true);
        });
        $$('[data-pop-close]', pop).forEach((b) => b.addEventListener('click', () => setOpen(false)));
        document.addEventListener('click', (e) => {
            if (!pop.hidden && !host.contains(e.target))
                setOpen(false);
        });
        host.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !pop.hidden) {
                e.stopPropagation();
                setOpen(false);
            }
        });
    });
}
/* ── 맥락 메뉴 ───────────────────────────────────────── */
function initContextMenu() {
    const menu = $('[data-ctx-menu]');
    const target = $('[data-ctx-target]');
    if (!menu || !target)
        return;
    const open = (x, y) => {
        menu.hidden = false;
        const w = menu.offsetWidth;
        const h = menu.offsetHeight;
        menu.style.left = Math.min(x, window.innerWidth - w - 8) + 'px';
        menu.style.top = Math.min(y, window.innerHeight - h - 8) + 'px';
        $('.menu__item', menu)?.focus();
    };
    const close = () => { menu.hidden = true; };
    target.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        open(e.clientX, e.clientY);
    });
    target.setAttribute('tabindex', '0');
    target.addEventListener('keydown', (e) => {
        if (e.key === 'F10' && e.shiftKey) {
            e.preventDefault();
            const r = target.getBoundingClientRect();
            open(r.left + 20, r.top + 20);
        }
    });
    document.addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape')
        close(); });
    $$('.menu__item', menu).forEach((i) => i.addEventListener('click', close));
}
/* ── 탭 ──────────────────────────────────────────────── */
function initTabs() {
    $$('[data-tabs]').forEach((wrap) => {
        const tabs = $$('[role="tab"]', wrap);
        const vertical = $('[role="tablist"]', wrap)?.getAttribute('aria-orientation') === 'vertical';
        const select = (tab) => {
            tabs.forEach((t) => {
                const on = t === tab;
                t.setAttribute('aria-selected', String(on));
                t.tabIndex = on ? 0 : -1;
                const panel = document.getElementById(t.getAttribute('aria-controls') ?? '');
                if (panel)
                    panel.hidden = !on;
            });
        };
        tabs.forEach((tab) => {
            tab.addEventListener('click', () => select(tab));
            tab.addEventListener('keydown', (e) => {
                const next = vertical ? 'ArrowDown' : 'ArrowRight';
                const prev = vertical ? 'ArrowUp' : 'ArrowLeft';
                const at = tabs.indexOf(tab);
                let to = -1;
                if (e.key === next)
                    to = (at + 1) % tabs.length;
                else if (e.key === prev)
                    to = (at - 1 + tabs.length) % tabs.length;
                else if (e.key === 'Home')
                    to = 0;
                else if (e.key === 'End')
                    to = tabs.length - 1;
                if (to < 0)
                    return;
                e.preventDefault();
                const target = tabs[to];
                if (!target)
                    return;
                select(target);
                target.focus();
            });
        });
    });
}
/* ── 접이식 ──────────────────────────────────────────── */
function initAccordions() {
    $$('[data-accordion]').forEach((acc) => {
        $$('.accordion__trigger', acc).forEach((trigger) => {
            trigger.addEventListener('click', () => {
                const open = trigger.getAttribute('aria-expanded') === 'true';
                trigger.setAttribute('aria-expanded', String(!open));
                const panel = document.getElementById(trigger.getAttribute('aria-controls') ?? '');
                if (panel)
                    panel.dataset.open = String(!open);
            });
        });
    });
}
/* ── 버튼 묶음 · 켜고 끄기 · 분절 제어 ───────────────── */
function initGroups() {
    $$('[data-btn-group]').forEach((group) => {
        const btns = $$('button', group);
        btns.forEach((b) => b.addEventListener('click', () => {
            // 도구줄의 굵게·기울임은 서로 배타적이지 않다
            const exclusive = group.getAttribute('aria-label') !== '편집';
            if (exclusive)
                btns.forEach((x) => x.setAttribute('aria-pressed', 'false'));
            b.setAttribute('aria-pressed', exclusive ? 'true' : String(b.getAttribute('aria-pressed') !== 'true'));
        }));
    });
    $$('[data-toggle]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const on = btn.getAttribute('aria-pressed') === 'true';
            btn.setAttribute('aria-pressed', String(!on));
        });
    });
    $$('[data-segmented]').forEach((seg) => {
        const btns = $$('button', seg);
        const pick = (b) => {
            btns.forEach((x) => x.setAttribute('aria-checked', String(x === b)));
        };
        btns.forEach((b, i) => {
            b.addEventListener('click', () => pick(b));
            b.addEventListener('keydown', (e) => {
                let to = -1;
                if (e.key === 'ArrowRight')
                    to = (i + 1) % btns.length;
                else if (e.key === 'ArrowLeft')
                    to = (i - 1 + btns.length) % btns.length;
                if (to < 0)
                    return;
                e.preventDefault();
                const t = btns[to];
                if (!t)
                    return;
                pick(t);
                t.focus();
            });
        });
    });
    $$('[data-filterbar]').forEach((bar) => {
        const chips = $$('.filter-chip', bar);
        const status = $('[data-filter-status]');
        const clear = $('[data-filter-clear]', bar);
        const sync = () => {
            const on = chips.filter((c) => c.getAttribute('aria-pressed') === 'true');
            if (clear) {
                clear.hidden = on.length === 0;
                clear.textContent = '조건 ' + on.length + '개 지우기';
            }
            if (status) {
                status.textContent = on.length === 0
                    ? '조건 없음 · 102개 표시 중'
                    : '조건 ' + on.length + '개 적용 · ' + (102 - on.length * 25) + '개 표시 중';
            }
        };
        chips.forEach((c) => c.addEventListener('click', () => {
            c.setAttribute('aria-pressed', String(c.getAttribute('aria-pressed') !== 'true'));
            sync();
        }));
        clear?.addEventListener('click', () => {
            chips.forEach((c) => c.setAttribute('aria-pressed', 'false'));
            sync();
        });
        sync();
    });
    $$('[data-pager]').forEach((pager) => {
        const btns = $$('.pager__btn', pager).filter((b) => /^\d+$/.test(b.textContent?.trim() ?? ''));
        btns.forEach((b) => b.addEventListener('click', () => {
            btns.forEach((x) => x.removeAttribute('aria-current'));
            b.setAttribute('aria-current', 'page');
            const page = Number(b.textContent);
            const info = $('[data-pager-info]', pager);
            if (info)
                info.textContent = (page - 1) * 20 + 1 + '–' + page * 20 + ' / 476개';
        }));
    });
}
/* ── 슬라이더 ────────────────────────────────────────── */
function initSliders() {
    $$('[data-slider]').forEach((wrap) => {
        const input = $('[data-slider-input]', wrap);
        const out = $('[data-slider-out]', wrap);
        if (!input)
            return;
        const sync = () => {
            const min = Number(input.min || 0);
            const max = Number(input.max || 100);
            const pct = ((Number(input.value) - min) / (max - min)) * 100;
            input.style.setProperty('--fill', pct + '%');
            if (out)
                out.textContent = input.value + (input.dataset.unit ?? '');
        };
        input.addEventListener('input', sync);
        sync();
    });
    $$('[data-dual]').forEach((wrap) => {
        const lo = $('[data-dual-input="lo"]', wrap);
        const hi = $('[data-dual-input="hi"]', wrap);
        const sel = $('[data-dual-sel]', wrap);
        const loOut = $('[data-dual-lo]', wrap);
        const hiOut = $('[data-dual-hi]', wrap);
        if (!lo || !hi || !sel)
            return;
        const sync = () => {
            const min = Number(lo.min || 0);
            const max = Number(lo.max || 100);
            const step = Number(lo.step || 1);
            let a = Number(lo.value);
            let b = Number(hi.value);
            if (a > b - step) {
                if (document.activeElement === lo) {
                    a = b - step;
                    lo.value = String(a);
                }
                else {
                    b = a + step;
                    hi.value = String(b);
                }
            }
            const p = (v) => ((v - min) / (max - min)) * 100;
            sel.setAttribute('style', 'left:' + p(a) + '%;width:' + (p(b) - p(a)) + '%');
            if (loOut)
                loOut.textContent = String(a);
            if (hiOut)
                hiOut.textContent = String(b);
        };
        lo.addEventListener('input', sync);
        hi.addEventListener('input', sync);
        sync();
    });
}
/* ── 수량 증감 ───────────────────────────────────────── */
function initSteppers() {
    $$('[data-stepper]').forEach((wrap) => {
        const input = $('input', wrap);
        if (!input)
            return;
        const min = Number(input.min || 0);
        const max = Number(input.max || 99);
        const sync = () => {
            const v = clamp(Number(input.value || 0), min, max);
            input.value = String(v);
            $$('button', wrap).forEach((b) => {
                const dir = Number(b.dataset.step);
                b.disabled = dir < 0 ? v <= min : v >= max;
            });
        };
        $$('button', wrap).forEach((b) => b.addEventListener('click', () => {
            input.value = String(Number(input.value || 0) + Number(b.dataset.step ?? 0));
            sync();
            announce('값 ' + input.value);
        }));
        input.addEventListener('change', sync);
        sync();
    });
}
/* ── 별점 ────────────────────────────────────────────── */
function initRatings() {
    $$('[data-rating]').forEach((wrap) => {
        const stars = $$('button', wrap);
        const out = $('[data-rating-out]', wrap);
        const paint = (n) => {
            stars.forEach((s, i) => {
                if (i < n)
                    s.dataset.on = 'true';
                else
                    delete s.dataset.on;
                s.setAttribute('aria-checked', String(i === n - 1));
            });
            if (out)
                out.textContent = n + ' / ' + stars.length;
        };
        const value = () => Number(wrap.dataset.value ?? 0);
        stars.forEach((s, i) => {
            s.addEventListener('mouseenter', () => paint(i + 1));
            s.addEventListener('click', () => {
                wrap.dataset.value = String(value() === i + 1 ? 0 : i + 1);
                paint(value());
                announce(value() + '점을 주었습니다.');
            });
            s.addEventListener('keydown', (e) => {
                let v = value();
                if (e.key === 'ArrowRight')
                    v = clamp(v + 1, 0, stars.length);
                else if (e.key === 'ArrowLeft')
                    v = clamp(v - 1, 0, stars.length);
                else
                    return;
                e.preventDefault();
                wrap.dataset.value = String(v);
                paint(v);
                stars[clamp(v - 1, 0, stars.length - 1)]?.focus();
            });
        });
        wrap.addEventListener('mouseleave', () => paint(value()));
        paint(value());
    });
}
/* ── 인증번호 칸 ─────────────────────────────────────── */
function initPins() {
    $$('[data-pin]').forEach((wrap) => {
        const cells = $$('input', wrap);
        const status = $('[data-pin-status]');
        const sync = () => {
            cells.forEach((c) => {
                if (c.value)
                    c.dataset.filled = 'true';
                else
                    delete c.dataset.filled;
            });
            const filled = cells.filter((c) => c.value).length;
            if (status) {
                status.textContent = filled === cells.length
                    ? '여섯 자리를 모두 입력했습니다.'
                    : cells.length - filled + '자리 남았습니다.';
            }
        };
        cells.forEach((cell, i) => {
            cell.addEventListener('input', () => {
                cell.value = cell.value.replace(/\D/g, '').slice(0, 1);
                if (cell.value)
                    cells[i + 1]?.focus();
                sync();
            });
            cell.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !cell.value) {
                    cells[i - 1]?.focus();
                }
                else if (e.key === 'ArrowLeft')
                    cells[i - 1]?.focus();
                else if (e.key === 'ArrowRight')
                    cells[i + 1]?.focus();
            });
            cell.addEventListener('paste', (e) => {
                e.preventDefault();
                const text = (e.clipboardData?.getData('text') ?? '').replace(/\D/g, '');
                cells.forEach((c, j) => { c.value = text[j] ?? c.value; });
                cells[Math.min(text.length, cells.length - 1)]?.focus();
                sync();
            });
        });
        sync();
    });
}
/* ── 태그 입력 ───────────────────────────────────────── */
function initTags() {
    $$('[data-tags]').forEach((box) => {
        const input = $('input', box);
        if (!input)
            return;
        const MAX = 6;
        const chips = () => $$('.tag-chip', box);
        const bind = (chip) => {
            $('button', chip)?.addEventListener('click', () => {
                const name = chip.textContent?.replace('×', '').trim() ?? '';
                chip.remove();
                announce(name + ' 태그를 지웠습니다.');
            });
        };
        chips().forEach(bind);
        const add = (raw) => {
            const name = raw.trim().replace(/,+$/, '');
            if (!name)
                return;
            if (chips().length >= MAX) {
                nudge(box);
                toast('태그는 ' + MAX + '개까지입니다', 'danger');
                return;
            }
            const dup = chips().some((c) => c.textContent?.replace('×', '').trim() === name);
            if (dup) {
                nudge(box);
                announce(name + '은 이미 있습니다.');
                return;
            }
            const chip = document.createElement('span');
            chip.className = 'tag-chip';
            chip.textContent = name;
            const x = document.createElement('button');
            x.type = 'button';
            x.setAttribute('aria-label', name + ' 지우기');
            x.textContent = '×';
            chip.appendChild(x);
            box.insertBefore(chip, input);
            bind(chip);
            announce(name + ' 태그를 추가했습니다.');
        };
        box.addEventListener('click', (e) => { if (e.target === box)
            input.focus(); });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                add(input.value);
                input.value = '';
            }
            else if (e.key === 'Backspace' && input.value === '') {
                const last = chips().pop();
                if (last) {
                    last.remove();
                    announce('마지막 태그를 지웠습니다.');
                }
            }
        });
        input.addEventListener('blur', () => { add(input.value); input.value = ''; });
    });
}
/* ── 자동완성 ────────────────────────────────────────── */
function initCombobox() {
    $$('[data-combo]').forEach((wrap) => {
        const input = $('input', wrap);
        const list = $('.combo__list', wrap);
        if (!input || !list)
            return;
        let matches = [];
        let index = -1;
        const render = () => {
            const q = input.value.trim().toLowerCase();
            matches = q === '' ? [] : PARTS.filter((p) => p.haystack.includes(q)).slice(0, 8);
            index = -1;
            if (!q) {
                list.hidden = true;
                input.setAttribute('aria-expanded', 'false');
                return;
            }
            list.hidden = false;
            input.setAttribute('aria-expanded', 'true');
            if (!matches.length) {
                list.innerHTML = '<li class="combo__empty">일치하는 부품이 없습니다. 분류 이름으로 찾아 보세요.</li>';
                return;
            }
            list.innerHTML = matches
                .map((p, i) => {
                const at = p.name.toLowerCase().indexOf(q);
                const label = at >= 0
                    ? p.name.slice(0, at) + '<mark>' + p.name.slice(at, at + q.length) + '</mark>' + p.name.slice(at + q.length)
                    : p.name;
                return '<li class="combo__opt" role="option" aria-selected="false" data-i="' + i + '">' +
                    '<span>' + label + '</span><small>' + p.no + '</small></li>';
            })
                .join('');
        };
        const highlight = () => {
            $$('.combo__opt', list).forEach((o) => o.setAttribute('aria-selected', String(Number(o.dataset.i) === index)));
        };
        const choose = (i) => {
            const p = matches[i];
            if (!p)
                return;
            input.value = p.name;
            list.hidden = true;
            input.setAttribute('aria-expanded', 'false');
            announce(p.name + ' 선택');
        };
        input.addEventListener('input', render);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                index = clamp(index + 1, 0, matches.length - 1);
                highlight();
            }
            else if (e.key === 'ArrowUp') {
                e.preventDefault();
                index = clamp(index - 1, 0, matches.length - 1);
                highlight();
            }
            else if (e.key === 'Enter' && index >= 0) {
                e.preventDefault();
                choose(index);
            }
            else if (e.key === 'Escape') {
                list.hidden = true;
                input.setAttribute('aria-expanded', 'false');
            }
        });
        list.addEventListener('click', (e) => {
            const opt = e.target.closest('.combo__opt');
            if (opt)
                choose(Number(opt.dataset.i));
        });
        document.addEventListener('click', (e) => {
            if (!wrap.contains(e.target))
                list.hidden = true;
        });
    });
}
/* ── 파일 투입 ───────────────────────────────────────── */
function initDropzone() {
    $$('[data-dropzone]').forEach((zone) => {
        const input = $('[data-dropzone-input]', zone);
        const list = $('[data-file-list]');
        const kb = (n) => n > 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + 'MB' : Math.round(n / 1024) + 'KB';
        const addRow = (file) => {
            if (!list)
                return;
            const ext = (file.name.split('.').pop() ?? '?').toUpperCase().slice(0, 4);
            const over = file.size > 10 * 1024 * 1024;
            const row = document.createElement('div');
            row.className = 'file-row';
            row.innerHTML =
                '<span class="file-row__ico">' + ext + '</span>' +
                    '<span><span class="file-row__name"></span>' +
                    '<span class="file-row__meta"' + (over ? ' style="color:var(--danger-fg)"' : '') + '>' +
                    kb(file.size) + (over ? ' · 크기 초과로 거부됨' : ' · 올림 완료') + '</span></span>' +
                    '<button class="btn btn--quiet btn--icon btn--sm" type="button" aria-label="목록에서 지우기">' +
                    '<svg aria-hidden="true"><use href="#i-trash"></use></svg></button>';
            const nameEl = $('.file-row__name', row);
            if (nameEl)
                nameEl.textContent = file.name;
            $('button', row)?.addEventListener('click', () => row.remove());
            list.prepend(row);
            toast(file.name + (over ? ' — 10MB를 넘어 거부' : ' 을 추가했습니다'), over ? 'danger' : 'success');
        };
        ['dragenter', 'dragover'].forEach((t) => zone.addEventListener(t, (e) => { e.preventDefault(); zone.dataset.over = 'true'; }));
        ['dragleave', 'drop'].forEach((t) => zone.addEventListener(t, () => { delete zone.dataset.over; }));
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            const files = e.dataTransfer?.files;
            if (files)
                Array.from(files).forEach(addRow);
        });
        $('[data-dropzone-pick]', zone)?.addEventListener('click', () => input?.click());
        input?.addEventListener('change', () => {
            if (input.files)
                Array.from(input.files).forEach(addRow);
            input.value = '';
        });
    });
}
/* ── 색 고르기 ───────────────────────────────────────── */
function initColor() {
    $$('[data-color]').forEach((wrap) => {
        const picker = $('input[type="color"]', wrap);
        const hex = $('[data-color-hex]', wrap);
        const preview = $('[data-color-preview]');
        if (!picker || !hex)
            return;
        const paint = (value) => {
            if (!preview)
                return;
            preview.setAttribute('style', 'border-color:' + value + ';background:color-mix(in srgb, ' + value + ' 14%, transparent);color:' + value);
        };
        picker.addEventListener('input', () => {
            hex.value = picker.value.replace('#', '');
            paint(picker.value);
        });
        hex.addEventListener('change', () => {
            const v = hex.value.trim().replace('#', '');
            if (/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) {
                picker.value = '#' + v;
                paint(picker.value);
            }
            else {
                hex.value = picker.value.replace('#', '');
                nudge(hex);
            }
        });
        paint(picker.value);
    });
}
/* ── 달력 · 날짜 고르기 ──────────────────────────────── */
const DOW = ['월', '화', '수', '목', '금', '토', '일'];
function initCalendars() {
    $$('[data-calendar]').forEach((cal) => {
        const grid = $('[data-cal-grid]', cal);
        const label = $('[data-cal-month]', cal);
        if (!grid || !label)
            return;
        const marks = (cal.dataset.marks ?? '').split(',').filter(Boolean).map(Number);
        let view = new Date(2026, 2, 1);
        let picked = '2026-03-04';
        const today = '2026-03-01';
        const key = (y, m, d) => y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        const draw = () => {
            const y = view.getFullYear();
            const m = view.getMonth();
            label.textContent = y + '년 ' + (m + 1) + '월';
            const first = new Date(y, m, 1);
            const offset = (first.getDay() + 6) % 7; // 월요일 시작
            const days = new Date(y, m + 1, 0).getDate();
            let html = DOW.map((d) => '<span class="calendar__dow">' + d + '</span>').join('');
            for (let i = 0; i < offset; i += 1)
                html += '<span></span>';
            for (let d = 1; d <= days; d += 1) {
                const k = key(y, m, d);
                html +=
                    '<button class="calendar__day" type="button" role="gridcell" data-day="' + k + '"' +
                        (k === today ? ' data-today="true"' : '') +
                        (marks.includes(d) ? ' data-marked="true"' : '') +
                        ' aria-pressed="' + String(k === picked) + '">' + d + '</button>';
            }
            grid.innerHTML = html;
            $$('[data-day]', grid).forEach((btn) => {
                btn.addEventListener('click', () => {
                    picked = btn.dataset.day ?? null;
                    draw();
                    const input = $('[data-date-input]', cal.closest('[data-datepick]') ?? document);
                    if (input && picked)
                        input.value = picked;
                    announce((picked ?? '') + ' 선택');
                    const pop = cal.closest('[data-date-pop]');
                    if (pop)
                        pop.hidden = true;
                });
            });
        };
        $('[data-cal-prev]', cal)?.addEventListener('click', () => {
            view = new Date(view.getFullYear(), view.getMonth() - 1, 1);
            draw();
        });
        $('[data-cal-next]', cal)?.addEventListener('click', () => {
            view = new Date(view.getFullYear(), view.getMonth() + 1, 1);
            draw();
        });
        grid.addEventListener('keydown', (e) => {
            const cells = $$('[data-day]', grid);
            const at = cells.indexOf(document.activeElement);
            if (at < 0)
                return;
            const map = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 };
            const step = map[e.key];
            if (step === undefined)
                return;
            e.preventDefault();
            cells[clamp(at + step, 0, cells.length - 1)]?.focus();
        });
        draw();
    });
    $$('[data-datepick]').forEach((host) => {
        const trigger = $('[data-date-open]', host);
        const pop = $('[data-date-pop]', host);
        if (!trigger || !pop)
            return;
        const setOpen = (open) => {
            pop.hidden = !open;
            trigger.setAttribute('aria-expanded', String(open));
            if (open)
                $('[aria-pressed="true"], [data-day]', pop)?.focus();
        };
        trigger.addEventListener('click', (e) => { e.stopPropagation(); setOpen(pop.hidden === true); });
        document.addEventListener('click', (e) => {
            if (!pop.hidden && !host.contains(e.target))
                setOpen(false);
        });
        host.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !pop.hidden) {
                setOpen(false);
                trigger.focus();
            }
        });
    });
}
/* ── 검색 칸 · 비밀번호 · 여러 줄 ────────────────────── */
function initTextInputs() {
    $$('[data-search-demo]').forEach((wrap) => {
        const input = $('input', wrap);
        const clear = $('[data-search-clear]', wrap);
        const count = $('#search-count');
        if (!input || !clear)
            return;
        const sync = () => {
            clear.hidden = input.value === '';
            if (count) {
                const n = input.value === '' ? PARTS.length : PARTS.filter((p) => p.haystack.includes(input.value.toLowerCase())).length;
                count.textContent = n + '개 항목이 일치합니다.';
            }
        };
        input.addEventListener('input', sync);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                input.value = '';
                sync();
            }
        });
        clear.addEventListener('click', () => { input.value = ''; sync(); input.focus(); });
        sync();
    });
    $$('[data-pw-toggle]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const input = $('[data-pw]', btn.closest('.input-wrap') ?? document);
            if (!input)
                return;
            const show = input.type === 'password';
            input.type = show ? 'text' : 'password';
            btn.setAttribute('aria-pressed', String(show));
            btn.setAttribute('aria-label', show ? '비밀번호 가리기' : '비밀번호 보기');
            const use = $('svg use', btn);
            use?.setAttribute('href', show ? '#i-lock' : '#i-eye');
        });
    });
    $$('[data-autogrow]').forEach((ta) => {
        const area = ta;
        const wrap = area.closest('.field');
        const counter = wrap ? $('[data-count-for]', wrap) : null;
        const max = Number(area.dataset.maxlen ?? 0);
        const sync = () => {
            // field-sizing 미지원 브라우저 대비
            if (!CSS.supports('field-sizing', 'content')) {
                area.style.height = 'auto';
                area.style.height = Math.min(area.scrollHeight, 220) + 'px';
            }
            if (counter && max) {
                const n = area.value.length;
                const num = $('.u-num', counter);
                if (num)
                    num.textContent = String(n);
                counter.dataset.over = String(n > max);
            }
        };
        area.addEventListener('input', sync);
        sync();
    });
    const meter = $('[data-pwmeter]');
    if (meter) {
        const input = $('[data-pw-input]', meter);
        const bar = $('[data-pw-bar]', meter);
        const label = $('[data-pw-label]', meter);
        const rules = [
            ['len', (v) => v.length >= 10],
            ['case', (v) => /[a-z]/.test(v) && /[A-Z]/.test(v)],
            ['num', (v) => /\d/.test(v)],
            ['sym', (v) => /[^\w\s]/.test(v)],
        ];
        const sync = () => {
            const v = input?.value ?? '';
            let passed = 0;
            rules.forEach(([name, test]) => {
                const ok = test(v);
                if (ok)
                    passed += 1;
                const li = $('[data-pw-rule="' + name + '"]', meter);
                const tick = li ? $('.tick', li) : null;
                if (tick) {
                    tick.textContent = ok ? '✓' : '○';
                    tick.setAttribute('style', ok ? 'color:var(--success-fg)' : 'color:var(--fg-faint)');
                }
            });
            const pct = (passed / rules.length) * 100;
            const seg = bar ? $('.meter__seg', bar) : null;
            if (seg) {
                seg.setAttribute('style', 'width:' + pct + '%;background:' +
                    (passed <= 1 ? 'var(--danger)' : passed <= 2 ? 'var(--warning)' : passed === 3 ? 'var(--clay-2)' : 'var(--success)'));
            }
            if (label) {
                const names = ['너무 약함', '약함', '보통', '쓸 만함', '튼튼함'];
                const left = rules.length - passed;
                label.textContent = (names[passed] ?? '') + (left ? ' — 조건 ' + left + '개 남음' : ' — 모든 조건 통과');
            }
        };
        input?.addEventListener('input', sync);
        sync();
    }
    // 부모-자식 체크박스
    $$('[data-check-tree]').forEach((tree) => {
        const all = $('[data-check-all]', tree);
        const kids = $$('[data-check-child]', tree);
        if (!all)
            return;
        const sync = () => {
            const on = kids.filter((k) => k.checked).length;
            all.checked = on === kids.length;
            all.indeterminate = on > 0 && on < kids.length;
        };
        all.addEventListener('change', () => {
            kids.forEach((k) => { k.checked = all.checked; });
            sync();
        });
        kids.forEach((k) => k.addEventListener('change', sync));
        sync();
    });
    // 대화 입력창
    const composer = $('[data-composer]');
    if (composer) {
        const input = $('[data-composer-input]', composer);
        const send = $('[data-composer-send]', composer);
        const count = $('[data-composer-count]', composer);
        if (input && send) {
            const sync = () => {
                const n = input.value.trim().length;
                send.disabled = n === 0;
                if (count) {
                    count.textContent = input.value.length + ' / 500';
                    count.dataset.over = String(input.value.length > 500);
                }
            };
            const submit = () => {
                if (!input.value.trim())
                    return;
                const chat = $('[data-chat]');
                if (chat) {
                    const msg = document.createElement('div');
                    msg.className = 'chat__msg';
                    msg.dataset.me = 'true';
                    const bubble = document.createElement('div');
                    bubble.className = 'chat__bubble';
                    bubble.textContent = input.value.trim();
                    const av = document.createElement('span');
                    av.className = 'avatar avatar--sm avatar--accent';
                    av.textContent = '나';
                    msg.append(bubble, av);
                    chat.appendChild(msg);
                }
                input.value = '';
                sync();
                announce('메시지를 보냈습니다.');
            };
            input.addEventListener('input', sync);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                }
            });
            send.addEventListener('click', submit);
            sync();
        }
    }
}
/* ── 입력 검사 ───────────────────────────────────────── */
function initForm() {
    const form = $('[data-form]');
    if (!form)
        return;
    const summary = $('[data-form-summary]', form);
    const summaryList = $('[data-form-summary-list]', form);
    const summaryTitle = $('[data-form-summary-title]', form);
    const state = $('[data-form-state]');
    const validate = (el) => {
        const input = el;
        const label = input.dataset.label ?? '이 항목';
        if (input.type === 'checkbox')
            return input.checked ? null : label + '에 동의해야 합니다';
        const v = (input.value ?? '').trim();
        if (!v)
            return label + '을(를) 입력하세요';
        if (input.tagName === 'SELECT')
            return null;
        if (input.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v))
            return '주소 형식이 맞지 않습니다 (예: name@example.com)';
        if (input.type !== 'email' && v.length < 2)
            return label + '은(는) 두 글자 이상이어야 합니다';
        return null;
    };
    const paint = (el, message) => {
        const field = el.closest('.field') ?? el.closest('.check');
        if (!field)
            return;
        if (field.classList.contains('check')) {
            const err = $('[data-check-err]');
            if (err)
                err.textContent = message ?? '';
            if (err)
                err.setAttribute('style', message ? 'display:flex' : 'display:none');
            return;
        }
        field.dataset.invalid = String(message !== null);
        el.setAttribute('aria-invalid', String(message !== null));
        const err = $('.field__err', field);
        if (err)
            err.textContent = message ?? '';
    };
    const fields = $$('[data-required]', form);
    fields.forEach((el) => {
        el.addEventListener('blur', () => paint(el, validate(el)));
        el.addEventListener('input', () => {
            const field = el.closest('.field');
            if (field?.dataset.invalid === 'true')
                paint(el, validate(el));
        });
    });
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const problems = [];
        fields.forEach((el) => {
            const message = validate(el);
            paint(el, message);
            if (message)
                problems.push({ label: el.dataset.label ?? '', message, el });
        });
        if (problems.length) {
            if (summary && summaryList && summaryTitle) {
                summary.hidden = false;
                summaryTitle.textContent = problems.length + '곳을 고쳐야 보낼 수 있습니다';
                summaryList.innerHTML = problems.map((p) => '<li>· ' + p.message + '</li>').join('');
            }
            problems[0]?.el.focus();
            if (state)
                state.textContent = '보내지 못함 · 오류 ' + problems.length + '건';
            announce(problems.length + '곳에 오류가 있습니다. 첫 번째 칸으로 이동했습니다.');
            return;
        }
        if (summary)
            summary.hidden = true;
        if (state)
            state.textContent = '보냈습니다 · 검토 대기';
        toast('부품 등록 요청을 보냈습니다', 'success');
        form.reset();
        fields.forEach((el) => paint(el, null));
    });
    form.addEventListener('reset', () => {
        window.setTimeout(() => {
            fields.forEach((el) => paint(el, null));
            if (summary)
                summary.hidden = true;
            if (state)
                state.textContent = '아직 보내지 않음';
        }, 0);
    });
}
const ROWS = [
    { no: '02.01', name: '버튼', cat: '동작', states: 6, date: '2026-02-14', owner: '김영후' },
    { no: '03.01', name: '글자 칸', cat: '입력', states: 7, date: '2026-02-09', owner: '박선우' },
    { no: '04.03', name: '탭', cat: '이동', states: 4, date: '2026-01-28', owner: '김영후' },
    { no: '05.01', name: '표', cat: '표시', states: 5, date: '2026-02-11', owner: '이도현' },
    { no: '06.03', name: '알림 조각', cat: '알림', states: 3, date: '2026-02-02', owner: '박선우' },
    { no: '07.01', name: '모달', cat: '겹침', states: 4, date: '2026-01-19', owner: '이도현' },
];
function initTable() {
    const table = $('[data-table]');
    const body = $('[data-table-body]');
    if (!table || !body)
        return;
    let sortKey = 'name';
    let asc = true;
    let query = '';
    const selected = new Set();
    const all = $('[data-table-all]');
    const bulk = $('[data-table-bulk]');
    const selLabel = $('[data-table-sel]');
    const countLabel = $('[data-table-count]');
    const rangeLabel = $('[data-table-range]');
    const view = () => {
        const q = query.trim().toLowerCase();
        const rows = ROWS.filter((r) => q === '' || (r.name + r.cat + r.owner + r.no).toLowerCase().includes(q));
        return rows.sort((a, b) => {
            const x = a[sortKey];
            const y = b[sortKey];
            const cmp = typeof x === 'number' && typeof y === 'number'
                ? x - y
                : String(x).localeCompare(String(y), 'ko');
            return asc ? cmp : -cmp;
        });
    };
    const syncBulk = () => {
        if (bulk)
            bulk.hidden = selected.size === 0;
        if (selLabel)
            selLabel.textContent = selected.size + '개 선택';
        if (all) {
            const shown = view();
            const on = shown.filter((r) => selected.has(r.no)).length;
            all.checked = shown.length > 0 && on === shown.length;
            all.indeterminate = on > 0 && on < shown.length;
        }
    };
    const draw = () => {
        const rows = view();
        body.innerHTML = rows
            .map((r) => '<tr data-no="' + r.no + '" aria-selected="' + String(selected.has(r.no)) + '">' +
            '<td><label class="check" style="gap:0"><input type="checkbox" data-row-check' +
            (selected.has(r.no) ? ' checked' : '') + ' aria-label="' + r.name + ' 선택"></label></td>' +
            '<td><b>' + r.name + '</b> <span class="u-mono u-subtle" style="font-size:var(--t-2xs)">' + r.no + '</span></td>' +
            '<td><span class="badge">' + r.cat + '</span></td>' +
            '<td class="num">' + r.states + '</td>' +
            '<td class="u-mono" style="font-size:var(--t-xs)">' + r.date + '</td>' +
            '<td><span class="row row--tight"><span class="avatar avatar--sm">' + r.owner.slice(0, 1) + '</span>' + r.owner + '</span></td>' +
            '<td><button class="btn btn--quiet btn--icon btn--sm" type="button" aria-label="' + r.name + ' 동작">' +
            '<svg aria-hidden="true"><use href="#i-dots-v"></use></svg></button></td></tr>')
            .join('');
        if (countLabel)
            countLabel.textContent = rows.length + '개 부품';
        if (rangeLabel)
            rangeLabel.textContent = rows.length ? '1–' + rows.length + ' / ' + rows.length : '0개';
        $$('[data-row-check]', body).forEach((cb) => {
            cb.addEventListener('change', () => {
                const no = cb.closest('tr')?.dataset.no ?? '';
                if (cb.checked)
                    selected.add(no);
                else
                    selected.delete(no);
                const tr = cb.closest('tr');
                tr?.setAttribute('aria-selected', String(cb.checked));
                syncBulk();
            });
        });
        syncBulk();
    };
    $$('[data-sort]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.sort;
            if (key === sortKey)
                asc = !asc;
            else {
                sortKey = key;
                asc = true;
            }
            $$('th', table).forEach((th) => th.removeAttribute('aria-sort'));
            btn.closest('th')?.setAttribute('aria-sort', asc ? 'ascending' : 'descending');
            draw();
            announce(btn.textContent?.trim() + ' 기준 ' + (asc ? '오름차순' : '내림차순') + ' 정렬');
        });
    });
    all?.addEventListener('change', () => {
        const rows = view();
        if (all.checked)
            rows.forEach((r) => selected.add(r.no));
        else
            rows.forEach((r) => selected.delete(r.no));
        draw();
    });
    const search = $('[data-table-search]');
    search?.addEventListener('input', () => { query = search.value; draw(); });
    draw();
}
/* ── 순서 바꾸기 목록 ────────────────────────────────── */
function initSortable() {
    $$('[data-sortable]').forEach((list) => {
        const status = $('[data-sortable-status]');
        let dragged = null;
        const renumber = () => {
            $$('.sortable__item', list).forEach((li, i) => {
                const ord = $('.sortable__ord', li);
                if (ord)
                    ord.textContent = String(i + 1);
            });
        };
        const move = (item, dir) => {
            const items = $$('.sortable__item', list);
            const at = items.indexOf(item);
            const to = clamp(at + dir, 0, items.length - 1);
            if (to === at)
                return;
            const ref = items[to];
            if (!ref)
                return;
            if (dir > 0)
                ref.after(item);
            else
                ref.before(item);
            renumber();
            item.focus();
            const name = item.children[1]?.textContent ?? '';
            const msg = name + '을(를) ' + (to + 1) + '번째로 옮겼습니다.';
            if (status)
                status.textContent = msg;
            announce(msg);
        };
        $$('.sortable__item', list).forEach((item) => {
            item.addEventListener('dragstart', () => {
                dragged = item;
                item.dataset.dragging = 'true';
            });
            item.addEventListener('dragend', () => {
                delete item.dataset.dragging;
                delete item.dataset.over;
                dragged = null;
                renumber();
            });
            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (dragged && dragged !== item)
                    item.dataset.over = 'true';
            });
            item.addEventListener('dragleave', () => { delete item.dataset.over; });
            item.addEventListener('drop', (e) => {
                e.preventDefault();
                delete item.dataset.over;
                if (!dragged || dragged === item)
                    return;
                const items = $$('.sortable__item', list);
                if (items.indexOf(dragged) < items.indexOf(item))
                    item.after(dragged);
                else
                    item.before(dragged);
                renumber();
            });
            item.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    move(item, -1);
                }
                else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    move(item, 1);
                }
            });
        });
        renumber();
    });
}
/* ── 나무 ────────────────────────────────────────────── */
function initTree() {
    $$('[data-tree]').forEach((tree) => {
        const rows = $$('.tree__row', tree);
        rows.forEach((row) => {
            const li = row.closest('li');
            const hasKids = li ? li.querySelector('ul') !== null : false;
            const setOpen = (open) => {
                if (!li || !hasKids)
                    return;
                li.dataset.collapsed = String(!open);
                li.setAttribute('aria-expanded', String(open));
                row.setAttribute('aria-expanded', String(open));
            };
            row.addEventListener('click', () => {
                if (hasKids)
                    setOpen(row.getAttribute('aria-expanded') !== 'true');
                else {
                    rows.forEach((r) => r.removeAttribute('aria-current'));
                    row.setAttribute('aria-current', 'true');
                }
            });
            row.addEventListener('keydown', (e) => {
                const at = rows.indexOf(row);
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    rows[at + 1]?.focus();
                }
                else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    rows[at - 1]?.focus();
                }
                else if (e.key === 'ArrowRight' && hasKids) {
                    e.preventDefault();
                    setOpen(true);
                }
                else if (e.key === 'ArrowLeft' && hasKids) {
                    e.preventDefault();
                    setOpen(false);
                }
            });
        });
    });
}
/* ── 그림표 ──────────────────────────────────────────── */
const SVG_NS = 'http://www.w3.org/2000/svg';
function svgEl(name, attrs) {
    const el = document.createElementNS(SVG_NS, name);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
    return el;
}
function initCharts() {
    const bar = $('[data-chart="bar"]');
    if (bar) {
        const data = [
            ['기초', 9], ['동작', 10], ['입력', 23], ['이동', 9],
            ['표시', 19], ['알림', 9], ['겹침', 6], ['담기', 9],
        ];
        const W = 320, H = 150, PAD_L = 22, PAD_B = 22, PAD_T = 8;
        const max = 25;
        const bw = (W - PAD_L - 6) / data.length;
        [0, 5, 10, 15, 20, 25].forEach((v) => {
            const y = H - PAD_B - ((H - PAD_B - PAD_T) * v) / max;
            bar.appendChild(svgEl('line', { class: 'grid-line', x1: PAD_L, x2: W - 2, y1: y, y2: y }));
            const t = svgEl('text', { x: 0, y: y + 3 });
            t.textContent = String(v);
            bar.appendChild(t);
        });
        data.forEach(([label, v], i) => {
            const h = ((H - PAD_B - PAD_T) * v) / max;
            const x = PAD_L + 4 + i * bw;
            const rect = svgEl('rect', {
                class: v === 23 ? 'bar bar--alt' : 'bar',
                x, y: H - PAD_B - h, width: bw - 7, height: h, rx: 1,
            });
            const title = svgEl('title', {});
            title.textContent = label + ' ' + v + '종';
            rect.appendChild(title);
            bar.appendChild(rect);
            const t = svgEl('text', { x: x + (bw - 7) / 2, y: H - PAD_B + 12, 'text-anchor': 'middle' });
            t.textContent = label;
            bar.appendChild(t);
        });
        bar.appendChild(svgEl('line', { class: 'axis', x1: PAD_L, x2: W - 2, y1: H - PAD_B, y2: H - PAD_B }));
    }
    const line = $('[data-chart="line"]');
    if (line) {
        const values = [4, 6, 5, 9, 12, 11, 15, 18, 17, 21];
        const W = 320, H = 150, PAD_L = 24, PAD_B = 20, PAD_T = 10;
        const max = 24;
        const x = (i) => PAD_L + ((W - PAD_L - 8) * i) / (values.length - 1);
        const y = (v) => H - PAD_B - ((H - PAD_B - PAD_T) * v) / max;
        [0, 8, 16, 24].forEach((v) => {
            line.appendChild(svgEl('line', { class: 'grid-line', x1: PAD_L, x2: W - 2, y1: y(v), y2: y(v) }));
            const t = svgEl('text', { x: 0, y: y(v) + 3 });
            t.textContent = String(v);
            line.appendChild(t);
        });
        const d = values.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
        line.appendChild(svgEl('path', {
            class: 'area',
            d: d + ' L' + x(values.length - 1) + ' ' + y(0) + ' L' + x(0) + ' ' + y(0) + ' Z',
        }));
        line.appendChild(svgEl('path', { class: 'line', d }));
        values.forEach((v, i) => {
            const c = svgEl('circle', { class: 'dot', cx: x(i), cy: y(v), r: 2.6 });
            const title = svgEl('title', {});
            title.textContent = i + 1 + '주 · ' + v + '종';
            c.appendChild(title);
            line.appendChild(c);
        });
        line.appendChild(svgEl('line', { class: 'axis', x1: PAD_L, x2: W - 2, y1: y(0), y2: y(0) }));
    }
    const spark = $('[data-chart="spark"]');
    if (spark) {
        const values = [182, 178, 190, 174, 181, 186, 176, 179, 184, 172, 188, 180, 177, 183, 175, 181, 179, 186, 191, 184];
        const lo = Math.min(...values) - 4;
        const hi = Math.max(...values) + 4;
        const d = values
            .map((v, i) => {
            const x = (200 * i) / (values.length - 1);
            const y = 28 - (26 * (v - lo)) / (hi - lo);
            return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
        })
            .join(' ');
        spark.appendChild(svgEl('path', { d, 'vector-effect': 'non-scaling-stroke' }));
    }
    const paintRing = (ring, pct) => {
        const circle = $('.fill', ring);
        const label = $('.ring__label', ring);
        if (!circle)
            return;
        const r = Number(circle.getAttribute('r') ?? 32);
        const c = 2 * Math.PI * r;
        circle.setAttribute('stroke-dasharray', String(c));
        circle.setAttribute('stroke-dashoffset', String(c * (1 - pct / 100)));
        if (label)
            label.textContent = Math.round(pct) + '%';
    };
    $$('[data-ring]').forEach((ring) => paintRing(ring, Number(ring.dataset.ring ?? 0)));
    $('[data-ring-shuffle]')?.addEventListener('click', () => {
        $$('[data-ring]').forEach((ring) => {
            const next = 15 + Math.round(Math.random() * 80);
            ring.dataset.ring = String(next);
            paintRing(ring, next);
        });
        announce('고리 값을 바꿨습니다.');
    });
}
/* ── 진행 · 뼈대 · 단계 ──────────────────────────────── */
function initProgress() {
    const fill = $('[data-progress-fill]');
    const label = $('[data-progress-label]');
    $('[data-progress-run]')?.addEventListener('click', () => {
        let n = 0;
        const tick = window.setInterval(() => {
            n = Math.min(100, n + 4 + Math.random() * 6);
            if (fill)
                fill.setAttribute('style', 'width:' + n + '%');
            if (label)
                label.textContent = Math.round(n) + '%';
            if (n >= 100) {
                window.clearInterval(tick);
                if (label)
                    label.textContent = '완료';
                toast('102종 검사를 마쳤습니다', 'success');
            }
        }, 140);
    });
    $('[data-skeleton-toggle]')?.addEventListener('click', (e) => {
        const sk = $('[data-skeleton-view]');
        const real = $('[data-real-view]');
        if (!sk || !real)
            return;
        const showReal = real.hidden;
        sk.hidden = showReal;
        real.hidden = !showReal;
        e.currentTarget.textContent = showReal ? '뼈대로 되돌리기' : '실제 내용으로 바꾸기';
    });
    $$('[data-steps]').forEach((wrap) => {
        const steps = $$('.step', wrap);
        const label2 = $('[data-step-label]', wrap);
        let at = 1;
        const draw = () => {
            steps.forEach((s, i) => {
                s.dataset.state = i < at ? 'done' : i === at ? 'current' : 'todo';
                const dot = $('.step__dot', s);
                if (dot) {
                    dot.innerHTML = i < at
                        ? '<svg width="12" height="12" aria-hidden="true"><use href="#i-check"></use></svg>'
                        : String(i + 1);
                }
            });
            if (label2)
                label2.textContent = at + 1 + ' / ' + steps.length + ' 단계';
            const prev = $('[data-step-prev]', wrap);
            const next = $('[data-step-next]', wrap);
            if (prev)
                prev.disabled = at === 0;
            if (next)
                next.textContent = at === steps.length - 1 ? '검토 요청 보내기' : '다음';
        };
        $('[data-step-prev]', wrap)?.addEventListener('click', () => { at = clamp(at - 1, 0, steps.length - 1); draw(); });
        $('[data-step-next]', wrap)?.addEventListener('click', () => {
            if (at === steps.length - 1) {
                toast('검토 요청을 보냈습니다', 'success');
                return;
            }
            at = clamp(at + 1, 0, steps.length - 1);
            draw();
        });
        draw();
    });
}
/* ── 가로 나열 ───────────────────────────────────────── */
function initCarousel() {
    $$('[data-carousel]').forEach((car) => {
        const view = $('[data-carousel-viewport]', car);
        const dots = $('[data-carousel-dots]', car);
        if (!view)
            return;
        const slides = $$('.carousel__slide', view);
        if (dots) {
            dots.innerHTML = slides
                .map((_, i) => '<button class="carousel__dot" type="button" role="tab" aria-label="' + (i + 1) + '번째 장면"' +
                (i === 0 ? ' aria-current="true"' : '') + ' data-i="' + i + '"></button>')
                .join('');
            $$('button', dots).forEach((d) => d.addEventListener('click', () => {
                slides[Number(d.dataset.i)]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
            }));
        }
        const step = (dir) => {
            const w = (slides[0]?.offsetWidth ?? 240) + 16;
            view.scrollBy({ left: dir * w, behavior: 'smooth' });
        };
        $('[data-carousel-prev]', car)?.addEventListener('click', () => step(-1));
        $('[data-carousel-next]', car)?.addEventListener('click', () => step(1));
        view.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                step(1);
            }
            else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                step(-1);
            }
        });
        view.addEventListener('scroll', () => {
            const at = Math.round(view.scrollLeft / ((slides[0]?.offsetWidth ?? 240) + 16));
            if (!dots)
                return;
            $$('button', dots).forEach((d) => {
                if (Number(d.dataset.i) === at)
                    d.setAttribute('aria-current', 'true');
                else
                    d.removeAttribute('aria-current');
            });
        });
    });
}
/* ── 갈라진 판 ───────────────────────────────────────── */
function initSplit() {
    $$('[data-split]').forEach((pane) => {
        const grip = $('[data-split-grip]', pane);
        if (!grip)
            return;
        const saved = localStorage.getItem('ledger.split');
        if (saved)
            pane.style.setProperty('--split', saved + '%');
        const set = (pct) => {
            const v = clamp(pct, 20, 70);
            pane.style.setProperty('--split', v + '%');
            grip.setAttribute('aria-valuenow', String(Math.round(v)));
            localStorage.setItem('ledger.split', String(Math.round(v)));
        };
        const onMove = (e) => {
            const box = pane.getBoundingClientRect();
            set(((e.clientX - box.left) / box.width) * 100);
        };
        const stop = () => {
            delete grip.dataset.drag;
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', stop);
        };
        grip.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            grip.dataset.drag = 'true';
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', stop);
        });
        grip.addEventListener('keydown', (e) => {
            const now = Number(grip.getAttribute('aria-valuenow') ?? 34);
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                set(now - 2);
            }
            else if (e.key === 'ArrowRight') {
                e.preventDefault();
                set(now + 2);
            }
        });
    });
}
/* ── 작업 판 ─────────────────────────────────────────── */
function initBoard() {
    const board = $('[data-board]');
    if (!board)
        return;
    const status = $('[data-board-status]');
    const cols = $$('[data-board-col]', board);
    let dragged = null;
    const recount = () => {
        cols.forEach((col) => {
            const n = $$('.board__card', col).length;
            const badge = $('[data-col-count]', col);
            if (badge)
                badge.textContent = String(n);
        });
    };
    const bindCard = (card) => {
        card.addEventListener('dragstart', () => { dragged = card; card.dataset.dragging = 'true'; });
        card.addEventListener('dragend', () => { delete card.dataset.dragging; dragged = null; recount(); });
        card.addEventListener('keydown', (e) => {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')
                return;
            e.preventDefault();
            const col = card.closest('[data-board-col]');
            if (!col)
                return;
            const at = cols.indexOf(col);
            const to = cols[clamp(at + (e.key === 'ArrowRight' ? 1 : -1), 0, cols.length - 1)];
            if (!to || to === col)
                return;
            to.appendChild(card);
            card.focus();
            recount();
            const msg = (card.querySelector('b')?.textContent ?? '') + '을(를) ' + to.dataset.boardCol + ' 칸으로 옮겼습니다.';
            if (status)
                status.textContent = msg;
            announce(msg);
        });
    };
    $$('.board__card', board).forEach(bindCard);
    cols.forEach((col) => {
        col.addEventListener('dragover', (e) => { e.preventDefault(); col.dataset.over = 'true'; });
        col.addEventListener('dragleave', () => { delete col.dataset.over; });
        col.addEventListener('drop', (e) => {
            e.preventDefault();
            delete col.dataset.over;
            if (!dragged)
                return;
            col.appendChild(dragged);
            recount();
            if (status) {
                status.textContent = (dragged.querySelector('b')?.textContent ?? '') + '을(를) ' + col.dataset.boardCol + ' 칸으로 옮겼습니다.';
            }
        });
    });
    recount();
}
/* ── 잡동사니 ────────────────────────────────────────── */
function initMisc() {
    // 움직임 견본
    const dot = $('[data-motion-dot]');
    const track = $('[data-motion-track]');
    $$('[data-motion]').forEach((btn) => {
        btn.addEventListener('click', () => {
            if (!dot || !track)
                return;
            const far = track.clientWidth - dot.offsetWidth - 8;
            const at = dot.style.transform.includes('translateX(0') || dot.style.transform === '';
            dot.dataset.run = btn.dataset.motion ?? 'ease';
            dot.style.transform = 'translateX(' + (at ? far : 0) + 'px)';
        });
    });
    // 진행 상태 버튼 견본
    $('[data-demo-load]')?.addEventListener('click', (e) => {
        const btn = e.currentTarget;
        const state = $('[data-load-state]');
        btn.dataset.loading = 'true';
        if (state)
            state.textContent = '진행 중';
        window.setTimeout(() => {
            delete btn.dataset.loading;
            if (state)
                state.textContent = '완료';
            toast('작업을 마쳤습니다', 'success');
        }, 3000);
    });
    // 활동 기록 더 보기
    $('[data-feed-more]')?.addEventListener('click', (e) => {
        const feed = $('.feed');
        if (!feed)
            return;
        const extra = [
            ['최', '<b>최유진</b>이 <b>03.14 태그 입력</b>의 규격을 채웠습니다', '어제 14:12'],
            ['김', '<b>김영후</b>가 <b>10.02 키보드 지도</b>를 갱신했습니다', '2일 전'],
        ];
        extra.forEach(([who, what, when]) => {
            const item = document.createElement('div');
            item.className = 'feed__item';
            item.innerHTML =
                '<span class="avatar avatar--sm">' + who + '</span>' +
                    '<span><span class="feed__what">' + what + '</span><br><span class="feed__when">' + when + '</span></span>';
            feed.appendChild(item);
        });
        e.currentTarget.remove();
        announce('활동 2건을 더 불러왔습니다.');
    });
}
/* ── 시작 ────────────────────────────────────────────── */
function boot() {
    initTheme();
    initDensity();
    initRail();
    initFilter();
    initScrollspy();
    initCopy();
    initToastTriggers();
    initPalette();
    initDialogs();
    initDropdowns();
    initTips();
    initPopovers();
    initContextMenu();
    initTabs();
    initAccordions();
    initGroups();
    initSliders();
    initSteppers();
    initRatings();
    initPins();
    initTags();
    initCombobox();
    initDropzone();
    initColor();
    initCalendars();
    initTextInputs();
    initForm();
    initTable();
    initSortable();
    initTree();
    initCharts();
    initProgress();
    initCarousel();
    initSplit();
    initBoard();
    initMisc();
}
if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', boot);
else
    boot();
