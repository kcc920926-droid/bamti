/* ═══════════════════════════════════════════════════════
   qwen_3.8 component gallery — main.ts
   프레임워크 없이 전부 바닐라 + 타입으로.
   ═══════════════════════════════════════════════════════ */

const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T | null =>
  root.querySelector(sel);
const $$ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T[] =>
  Array.from(root.querySelectorAll(sel));

/* ─────────── 1. 테마 토글 (저장됨) ─────────── */
type Theme = "dark" | "light";
const THEME_KEY = "qwen38-theme";

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

function initTheme(): void {
  const saved = localStorage.getItem(THEME_KEY) as Theme | null;
  const prefers = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  applyTheme(saved ?? prefers);

  $('[data-theme-toggle]')?.addEventListener("click", () => {
    const next: Theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
    localStorage.setItem(THEME_KEY, next);
  });
}

/* ─────────── 2. 검색 상자 (⌘K, 섹션 필터) ─────────── */
function initSearch(): void {
  const input = $<HTMLInputElement>("[data-search-input]");
  if (!input) return;

  const applyFilter = (query: string): void => {
    const q = query.trim().toLowerCase();
    $$(".section").forEach((sec) => {
      if (!q) {
        sec.classList.remove("filtered-out", "filter-dim");
        return;
      }
      const title = sec.querySelector(".section-title")?.textContent ?? "";
      const hit = title.toLowerCase().includes(q) || sec.id.includes(q) ||
        (sec.textContent ?? "").toLowerCase().includes(q);
      sec.classList.toggle("filtered-out", !hit);
    });
  };

  input.addEventListener("input", () => applyFilter(input.value));

  document.addEventListener("keydown", (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      input.focus();
      input.select();
    }
    if (e.key === "Escape" && document.activeElement === input) {
      input.value = "";
      applyFilter("");
      input.blur();
    }
  });
}

/* ─────────── 3. 사이드 내비 스크롤 스파이 ─────────── */
function initScrollSpy(): void {
  const links = new Map<string, HTMLAnchorElement>();
  $$<HTMLAnchorElement>(".sidenav a").forEach((a) => {
    const id = a.getAttribute("href")?.slice(1);
    if (id) links.set(id, a);
  });
  if (!links.size) return;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const link = links.get(entry.target.id);
        if (!link) continue;
        $$(".sidenav a.is-active").forEach((a) => a.classList.remove("is-active"));
        link.classList.add("is-active");
      }
    },
    { rootMargin: "-20% 0px -70% 0px" }
  );
  links.forEach((_, id) => {
    const sec = document.getElementById(id);
    if (sec) observer.observe(sec);
  });
}

/* ─────────── 4. 칩 제거 ─────────── */
function initChips(): void {
  $$<HTMLButtonElement>("[data-chip-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const chip = btn.closest<HTMLElement>(".chip");
      if (!chip) return;
      chip.style.transition = "opacity .15s, transform .15s";
      chip.style.opacity = "0";
      chip.style.transform = "scale(.8)";
      setTimeout(() => chip.remove(), 150);
    });
  });
}

/* ─────────── 5. 폼: 카운터 / 비밀번호 토글 / 레인지 / 파일 드롭 ─────────── */
function initForms(): void {
  // 글자 수 카운터
  $$<HTMLTextAreaElement>("[data-counter]").forEach((ta) => {
    const out = $(`[data-counter-for="${ta.id}"]`);
    if (!out) return;
    const max = Number(ta.maxLength || 0);
    const update = (): void => {
      out.textContent = `${ta.value.length}/${max}`;
      out.classList.toggle("over", ta.value.length >= max);
    };
    ta.addEventListener("input", update);
    update();
  });

  // 비밀번호 표시 토글
  $$<HTMLButtonElement>("[data-reveal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = $<HTMLInputElement>(btn.dataset.reveal!);
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.textContent = show ? "🙈" : "👁";
    });
  });

  // 레인지 출력
  $$<HTMLInputElement>("[data-range]").forEach((range) => {
    const out = $<HTMLOutputElement>(`output[for="${range.id}"]`);
    if (!out) return;
    const sync = (): void => { out.value = range.value; };
    range.addEventListener("input", sync);
    sync();
  });

  // 파일 드롭존
  const drop = $<HTMLElement>("[data-filedrop]");
  const fileInput = $<HTMLInputElement>("[data-filedrop] input[type=file]");
  if (drop && fileInput) {
    const pick = $("[data-filepick]", drop);
    pick?.addEventListener("click", () => fileInput.click());
    drop.addEventListener("click", (e) => {
      if (e.target === pick || (pick && pick.contains(e.target as Node))) return;
      fileInput.click();
    });
    ["dragenter", "dragover"].forEach((ev) =>
      drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("dragover"); })
    );
    ["dragleave", "drop"].forEach((ev) =>
      drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("dragover"); })
    );
    drop.addEventListener("drop", (e) => {
      const files = e.dataTransfer?.files;
      if (files) renderFiles(files);
    });
    fileInput.addEventListener("change", () => {
      if (fileInput.files) renderFiles(fileInput.files);
    });

    const renderFiles = (files: FileList): void => {
      $$(".file-list", drop).forEach((l) => l.remove());
      const ul = document.createElement("ul");
      ul.className = "file-list";
      Array.from(files).forEach((f) => {
        const li = document.createElement("li");
        li.textContent = `📄 ${f.name} · ${(f.size / 1024).toFixed(1)}KB`;
        ul.appendChild(li);
      });
      drop.appendChild(ul);
    };
  }
}

