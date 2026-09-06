/* ============================================================
   Component Lab — interactions (TypeScript)
   Vanilla DOM, no dependencies. Compiled to app.js for the browser.
   ============================================================ */

type ToastType = 'default' | 'success' | 'error' | 'info';
type SortCol = { index: number; numeric: boolean };

/* ---------- helpers ---------- */
function $<T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T | null {
  return root.querySelector<T>(sel);
}
function $$<T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T[] {
  return Array.from(root.querySelectorAll<T>(sel));
}

/* ---------- icons ---------- */
const ICON = {
  check: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.6"/><path d="m5 8.2 2 2 4-4.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  error: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.6"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  info: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.6"/><path d="M8 7.5v3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="5.2" r=".8" fill="currentColor"/></svg>',
  toast: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1.5 14.5 13h-13L8 1.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 6v3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="10.8" r=".8" fill="currentColor"/></svg>',
};

/* ============================================================
   Sidebar nav — generated from sections with [data-nav-label]
   ============================================================ */
function buildNav(): void {
  const nav = $('#sideNav');
  if (!nav) return;
  $$<HTMLElement>('section[data-nav-label]').forEach((section) => {
    const a = document.createElement('a');
    a.href = `#${section.id}`;
    a.textContent = section.dataset.navLabel ?? section.id;
    nav.appendChild(a);
  });
}

/* scrollspy */
function initScrollspy(): void {
  const links = $$<HTMLAnchorElement>('#sideNav a');
  if (!links.length) return;
  const map = new Map<string, HTMLAnchorElement>();
  links.forEach((a) => map.set(a.getAttribute('href')!.slice(1), a));

  const spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach((a) => a.classList.remove('active'));
        const hit = map.get(e.target.id);
        if (hit) hit.classList.add('active');
      });
    },
    { rootMargin: '-20% 0px -70% 0px' },
  );
  $$('section[data-nav-label]').forEach((s) => spy.observe(s));
}

/* ============================================================
   Swatch grid (design tokens)
   ============================================================ */
const SWATCHES: { name: string; value: string; css: string }[] = [
  { name: 'bg',          value: '#101014', css: 'var(--bg)' },
  { name: 'surface-1',   value: '#17171c', css: 'var(--surface-1)' },
  { name: 'surface-2',   value: '#1e1e24', css: 'var(--surface-2)' },
  { name: 'surface-3',   value: '#26262e', css: 'var(--surface-3)' },
  { name: 'ink-hi',      value: '#f2f2ee', css: 'var(--ink-hi)' },
  { name: 'ink',         value: '#c8c8c2', css: 'var(--ink)' },
  { name: 'ink-muted',   value: '#8b8b85', css: 'var(--ink-muted)' },
  { name: 'ink-faint',   value: '#5b5b56', css: 'var(--ink-faint)' },
  { name: 'border',      value: '#2b2b32', css: 'var(--border)' },
  { name: 'border-strong', value: '#3d3d46', css: 'var(--border-strong)' },
  { name: 'accent',      value: '#c8f542', css: 'var(--accent)' },
  { name: 'danger',      value: '#ff7a6e', css: 'var(--danger)' },
  { name: 'success',     value: '#7dd98a', css: 'var(--success)' },
  { name: 'warning',     value: '#e8c46b', css: 'var(--warning)' },
  { name: 'info',        value: '#7db8d9', css: 'var(--info)' },
];

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

function buildSwatches(): void {
  const grid = $('#swatchGrid');
  if (!grid) return;
  SWATCHES.forEach((s) => {
    const el = document.createElement('div');
    el.className = 'swatch';
    el.style.cursor = 'pointer';
    el.title = `Copy ${s.value}`;
    el.innerHTML = `
      <div class="swatch-chip" style="background:${s.css}"></div>
      <div class="swatch-meta">
        <div class="swatch-name">${s.name}</div>
        <div class="swatch-value">${s.value}</div>
      </div>`;
    el.addEventListener('click', async () => {
      await copyText(s.value);
      toast(`Copied ${s.value}`, 'success');
    });
    grid.appendChild(el);
  });
}

/* ============================================================
   Toasts
   ============================================================ */
