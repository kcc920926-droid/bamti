/* ============================================================
 * BAMTI Component Lab — main.ts
 * 모든 인터랙션: 테마 · 액센트 · 사이드바 · 검색 · 팔레트 ·
 * 토스트 · 모달/드로어 · 탭 · 드롭다운 · 아코디언 · 테이블 정렬 …
 * ============================================================ */

(() => {
  'use strict';

  /* ---------- Helpers ---------- */
  const $ = <T extends Element>(sel: string, root: ParentNode = document): T | null =>
    root.querySelector<T>(sel);
  const $$ = <T extends Element>(sel: string, root: ParentNode = document): T[] =>
    Array.from(root.querySelectorAll<T>(sel));

  const esc = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
     .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const ico = (name: string): string =>
    `<svg class="ic"><use href="#${name}"/></svg>`;

  /* 런타임 에러를 DOM에 기록 (자동 검증용) */
  window.addEventListener('error', (e) => {
    document.documentElement.dataset.err = String(e.message || 'unknown');
  });

  /* ---------- Theme ---------- */
  const root = document.documentElement;
  const themeToggle = $('#theme-toggle');
  const THEME_KEY = 'bamti-theme';

  const getTheme = (): string => root.dataset.theme ?? 'light';
  const setTheme = (t: string): void => {
    root.dataset.theme = t;
    localStorage.setItem(THEME_KEY, t);
    applyAccent(currentAccent);
  };
  if (localStorage.getItem(THEME_KEY)) root.dataset.theme = localStorage.getItem(THEME_KEY)!;
  else if (window.matchMedia('(prefers-color-scheme: dark)').matches) root.dataset.theme = 'dark';

  themeToggle?.addEventListener('click', () =>
    setTheme(getTheme() === 'dark' ? 'light' : 'dark'));

  /* ---------- Accent ---------- */
  type Acc = [hue: number, chroma: number];
  const ACCENTS: Record<string, Acc> = {
    teal: [170, 0.115],
    blue: [250, 0.13],
    rose: [8, 0.16],
    amber: [78, 0.14],
    violet: [295, 0.16],
  };
  let currentAccent = 'teal';
  const ACCENT_KEY = 'bamti-accent';
  const savedAccent = localStorage.getItem(ACCENT_KEY);
  if (savedAccent && ACCENTS[savedAccent]) currentAccent = savedAccent;

  const lch = (l: number, c: number, h: number): string => `oklch(${l} ${c} ${h})`;

  function applyAccent(key: string): void {
    const [h, c] = ACCENTS[key] ?? ACCENTS.teal;
    const dark = getTheme() === 'dark';
    const st = root.style;
    st.setProperty('--accent', lch(dark ? 0.72 : 0.55, c, h));
    st.setProperty('--accent-hover', lch(dark ? 0.77 : 0.5, c, h));
    st.setProperty('--accent-active', lch(dark ? 0.82 : 0.45, c * 0.92, h));
    st.setProperty('--accent-soft', lch(dark ? 0.3 : 0.94, c * 0.3, h));
    st.setProperty('--accent-softer', lch(dark ? 0.27 : 0.975, c * 0.12, h));
    st.setProperty('--accent-ink', lch(0.985, 0.006, h));
    st.setProperty('--accent-strong', lch(dark ? 0.68 : 0.42, c * 0.9, h));
    localStorage.setItem(ACCENT_KEY, key);
    currentAccent = key;
    $$<HTMLButtonElement>('.accent-pill').forEach((b) =>
      b.classList.toggle('is-active', b.dataset.a === key));
  }
  applyAccent(currentAccent);

  $$<HTMLButtonElement>('.accent-pill').forEach((btn) =>
    btn.addEventListener('click', () => applyAccent(btn.dataset.a ?? 'teal')));

  /* ---------- Toast ---------- */
  const ICON: Record<string, string> = {
    ok: 'i-check-c', warn: 'i-warn', danger: 'i-alert', info: 'i-info', accent: 'i-zap',
  };
  type ToastVariant = keyof typeof ICON;

  const toastWrap = $('#toast-wrap');
  const toastDedupe = new Set<string>();

  function showToast(
    title: string,
    variant: ToastVariant = 'info',
    body = '',
    opts: { duration?: number; key?: string } = {},
  ): void {
    if (opts.key && toastDedupe.has(opts.key)) return;
    if (opts.key) toastDedupe.add(opts.key);
    if (!toastWrap) return;

    const el = document.createElement('div');
    el.className = `toast toast--${variant}`;
    el.innerHTML =
      `<span class="toast__ico">${ico(ICON[variant] ?? 'i-info')}</span>` +
      `<div><div class="toast__title">${esc(title)}</div>` +
      (body ? `<div class="toast__body">${esc(body)}</div>` : '') +
      `</div><button class="toast__close" type="button" aria-label="닫기">${ico('i-x')}</button>` +
      `<span class="toast__progress"></span>`;
    toastWrap.append(el);

    const duration = opts.duration ?? 4000;
    el.style.setProperty('--toast-ms', `${duration}ms`);

    const close = (): void => {
      if (el.classList.contains('is-leaving')) return;
      el.classList.add('is-leaving');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    };
    el.querySelector<HTMLButtonElement>('.toast__close')?.addEventListener('click', close);
    setTimeout(close, duration);
  }

  /* data-toast 버튼 */
  $$<HTMLElement>('[data-toast]').forEach((btn) =>
    btn.addEventListener('click', () =>
      showToast(
        btn.dataset.title ?? '알림',
        (btn.dataset.toast as ToastVariant) ?? 'info',
        btn.dataset.body ?? '',
        { key: btn.dataset.key },
      )));

  /* ---------- Sidebar nav + scrollspy ---------- */
  const sideNav = $('#side-nav');
  const sections = $$<HTMLElement>('section.section');

  interface SecInfo { id: string; title: string; num: string }
  const secInfo: SecInfo[] = sections.map((s) => ({
    id: s.id,
    title: $<HTMLElement>('.h2', s)?.textContent?.trim() ?? s.id,
    num: $<HTMLElement>('.sec-id', s)?.textContent?.trim() ?? '',
  }));

  if (sideNav) {
    sideNav.innerHTML = secInfo
      .map((s, i) =>
        `<a href="#${s.id}" data-nav="${i}">${esc(s.title)}<span class="nav-num">${String(i + 1).padStart(2, '0')}</span></a>`)
      .join('');
  }
  const navLinks = $$<HTMLElement>('.side-nav a[data-nav]');

  const setActive = (i: number): void => {
    navLinks.forEach((a, idx) => a.classList.toggle('is-active', idx === i));
  };
  if (navLinks.length) {
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => { if (en.isIntersecting) setActive(Number(en.target.getAttribute('data-nav-i'))); });
      },
      { rootMargin: '-25% 0px -65% 0px' },
    );
    sections.forEach((s, i) => { s.dataset.navI = String(i); spy.observe(s); });
    navLinks.forEach((a) =>
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const id = a.getAttribute('href')!.slice(1);
        $(`#${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState(null, '', `#${id}`);
      }));
  }

  /* ---------- Section search filter ---------- */
  const searchInput = $('#search-input') as HTMLInputElement | null;
  const noResults = $('#no-results');

  function applySearch(q: string): void {
    const needle = q.trim().toLowerCase();
    let visible = 0;
    const totalDemos = $$<HTMLElement>('.demo').length;
    if (!needle) {
      $$<HTMLElement>('.demo').forEach((d) => d.classList.remove('is-searching'));
      visible = totalDemos;
    } else {
      sections.forEach((sec) => {
        const hits = $$<HTMLElement>('.demo', sec).filter((d) =>
          d.textContent?.toLowerCase().includes(needle));
        $$<HTMLElement>('.demo', sec).forEach((d) =>
          d.classList.toggle('is-searching', !hits.includes(d)));
        visible += hits.length;
      });
    }
    noResults?.classList.toggle('is-visible', visible === 0);
  }
  searchInput?.addEventListener('input', () => applySearch(searchInput.value));

  /* ---------- Command palette ---------- */
  const palette = $('#palette');
  const paletteInput = $('#palette-input') as HTMLInputElement | null;
  const paletteList = $('#palette-list');
  let paletteItems: HTMLElement[] = [];
  let paletteActive = 0;

  function buildPalette(): void {
    if (!paletteList) return;
    paletteList.innerHTML = secInfo
      .map((s, i) =>
        `<button class="palette__item" data-pi="${i}" type="button">` +
        `<span class="p-ico">${ico('i-grid')}</span><span>${esc(s.title)}</span>` +
        `<span class="p-num">${String(i + 1).padStart(2, '0')}</span></button>`)
      .join('');
    paletteItems = $$<HTMLElement>('.palette__item', paletteList);
    paletteItems.forEach((it) =>
      it.addEventListener('click', () => jumpTo(Number(it.dataset.pi))));
    filterPalette('');
  }

  function jumpTo(i: number): void {
    const s = sections[i];
    if (!s) return;
    closePalette();
    s.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState(null, '', `#${s.id}`);
  }

  function filterPalette(q: string): void {
    if (!paletteList) return;
    const needle = q.trim().toLowerCase();
    let shown = 0;
    paletteItems.forEach((it, i) => {
      const hit = !needle || secInfo[i].title.toLowerCase().includes(needle);
      it.style.display = hit ? '' : 'none';
      if (hit) shown++;
    });
    if (!paletteList.querySelector('.palette__empty')) {
      const empty = document.createElement('div');
      empty.className = 'palette__empty';
      empty.textContent = '일치하는 컴포넌트가 없습니다.';
      paletteList.append(empty);
    }
    const emptyEl = paletteList.querySelector<HTMLElement>('.palette__empty')!;
    emptyEl.style.display = shown === 0 ? '' : 'none';
    paletteActive = 0;
    markActive();
  }

  function markActive(): void {
    paletteItems.forEach((it, i) => {
      const on = i === paletteActive && it.style.display !== 'none';
      it.classList.toggle('is-active', on);
      if (on) it.scrollIntoView({ block: 'nearest' });
    });
  }

  function openPalette(): void {
    if (!palette) return;
    palette.classList.add('is-open');
    palette.setAttribute('aria-hidden', 'false');
    buildPalette();
    setTimeout(() => paletteInput?.focus(), 60);
  }
  function closePalette(): void {
    palette?.classList.remove('is-open');
    palette?.setAttribute('aria-hidden', 'true');
    paletteInput?.blur();
  }

  $$<HTMLElement>('[data-palette-open]').forEach((b) =>
    b.addEventListener('click', openPalette));
  $<HTMLElement>('[data-palette-close]')?.addEventListener('click', closePalette);

  paletteInput?.addEventListener('input', () => filterPalette(paletteInput.value));
  paletteInput?.addEventListener('keydown', (e) => {
    const visible = paletteItems.filter((it) => it.style.display !== 'none');
    if (!visible.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      const cur = Math.max(0, visible.findIndex((it) => it.classList.contains('is-active')));
      const next = visible[(cur + dir + visible.length) % visible.length];
      const real = paletteItems.indexOf(next);
      if (real >= 0) paletteActive = real;
      markActive();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const activeEl = paletteItems.find(
        (it) => it.classList.contains('is-active') && it.style.display !== 'none');
      const id = activeEl?.dataset.pi;
      if (id) jumpTo(Number(id));
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (palette?.classList.contains('is-open')) closePalette();
      else openPalette();
    }
    if (e.key === 'Escape') {
      closePalette();
      closeTopOverlay();
    }
  });

  /* ---------- Modal / Drawer / Overlay stack ---------- */
  const overlayStack: HTMLElement[] = [];
  let lastFocused: HTMLElement | null = null;

  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function lockScroll(on: boolean): void {
    document.body.style.overflow = on ? 'hidden' : '';
  }
  function openOverlay(el: HTMLElement): void {
    overlayStack.push(el);
    el.classList.add('is-open');
    el.setAttribute('aria-hidden', 'false');
    lastFocused = document.activeElement as HTMLElement | null;
    lockScroll(true);
    const first = el.querySelector<HTMLElement>(FOCUSABLE);
    setTimeout(() => first?.focus(), 90);
  }
  function closeOverlay(el: HTMLElement): void {
    const i = overlayStack.indexOf(el);
    if (i >= 0) overlayStack.splice(i, 1);
    if (!el.classList.contains('is-open')) return;
    el.classList.remove('is-open');
    el.setAttribute('aria-hidden', 'true');
    if (overlayStack.length === 0) {
      lockScroll(false);
      lastFocused?.focus();
    }
  }
  function closeTopOverlay(): void {
    const top = overlayStack[overlayStack.length - 1];
    if (top) closeOverlay(top);
  }

  function trapFocus(e: KeyboardEvent, el: HTMLElement): void {
    if (e.key !== 'Tab') return;
    const items = $$<HTMLElement>(FOCUSABLE, el).filter((n) => n.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* Modal */
  const modals = $$<HTMLElement>('.modal');
  modals.forEach((m) => {
    m.addEventListener('keydown', (e) => trapFocus(e, m));
  });
  $$<HTMLElement>('[data-modal-open]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const m = $(`[data-modal="${btn.dataset.modalOpen}"]`);
      if (m) openOverlay(m);
    }));
  $$<HTMLElement>('[data-modal-close]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const m = btn.closest<HTMLElement>('.modal');
      if (m) closeOverlay(m);
    }));
  modals.forEach((m) =>
    $<HTMLElement>('.modal__overlay', m)?.addEventListener('click', () => closeOverlay(m)));

  /* Drawer */
  const drawers = $$<HTMLElement>('.drawer');
  drawers.forEach((d) => { d.addEventListener('keydown', (e) => trapFocus(e, d)); });
  $$<HTMLElement>('[data-drawer-open]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const d = $(`[data-drawer="${btn.dataset.drawerOpen}"]`);
      if (d) openOverlay(d);
    }));
  $$<HTMLElement>('[data-drawer-close]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const d = btn.closest<HTMLElement>('.drawer');
      if (d) closeOverlay(d);
    }));
  drawers.forEach((d) =>
    $<HTMLElement>('.drawer__overlay', d)?.addEventListener('click', () => closeOverlay(d)));

  /* Confirm dialog (promise) */
  function confirmDialog(opts: {
    title: string; body?: string; ok?: string; danger?: boolean;
  }): Promise<boolean> {
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'modal';
      wrap.innerHTML =
        `<div class="modal__overlay" data-c-close></div>` +
        `<div class="modal__dialog modal__dialog--sm" role="alertdialog" aria-modal="true">` +
        `<div class="modal__body" style="padding:24px">` +
        (opts.danger ? `<div class="modal__icon-big">${ico('i-trash')}</div>` : '') +
        `<h3 style="font-size:16px;font-weight:700">${esc(opts.title)}</h3>` +
        (opts.body ? `<p style="margin-top:8px;font-size:13.5px;color:var(--ink-2)">${esc(opts.body)}</p>` : '') +
        `</div>` +
        `<div class="modal__foot">` +
        `<button class="btn btn--ghost" data-c-no type="button">취소</button>` +
        `<button class="btn ${opts.danger ? 'btn--danger' : 'btn--primary'}" data-c-yes type="button">${esc(opts.ok ?? '확인')}</button>` +
        `</div></div>`;
      document.body.append(wrap);
      let done = false;
      const finish = (v: boolean): void => {
        if (done) return;
        done = true;
        closeOverlay(wrap);
        setTimeout(() => wrap.remove(), 350);
        resolve(v);
      };
      wrap.querySelector('[data-c-yes]')?.addEventListener('click', () => finish(true));
      wrap.querySelector('[data-c-no]')?.addEventListener('click', () => finish(false));
      wrap.querySelector('[data-c-close]')?.addEventListener('click', () => finish(false));
      wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape') finish(false); trapFocus(e, wrap); });
      openOverlay(wrap);
    });
  }

  $$<HTMLElement>('[data-confirm]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: btn.dataset.title ?? '정말 진행할까요?',
        body: btn.dataset.body,
        ok: btn.dataset.ok,
        danger: btn.hasAttribute('data-danger'),
      });
      showToast(
        ok ? '확인됨' : '취소됨',
        ok ? 'ok' : 'info',
        ok ? '요청한 작업이 실행되었습니다.' : '변경 사항이 없습니다.');
    }));

  /* ---------- Tabs ---------- */
  $$<HTMLElement>('.tabs[data-tabs]').forEach((group) => {
    const items = $$<HTMLButtonElement>('.tabs__item', group);
    const select = (key: string): void => {
      items.forEach((it) => {
        const on = it.dataset.tab === key;
        it.classList.toggle('is-active', on);
        it.setAttribute('aria-selected', String(on));
      });
      const host = group.parentElement;
      $$<HTMLElement>('[data-tab-panel]').forEach((p) => {
        const on = p.dataset.tabPanel === key;
        p.classList.toggle('is-active', on);
        if (host && !host.contains(p)) p.setAttribute('hidden', on ? '' : 'hidden');
        else p.toggleAttribute('hidden', !on);
      });
    };
    items.forEach((it, idx) => {
      it.setAttribute('aria-selected', String(it.classList.contains('is-active')));
      it.addEventListener('click', () => select(it.dataset.tab ?? ''));
      it.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const next = items[(idx + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length];
        next.focus();
        next.click();
      });
    });
  });

  /* ---------- Dropdown ---------- */
  $$<HTMLElement>('.dropdown[data-dropdown]').forEach((dd) => {
    const toggle = $<HTMLButtonElement>('[data-dropdown-toggle]', dd);
    toggle?.addEventListener('click', (e) => {
      e.stopPropagation();
      $$<HTMLElement>('.dropdown.is-open').forEach((o) => { if (o !== dd) o.classList.remove('is-open'); });
      dd.classList.toggle('is-open');
    });
    dd.addEventListener('click', (e) => {
      // 메뉴 아이템 클릭 시 닫기 (토글 버튼 제외)
      if (!(e.target as HTMLElement).closest('[data-dropdown-toggle]')) dd.classList.remove('is-open');
    });
  });
  document.addEventListener('click', () =>
    $$<HTMLElement>('.dropdown.is-open').forEach((d) => d.classList.remove('is-open')));

  /* ---------- Accordion ---------- */
  $$<HTMLElement>('.accordion[data-accordion]').forEach((acc) => {
    const single = acc.hasAttribute('data-single');
    $$<HTMLElement>('.accordion__item', acc).forEach((item) => {
      item.querySelector<HTMLButtonElement>('.accordion__head')?.addEventListener('click', () => {
        const willOpen = !item.classList.contains('is-open');
        if (single) {
          $$<HTMLElement>('.accordion__item', acc).forEach((o) => {
            o.classList.remove('is-open');
            o.querySelector<HTMLButtonElement>('.accordion__head')?.setAttribute('aria-expanded', 'false');
          });
        }
        item.classList.toggle('is-open', willOpen);
        item.querySelector<HTMLButtonElement>('.accordion__head')?.setAttribute('aria-expanded', String(willOpen));
      });
    });
  });

  /* ---------- Code copy ---------- */
  $$<HTMLElement>('[data-copy]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const code = btn.closest('.codeblock')?.querySelector<HTMLElement>('pre code');
      const text = code?.textContent ?? '';
      try {
        await navigator.clipboard.writeText(text);
        showToast('복사됨', 'ok', '클립보드에 복사되었습니다.', { key: 'copy' });
      } catch {
        showToast('복사 실패', 'danger', '클립보드 권한을 확인해주세요.');
      }
    }));

  /* ---------- Password toggle ---------- */
  $$<HTMLElement>('[data-pwd-toggle]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const input = $(btn.dataset.pwdToggle ?? '') as HTMLInputElement | null;
      if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.innerHTML = ico(show ? 'i-eye-off' : 'i-eye');
    }));

  /* ---------- Range slider ---------- */
  $$<HTMLInputElement>('input[data-range]').forEach((r) => {
    const out = $(r.dataset.rangeOut ?? '') as HTMLElement | null;
    const sync = (): void => { if (out) out.textContent = r.value; };
    r.addEventListener('input', sync);
    sync();
  });

  /* ---------- Rating ---------- */
  $$<HTMLElement>('.rating[data-rating]').forEach((rt) => {
    const readonly = rt.hasAttribute('data-readonly');
    const out = $<HTMLElement>(rt.dataset.ratingOut ?? '');
    let value = Number(rt.dataset.rating || 0);
    const render = (): void => {
      rt.innerHTML = Array.from({ length: 5 }, (_, i) =>
        `<button type="button" class="${i < value ? 'is-on' : ''}" data-v="${i + 1}" aria-label="${i + 1}점">★</button>`).join('');
      if (out) out.textContent = `${value} / 5 점`;
    };
    rt.addEventListener('click', (e) => {
      if (readonly) return;
      const t = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-v]');
      if (!t) return;
      const v = Number(t.dataset.v);
      value = v === value ? 0 : v; // 같은 별 재클릭 시 0
      rt.dataset.rating = String(value);
      render();
    });
    render();
  });

  /* ---------- OTP ---------- */
  $$<HTMLElement>('.otp[data-otp]').forEach((wrap) => {
    const inputs = $$<HTMLInputElement>('input', wrap);
    inputs.forEach((inp, i) => {
      inp.addEventListener('input', () => {
        inp.value = inp.value.replace(/\D/g, '').slice(0, 1);
        if (inp.value && i < inputs.length - 1) inputs[i + 1].focus();
      });
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !inp.value && i > 0) inputs[i - 1].focus();
        if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); inputs[i - 1].focus(); }
        if (e.key === 'ArrowRight' && i < inputs.length - 1) { e.preventDefault(); inputs[i + 1].focus(); }
      });
      inp.addEventListener('paste', (e) => {
        e.preventDefault();
        const digits = (e.clipboardData?.getData('text') ?? '').replace(/\D/g, '').split('');
        digits.slice(0, inputs.length - i).forEach((d, k) => { inputs[i + k].value = d; });
        inputs[Math.min(i + digits.length, inputs.length - 1)].focus();
      });
    });
  });

  /* ---------- File drop ---------- */
  $$<HTMLElement>('[data-file-drop]').forEach((drop) => {
    const input = $<HTMLInputElement>('input[type=file]', drop);
    const label = $<HTMLElement>('.file-drop__file', drop);
    const setFile = (f: File | null): void => {
      if (!label) return;
      label.textContent = f ? `${f.name} · ${(f.size / 1024).toFixed(0)}KB` : '';
      drop.classList.toggle('has-file', !!f);
    };
    drop.addEventListener('click', () => input?.click());
    drop.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input?.click(); }
    });
    input?.addEventListener('change', () => setFile(input.files?.[0] ?? null));
    ['dragenter', 'dragover'].forEach((ev) =>
      drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-drag'); }));
    ['dragleave', 'drop'].forEach((ev) =>
      drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-drag'); }));
    drop.addEventListener('drop', (e) => {
      const f = e.dataTransfer?.files?.[0] ?? null;
      setFile(f);
      if (f) showToast('파일 선택됨', 'ok', f.name);
    });
  });

  /* ---------- Chip input (tag editor) ---------- */
  $$<HTMLElement>('.chips[data-chips]').forEach((wrap) => {
    const input = $<HTMLInputElement>('input[type=text]', wrap);
    const add = (): void => {
      const v = input?.value.trim() ?? '';
      if (!v) return;
      const exists = $$<HTMLElement>('.chip', wrap).some((c) =>
        c.textContent?.replace('×', '').trim() === v);
      if (exists) { showToast('중복 태그', 'warn', `"${v}"는 이미 있습니다.`, { key: 'dup' }); return; }
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.innerHTML = `${esc(v)}<button type="button" aria-label="제거">×</button>`;
      wrap.insertBefore(chip, input);
      if (input) input.value = '';
    };
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
      if (e.key === 'Backspace' && !input.value) {
        wrap.querySelector<HTMLElement>('.chip:last-of-type')?.remove();
      }
    });
    input?.addEventListener('blur', add);
    wrap.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.chip button')) {
        (e.target as HTMLElement).closest('.chip')?.remove();
      }
    });
  });

  /* ---------- Table: sort + row select ---------- */
  $$<HTMLTableElement>('table[data-sort-table]').forEach((table) => {
    const tbody = table.tBodies[0];
    const rows = Array.from(tbody?.rows ?? []);

    $$<HTMLTableHeaderCellElement>('th[data-sort]', table).forEach((th) => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort ?? '';
        const ascending = !th.classList.contains('sort-asc');
        table.querySelectorAll<HTMLTableHeaderCellElement>('th[data-sort]').forEach((h) => {
          h.classList.remove('sort-asc', 'sort-desc');
          h.querySelector('.sort-ico')!.textContent = '▲';
        });
        th.classList.toggle('sort-asc', ascending);
        th.classList.toggle('sort-desc', !ascending);
        th.querySelector('.sort-ico')!.textContent = ascending ? '▲' : '▼';
        const col = Array.from(th.parentElement!.children).indexOf(th);
        const sorted = rows
          .map((r, i) => ({ r, i, cell: r.cells[col]?.textContent?.trim() ?? '' }))
          .sort((a, b) => {
            const av = parseCell(a.cell);
            const bv = parseCell(b.cell);
            return (av.num !== null && bv.num !== null ? av.num - bv.num : av.raw.localeCompare(bv.raw, 'ko'))
              * (ascending ? 1 : -1);
          });
        sorted.forEach(({ r }, i) => tbody.append(r));
      });
    });

    const checkAll = $<HTMLInputElement>('[data-check-all]', table);
    const rowChecks = $$<HTMLInputElement>('[data-check-row]', table);
    const refreshMaster = (): void => {
      if (!checkAll) return;
      const checked = rowChecks.filter((c) => c.checked).length;
      checkAll.checked = checked === rowChecks.length && checked > 0;
      checkAll.indeterminate = checked > 0 && checked < rowChecks.length;
    };
    rowChecks.forEach((c) => c.addEventListener('change', () => {
      c.closest('tr')?.classList.toggle('is-selected', c.checked);
      refreshMaster();
    }));
    checkAll?.addEventListener('change', () => {
      rowChecks.forEach((c) => {
        c.checked = checkAll.checked;
        c.closest('tr')?.classList.toggle('is-selected', checkAll.checked);
      });
      refreshMaster();
    });
    refreshMaster();
  });

  function parseCell(text: string): { num: number | null; raw: string } {
    const cleaned = text.replace(/[₩,,\s%]/g, '');
    const n = Number(cleaned);
    return { num: Number.isFinite(n) && cleaned !== '' ? n : null, raw: text };
  }

  /* ---------- Progress / ring demos ---------- */
  $<HTMLElement>('[data-progress-demo]')?.addEventListener('click', () => {
    $$<HTMLElement>('[data-progress]').forEach((bar) => {
      const target = Number(bar.dataset.progress ?? 0);
      bar.style.width = '0%';
      requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.width = `${target}%`; }));
    });
    const valEl = $('#progress-val');
    if (valEl) {
      const target = Number($<HTMLElement>('#progress-bar')?.dataset.progress ?? 0);
      const t0 = performance.now();
      const tick = (t: number): void => {
        const p = Math.min(1, (t - t0) / 700);
        valEl.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  });

  const RING_C = 2 * Math.PI * 40; // r=40
  $<HTMLElement>('[data-ring-demo]')?.addEventListener('click', () => {
    $$<SVGCircleElement>('[data-ring]').forEach((circle) => {
      const target = Number(circle.dataset.ring ?? 0);
      circle.style.strokeDashoffset = String(RING_C);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          circle.style.strokeDashoffset = String(RING_C * (1 - target / 100));
        }));
    });
    const valEl = $('#ring-val');
    if (valEl) {
      const target = Number($<SVGCircleElement>('[data-ring]')?.dataset.ring ?? 0);
      const t0 = performance.now();
      const tick = (t: number): void => {
        const p = Math.min(1, (t - t0) / 800);
        valEl.textContent = `${Math.round(target * (1 - Math.pow(1 - p, 3)))}%`;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  });

  /* 모달/스탯카드의 data-progress 바도 로드 시 시작값 부여 */
  $$<HTMLElement>('[data-progress]').forEach((bar) => {
    if (!bar.style.width || bar.style.width === '0%') bar.style.width = '0%';
  });
  $$<SVGCircleElement>('[data-ring]').forEach((c) =>
    c.style.strokeDashoffset = String(RING_C * (1 - Number(c.dataset.ring ?? 0) / 100)));

  /* ---------- Loading button ---------- */
  $$<HTMLButtonElement>('[data-btn-loading]').forEach((btn) =>
    btn.addEventListener('click', () => {
      if (btn.classList.contains('is-loading')) return;
      const label = btn.textContent?.trim() ?? '';
      btn.classList.add('is-loading');
      btn.setAttribute('aria-busy', 'true');
      setTimeout(() => {
        btn.classList.remove('is-loading');
        btn.setAttribute('aria-busy', 'false');
        showToast('완료', 'ok', label ? `"${label}" 작업이 끝났습니다.` : undefined);
      }, 1600);
    }));

  /* ---------- Banner dismiss ---------- */
  $$<HTMLElement>('[data-banner-close]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const target = $(btn.dataset.bannerClose ?? '');
      target?.classList.add('is-hidden');
    }));

  /* ---------- Carousel ---------- */
  $$<HTMLElement>('.carousel[data-carousel]').forEach((car) => {
    const track = $<HTMLElement>('.carousel__track', car);
    const slides = $$<HTMLElement>('.carousel__slide', car);
    const dots = $$<HTMLButtonElement>('[data-carousel-dot]', car);
    let idx = 0;
    const go = (i: number): void => {
      idx = (i + slides.length) % slides.length;
      if (track) track.style.transform = `translateX(-${idx * 100}%)`;
      dots.forEach((d, k) => d.classList.toggle('is-active', k === idx));
    };
    $<HTMLElement>('[data-carousel-prev]', car)?.addEventListener('click', () => go(idx - 1));
    $<HTMLElement>('[data-carousel-next]', car)?.addEventListener('click', () => go(idx + 1));
    dots.forEach((d) => d.addEventListener('click', () => go(Number(d.dataset.carouselDot))));
  });

  /* ---------- Countdown ticker ---------- */
  $$<HTMLElement>('[data-ticker]').forEach((tk) => {
    const target = Date.now() + 24 * 3600 * 1000;
    const pad = (n: number): string => String(n).padStart(2, '0');
    const tick = (): void => {
      const diff = Math.max(0, target - Date.now());
      const s = Math.floor(diff / 1000);
      const set = (k: string, v: string): void => {
        const el = tk.querySelector<HTMLElement>(`[data-tick="${k}"]`);
        if (el) el.textContent = v;
      };
      set('d', pad(Math.floor(s / 86400)));
      set('h', pad(Math.floor((s % 86400) / 3600)));
      set('m', pad(Math.floor((s % 3600) / 60)));
      set('s', pad(s % 60));
    };
    tick();
    setInterval(tick, 1000);
  });

  /* ---------- Demo form ---------- */
  $$<HTMLFormElement>('form.js-form-demo').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      let ok = true;
      $$<HTMLInputElement>('[required]', form).forEach((inp) => {
        const field = inp.closest<HTMLElement>('.field');
        if (!inp.value.trim()) {
          field?.classList.add('has-error');
          ok = false;
        } else {
          field?.classList.remove('has-error');
        }
      });
      if (!ok) {
        showToast('입력 확인', 'warn', '필수 항목을 채워주세요.');
        return;
      }
      const btn = $<HTMLButtonElement>('[type=submit]', form);
      if (btn) {
        btn.classList.add('is-loading');
        btn.setAttribute('aria-busy', 'true');
      }
      setTimeout(() => {
        btn?.classList.remove('is-loading');
        btn?.removeAttribute('aria-busy');
        form.reset();
        showToast('제출 완료', 'ok', '데모 폼이 전송되었습니다.');
      }, 1400);
    });
  });

  /* ---------- Init ---------- */
  document.documentElement.dataset.ready = 'true';
})();