/* ─────────── 6. 탭 ─────────── */
function initTabs(): void {
  $$<HTMLElement>("[data-tabs]").forEach((tabbar) => {
    const tabs = $$<HTMLButtonElement>(".tab", tabbar);
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => t.classList.toggle("is-active", t === tab));
        // 패널이 연결된 탭바만 패널 전환
        const target = tab.dataset.tab;
        if (target) {
          $$<HTMLElement>(".tab-panel").forEach((p) => {
            p.hidden = p.dataset.panel !== target;
          });
        }
      });
    });
  });
}

/* ─────────── 7. 아코디언 ─────────── */
function initAccordion(): void {
  $$(".acc-head").forEach((head) => {
    head.addEventListener("click", () => {
      const item = head.closest(".acc-item");
      const acc = head.closest("[data-accordion]");
      const isOpen = item?.classList.contains("open");
      // 같은 아코디언 안에서는 하나만 열림
      $$(".acc-item.open", acc ?? undefined).forEach((i) => i.classList.remove("open"));
      if (!isOpen) item?.classList.add("open");
    });
  });
}

/* ─────────── 8. 드롭다운 메뉴 ─────────── */
let openMenu: HTMLElement | null = null;

function positionMenu(menu: HTMLElement, anchor: HTMLElement): void {
  const rect = anchor.getBoundingClientRect();
  menu.style.position = "fixed";
  menu.style.top = `${rect.bottom + 6}px`;
  menu.style.left = `${rect.left}px`;
  // 열림 후 화면 밖이면 조정
  requestAnimationFrame(() => {
    const m = menu.getBoundingClientRect();
    if (m.right > window.innerWidth - 8) {
      menu.style.left = `${Math.max(8, rect.right - m.width)}px`;
    }
    if (m.bottom > window.innerHeight - 8) {
      menu.style.top = `${rect.top - m.height - 6}px`;
    }
  });
}

function closeMenu(): void {
  openMenu?.classList.remove("open");
  openMenu = null;
}

function initDropdowns(): void {
  $$<HTMLButtonElement>("[data-dropdown]").forEach((trigger) => {
    const menu = $<HTMLElement>(trigger.dataset.dropdown!);
    if (!menu) return;
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      if (openMenu === menu) { closeMenu(); return; }
      closeMenu();
      positionMenu(menu, trigger);
      menu.classList.add("open");
      openMenu = menu;
    });
    $$(".menu-item", menu).forEach((item) =>
      item.addEventListener("click", () => closeMenu())
    );
  });
  document.addEventListener("click", closeMenu);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });
}