const TOAST_COPY: Record<ToastType, string> = {
  default: 'Action completed',
  success: 'Saved successfully',
  error: 'Something went wrong',
  info: 'Tip: press ⌘K anywhere',
};

function toast(message: string, type: ToastType = 'default'): void {
  const stack = $('#toastStack');
  if (!stack) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.setAttribute('role', 'status');
  el.innerHTML = `
    <span class="t-icon">${ICON[type === 'default' ? 'toast' : type]}</span>
    <span class="t-msg"></span>
    <button class="t-close" aria-label="Dismiss">✕</button>`;
  $('.t-msg', el)!.textContent = message;
  el.querySelector('.t-close')!.addEventListener('click', () => dismissToast(el));
  stack.appendChild(el);
  // cap the stack at 4
  while (stack.children.length > 4) stack.firstElementChild?.remove();
  window.setTimeout(() => dismissToast(el), 4200);
}

function dismissToast(el: HTMLElement): void {
  if (el.classList.contains('leaving')) return;
  el.classList.add('leaving');
  window.setTimeout(() => el.remove(), 200);
}

function initToastTriggers(): void {
  $$<HTMLButtonElement>('[data-toast]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = (btn.dataset.toast ?? 'default') as ToastType;
      toast(TOAST_COPY[type], type);
    });
  });
}

/* ============================================================
   Modal
   ============================================================ */
function initModal(): void {
  const modal = $('#modal');
  const openBtn = $('#openModal');
  if (!modal || !openBtn) return;

  const open = () => {
    modal.hidden = false;
    document.body.classList.add('modal-open');
  };
  const close = () => {
    modal.hidden = true;
    document.body.classList.remove('modal-open');
  };

  openBtn.addEventListener('click', open);
  $('#modalX')?.addEventListener('click', close);
  $('#modalCancel')?.addEventListener('click', close);
  $('#modalConfirm')?.addEventListener('click', () => {
    close();
    toast('Component deleted', 'error');
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) close();
  });
}

/* ============================================================
   Dropdown menu
   ============================================================ */
function initDropdown(): void {
  const wrap = $('#menuWrap');
  const btn = $('#menuBtn');
  if (!wrap || !btn) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = wrap.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
  });
  $$('.menu-item', wrap).forEach((item) => {
    item.addEventListener('click', () => {
      wrap.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      toast(item.textContent?.trim() || 'Action', 'default');
    });
  });
  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target as Node)) {
      wrap.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
  });
}

/* ============================================================
   Tabs
   ============================================================ */
function initTabs(): void {
  const buttons = $$<HTMLButtonElement>('.tab-btn');
  const panels = $$<HTMLElement>('.tab-panel');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
      const target = btn.dataset.tab;
      panels.forEach((p) => {
        p.hidden = p.id !== target;
      });
    });
  });
}

/* ============================================================
   Accordion (single-open)
   ============================================================ */
function initAccordion(): void {
  $$<HTMLButtonElement>('.acc-trigger').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const item = trigger.closest('.acc-item');
      const isOpen = item?.classList.contains('open');
      $$('.acc-item').forEach((i) => {
        i.classList.remove('open');
        $('.acc-trigger', i)?.setAttribute('aria-expanded', 'false');
      });
      if (item && !isOpen) {
        item.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });
  });
}

/* ============================================================
   Table — sort + row select
   ============================================================ */
function initTable(): void {
  const headers = $$<HTMLTableCellElement>('th[data-sort]');
  const body = $('#tblBody');
  if (!body) return;

  headers.forEach((th) => {
    const numeric = th.classList.contains('num');
    th.addEventListener('click', () => {
      const col = Number(th.dataset.sort);
      const dir = th.getAttribute('data-dir') === 'asc' ? -1 : 1;
      const nextDir = dir === 1 ? 'asc' : 'desc';

      // clear indicators
      headers.forEach((h) => {
        const ind = $('.sort-ind', h);
        if (ind) ind.textContent = '';
        h.removeAttribute('data-dir');
      });
      th.setAttribute('data-dir', nextDir);
      const ind = $('.sort-ind', th);
      if (ind) ind.textContent = nextDir === 'asc' ? '↓' : '↑';

      const rows = Array.from(body.querySelectorAll<HTMLTableRowElement>('tr'));
      const cellVal = (row: HTMLTableRowElement): string | number => {
        const cell = row.cells[col];
        const text = (cell?.textContent ?? '').replace(/[$,]/g, '').trim();
        return numeric ? Number(text) : text.toLowerCase();
      };
      rows.sort((a, b) => {
        const va = cellVal(a);
        const vb = cellVal(b);
        if (va < vb) return -1 * dir;
        if (va > vb) return 1 * dir;
        return 0;
      });
      rows.forEach((r) => body.appendChild(r));
    });
  });

  body.addEventListener('click', (e) => {
    const row = (e.target as HTMLElement).closest('tr');
    if (!row) return;
    body.querySelectorAll('tr').forEach((r) => r.classList.remove('selected'));
    row.classList.add('selected');
  });
}

/* ============================================================
   Pagination
   ============================================================ */
function initPager(): void {
  $$<HTMLButtonElement>('.pager button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const isNav = btn.getAttribute('aria-label');
      if (isNav) return;
      $$('.pager button').forEach((b) => b.removeAttribute('aria-current'));
      btn.setAttribute('aria-current', 'page');
    });
  });
}

/* ============================================================
   Stepper + slider
   ============================================================ */
function initStepper(): void {
  const val = $('#stepperVal');
  if (!val) return;
  let n = 3;
  $$<HTMLButtonElement>('.stepper button').forEach((btn) => {
    btn.addEventListener('click', () => {
      n = Math.max(0, Math.min(99, n + Number(btn.dataset.step)));
      val.textContent = String(n);
    });
  });
}

function initSlider(): void {
  $$<HTMLInputElement>('.slider').forEach((s) => {
    const paint = () => {
      const pct = ((Number(s.value) - Number(s.min)) / (Number(s.max) - Number(s.min))) * 100;
      s.style.setProperty('--fill', `${pct}%`);
    };
    s.addEventListener('input', paint);
    paint();
  });
}

/* ============================================================
   Segmented control
   ============================================================ */
function initSegmented(): void {
  $$<HTMLElement>('.segmented').forEach((group) => {
    $$<HTMLButtonElement>('button', group).forEach((btn) => {
      btn.addEventListener('click', () => {
        $$<HTMLButtonElement>('button', group).forEach((b) =>
          b.setAttribute('aria-pressed', String(b === btn)),
        );
      });
    });
  });
}

/* ============================================================
   Calendar (dynamic month grid, Mon-first)
   ============================================================ */
let calView = new Date();
let calSelected: Date | null = null;

function initCalendar(): void {
  const grid = $('#calGrid');
  const title = $('.cal-title');
  if (!grid || !title) return;

  const today = new Date();
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const render = () => {
    const y = calView.getFullYear();
    const m = calView.getMonth();
    title.textContent = calView.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    grid.innerHTML = '';

    const firstDow = new Date(y, m, 1).getDay(); // 0=Sun
    const offset = (firstDow + 6) % 7;           // Mon-first
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const daysInPrev = new Date(y, m, 0).getDate();

    const addDay = (label: string, opts: { muted?: boolean; today?: boolean; sel?: boolean } = {}) => {
      const d = document.createElement('button');
      d.type = 'button';
      d.className = 'cal-d';
      if (opts.muted) d.classList.add('muted');
      if (opts.today) d.classList.add('today');
      if (opts.sel) d.classList.add('sel');
      d.textContent = label;
      grid.appendChild(d);
    };

    for (let i = offset - 1; i >= 0; i--) addDay(String(daysInPrev - i), { muted: true });
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(y, m, d);
      addDay(String(d), {
        today: isSameDay(date, today),
        sel: calSelected ? isSameDay(date, calSelected) : false,
      });
      // wire click
      const last = grid.lastElementChild as HTMLButtonElement;
      last.addEventListener('click', () => {
        calSelected = date;
        render();
      });
    }
    const total = offset + daysInMonth;
    const trailing = (7 - (total % 7)) % 7;
    for (let i = 1; i <= trailing; i++) addDay(String(i), { muted: true });
  };

  $('.cal-nav', $('#extras')!)?.addEventListener('click', () => {
    calView = new Date(calView.getFullYear(), calView.getMonth() - 1, 1);
    render();
  });
  const nextBtn = $$<HTMLButtonElement>('.cal-nav')?.[1];
  nextBtn?.addEventListener('click', () => {
    calView = new Date(calView.getFullYear(), calView.getMonth() + 1, 1);
    render();
  });

  render();
}