/* ─────────── 9. 모달 (포커스 트랩 + Esc) ─────────── */
function initModals(): void {
  const backdrop = $<HTMLElement>("[data-modal-backdrop]");
  if (!backdrop) return;
  let lastFocused: HTMLElement | null = null;
  let current: HTMLElement | null = null;

  const focusables = (root: HTMLElement): HTMLElement[] =>
    $$<HTMLElement>("button, input, select, textarea, a[href]", root)
      .filter((el) => !el.hasAttribute("disabled"));

  const open = (modal: HTMLElement): void => {
    lastFocused = document.activeElement as HTMLElement;
    backdrop.hidden = false;
    current = modal;
    modal.hidden = false;
    (focusables(modal)[0] ?? modal).focus();
  };

  const close = (): void => {
    if (current) current.hidden = true;
    backdrop.hidden = true;
    current = null;
    lastFocused?.focus();
  };

  $$<HTMLButtonElement>("[data-modal-open]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const modal = $<HTMLElement>(btn.dataset.modalOpen!);
      if (modal) open(modal);
    })
  );
  $$("[data-modal-close]").forEach((el) => el.addEventListener("click", close));
  backdrop.addEventListener("mousedown", (e) => { if (e.target === backdrop) close(); });

  document.addEventListener("keydown", (e) => {
    if (!current) return;
    if (e.key === "Escape") { close(); return; }
    if (e.key === "Tab") {
      const els = focusables(current);
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
}

/* ─────────── 10. 토스트 ─────────── */
type ToastKind = "success" | "error" | "info";
const TOAST_ICON: Record<ToastKind, string> = { success: "✅", error: "⚠️", info: "ℹ️" };
const TOAST_TEXT: Record<ToastKind, string> = {
  success: "성공했습니다!",
  error: "문제가 발생했습니다. 다시 시도해 주세요.",
  info: "참고: 스캔은 사이드 패널에서 진행됩니다.",
};

function toast(kind: ToastKind): void {
  const stack = $("[data-toast-stack]");
  if (!stack) return;
  while (stack.children.length >= 4) stack.firstElementChild?.remove();

  const el = document.createElement("div");
  el.className = `toast toast-${kind}`;
  el.innerHTML = `<span>${TOAST_ICON[kind]}</span><span>${TOAST_TEXT[kind]}</span>`;
  stack.appendChild(el);
  setTimeout(() => {
    el.classList.add("leaving");
    setTimeout(() => el.remove(), 220);
  }, 3500);
}

function initToasts(): void {
  $$<HTMLButtonElement>("[data-toast]").forEach((btn) =>
    btn.addEventListener("click", () => toast(btn.dataset.toast as ToastKind))
  );
}

/* ─────────── 11. 테이블 정렬 ─────────── */
function initTableSort(): void {
  $$<HTMLTableElement>("[data-sortable]").forEach((table) => {
    const headers = $$<HTMLTableCellElement>("th[data-sort]", table);
    headers.forEach((th, colIndex) => {
      th.addEventListener("click", () => {
        const tbody = $("tbody", table);
        if (!tbody) return;
        const numeric = th.dataset.sort === "num";
        const asc = !th.classList.contains("sorted-asc");

        headers.forEach((h) => h.classList.remove("sorted-asc", "sorted-desc"));
        th.classList.add(asc ? "sorted-asc" : "sorted-desc");

        const rows = $$<HTMLTableRowElement>("tr", tbody);
        rows.sort((a, b) => {
          const av = a.cells[colIndex]?.textContent?.trim() ?? "";
          const bv = b.cells[colIndex]?.textContent?.trim() ?? "";
          const cmp = numeric ? Number(av) - Number(bv) : av.localeCompare(bv, "ko");
          return asc ? cmp : -cmp;
        });
        rows.forEach((r) => tbody.appendChild(r));
      });
    });
  });
}

/* ─────────── 12. 코드 복사 / 알림 닫기 / 로딩 데모 ─────────── */
function initMisc(): void {
  // 코드 블록 복사
  $$<HTMLButtonElement>("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const code = $("#sample-code")?.textContent ?? "";
      try {
        await navigator.clipboard.writeText(code);
        btn.textContent = "복사됨 ✓";
      } catch {
        btn.textContent = "복사 실패";
      }
      setTimeout(() => { btn.textContent = "복사"; }, 1400);
    });
  });

  // 알림 닫기
  $$<HTMLButtonElement>("[data-dismiss]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const alert = btn.closest(".alert");
      alert?.classList.add("closing");
      setTimeout(() => alert?.remove(), 160);
    })
  );

  // 로딩 데모 버튼
  $<HTMLButtonElement>("[data-demo-loading]")?.addEventListener("click", function (this: HTMLButtonElement) {
    if (this.classList.contains("is-loading")) return;
    const label = this.textContent;
    this.classList.add("is-loading");
    this.disabled = true;
    this.innerHTML = '<span class="spinner spinner-sm"></span>처리 중…';
    setTimeout(() => {
      this.classList.remove("is-loading");
      this.disabled = false;
      this.textContent = label;
      toast("success");
    }, 1600);
  });

  // 빈 상태 검색어 반영
  $$("[data-echo]").forEach((el) => { el.textContent = "nightshade"; });
}

/* ─────────── 부팅 ─────────── */
function boot(): void {
  initTheme();
  initSearch();
  initScrollSpy();
  initChips();
  initForms();
  initTabs();
  initAccordion();
  initDropdowns();
  initModals();
  initToasts();
  initTableSort();
  initMisc();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