/* ============================================================
   Mini bar chart
   ============================================================ */
const BAR_VALUES = [38, 62, 45, 80, 55, 90, 70, 48, 74, 58, 96, 66];
function initBars(): void {
  const wrap = $('#bars');
  if (!wrap) return;
  BAR_VALUES.forEach((v) => {
    const bar = document.createElement('i');
    bar.style.height = `${v}%`;
    bar.title = `${v} deploys`;
    if (v >= 74) bar.classList.add('hot');
    wrap.appendChild(bar);
  });
}

/* ============================================================
   Command palette
   ============================================================ */
function initCmdk(): void {
  const backdrop = $('#cmdk');
  const input = $('#cmdkInput') as HTMLInputElement | null;
  const list = $('#cmdkList');
  const openBtn = $('#openCmdk');
  if (!backdrop || !input || !list) return;

  interface CmdItem { label: string; hint?: string; run: () => void; keywords: string; }
  const items: CmdItem[] = [];

  $$<HTMLElement>('section[data-nav-label]').forEach((s) => {
    items.push({
      label: `Go to ${s.dataset.navLabel}`,
      hint: '↩',
      keywords: `${s.dataset.navLabel} ${s.id}`,
      run: () => s.scrollIntoView({ behavior: 'smooth' }),
    });
  });
  items.push(
    { label: 'Copy accent token', hint: '⌘C', keywords: 'copy accent color token', run: async () => { await copyText('#c8f542'); toast('Copied #c8f542', 'success'); } },
    { label: 'Show success toast', hint: '↩', keywords: 'toast success demo', run: () => toast('Saved successfully', 'success') },
    { label: 'Toggle modal', hint: '↩', keywords: 'modal dialog open', run: () => $('#openModal')?.click() },
  );

  let filtered: CmdItem[] = items;
  let active = 0;

  const render = () => {
    list.innerHTML = '';
    const groups = new Map<string, CmdItem[]>();
    filtered.forEach((it) => {
      const key = it.hint === '↩' ? 'Navigate' : 'Actions';
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(it);
    });
    let i = 0;
    groups.forEach((arr, group) => {
      const sec = document.createElement('div');
      sec.className = 'cmdk-sec';
      sec.textContent = group;
      list.appendChild(sec);
      arr.forEach((it) => {
        const el = document.createElement('div');
        el.className = 'cmdk-item' + (i === active ? ' active' : '');
        el.innerHTML = `<span>${it.label}</span><span class="kbd-hint">${it.hint ?? ''}</span>`;
        el.addEventListener('click', () => {
          close();
          it.run();
        });
        list.appendChild(el);
        i++;
      });
    });
    if (!filtered.length) {
      list.innerHTML = '<div class="cmdk-sec">No results</div>';
    }
  };

  const open = () => {
    filtered = items;
    active = 0;
    input.value = '';
    backdrop.hidden = false;
    render();
    window.setTimeout(() => input.focus(), 10);
  };
  const close = () => { backdrop.hidden = true; };

  openBtn?.addEventListener('click', open);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });

  input.addEventListener('input', () => {
    const q = input.value.toLowerCase();
    filtered = items.filter((it) => it.keywords.toLowerCase().includes(q));
    active = 0;
    render();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, filtered.length - 1); render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); render(); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const it = filtered[active];
      if (it) { close(); it.run(); }
    }
    else if (e.key === 'Escape') close();
  });

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      backdrop.hidden ? open() : close();
    }
  });
}

/* ============================================================
   boot
   ============================================================ */
function boot(): void {
  buildNav();
  initScrollspy();
  buildSwatches();
  initToastTriggers();
  initModal();
  initDropdown();
  initTabs();
  initAccordion();
  initTable();
  initPager();
  initStepper();
  initSlider();
  initSegmented();
  initCalendar();
  initBars();
  initCmdk();
}

document.addEventListener('DOMContentLoaded', boot);
