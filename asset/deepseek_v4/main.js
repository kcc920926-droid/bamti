"use strict";
(() => {
  // main.ts
  (() => {
    "use strict";
    const $ = (sel, root2 = document) => root2.querySelector(sel);
    const $$ = (sel, root2 = document) => Array.from(root2.querySelectorAll(sel));
    const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const ico = (name) => `<svg class="ic"><use href="#${name}"/></svg>`;
    window.addEventListener("error", (e) => {
      document.documentElement.dataset.err = String(e.message || "unknown");
    });
    const root = document.documentElement;
    const themeToggle = $("#theme-toggle");
    const THEME_KEY = "bamti-theme";
    const getTheme = () => root.dataset.theme ?? "light";
    const setTheme = (t) => {
      root.dataset.theme = t;
      localStorage.setItem(THEME_KEY, t);
      applyAccent(currentAccent);
    };
    if (localStorage.getItem(THEME_KEY)) root.dataset.theme = localStorage.getItem(THEME_KEY);
    else if (window.matchMedia("(prefers-color-scheme: dark)").matches) root.dataset.theme = "dark";
    themeToggle?.addEventListener("click", () => setTheme(getTheme() === "dark" ? "light" : "dark"));
    const ACCENTS = {
      teal: [170, 0.115],
      blue: [250, 0.13],
      rose: [8, 0.16],
      amber: [78, 0.14],
      violet: [295, 0.16]
    };
    let currentAccent = "teal";
    const ACCENT_KEY = "bamti-accent";
    const savedAccent = localStorage.getItem(ACCENT_KEY);
    if (savedAccent && ACCENTS[savedAccent]) currentAccent = savedAccent;
    const lch = (l, c, h) => `oklch(${l} ${c} ${h})`;
    function applyAccent(key) {
      const [h, c] = ACCENTS[key] ?? ACCENTS.teal;
      const dark = getTheme() === "dark";
      const st = root.style;
      st.setProperty("--accent", lch(dark ? 0.72 : 0.55, c, h));
      st.setProperty("--accent-hover", lch(dark ? 0.77 : 0.5, c, h));
      st.setProperty("--accent-active", lch(dark ? 0.82 : 0.45, c * 0.92, h));
      st.setProperty("--accent-soft", lch(dark ? 0.3 : 0.94, c * 0.3, h));
      st.setProperty("--accent-softer", lch(dark ? 0.27 : 0.975, c * 0.12, h));
      st.setProperty("--accent-ink", lch(0.985, 6e-3, h));
      st.setProperty("--accent-strong", lch(dark ? 0.68 : 0.42, c * 0.9, h));
      localStorage.setItem(ACCENT_KEY, key);
      currentAccent = key;
      $$(".accent-pill").forEach((b) => b.classList.toggle("is-active", b.dataset.a === key));
    }
    applyAccent(currentAccent);
    $$(".accent-pill").forEach((btn) => btn.addEventListener("click", () => applyAccent(btn.dataset.a ?? "teal")));
    const ICON = {
      ok: "i-check-c",
      warn: "i-warn",
      danger: "i-alert",
      info: "i-info",
      accent: "i-zap"
    };
    const toastWrap = $("#toast-wrap");
    const toastDedupe = /* @__PURE__ */ new Set();
    function showToast(title, variant = "info", body = "", opts = {}) {
      if (opts.key && toastDedupe.has(opts.key)) return;
      if (opts.key) toastDedupe.add(opts.key);
      if (!toastWrap) return;
      const el = document.createElement("div");
      el.className = `toast toast--${variant}`;
      el.innerHTML = `<span class="toast__ico">${ico(ICON[variant] ?? "i-info")}</span><div><div class="toast__title">${esc(title)}</div>` + (body ? `<div class="toast__body">${esc(body)}</div>` : "") + `</div><button class="toast__close" type="button" aria-label="\uB2EB\uAE30">${ico("i-x")}</button><span class="toast__progress"></span>`;
      toastWrap.append(el);
      const duration = opts.duration ?? 4e3;
      el.style.setProperty("--toast-ms", `${duration}ms`);
      const close = () => {
        if (el.classList.contains("is-leaving")) return;
        el.classList.add("is-leaving");
        el.addEventListener("animationend", () => el.remove(), { once: true });
      };
      el.querySelector(".toast__close")?.addEventListener("click", close);
      setTimeout(close, duration);
    }
    $$("[data-toast]").forEach((btn) => btn.addEventListener("click", () => showToast(
      btn.dataset.title ?? "\uC54C\uB9BC",
      btn.dataset.toast ?? "info",
      btn.dataset.body ?? "",
      { key: btn.dataset.key }
    )));
    const sideNav = $("#side-nav");
    const sections = $$("section.section");
    const secInfo = sections.map((s) => ({
      id: s.id,
      title: $(".h2", s)?.textContent?.trim() ?? s.id,
      num: $(".sec-id", s)?.textContent?.trim() ?? ""
    }));
    if (sideNav) {
      sideNav.innerHTML = secInfo.map((s, i) => `<a href="#${s.id}" data-nav="${i}">${esc(s.title)}<span class="nav-num">${String(i + 1).padStart(2, "0")}</span></a>`).join("");
    }
    const navLinks = $$(".side-nav a[data-nav]");
    const setActive = (i) => {
      navLinks.forEach((a, idx) => a.classList.toggle("is-active", idx === i));
    };
    if (navLinks.length) {
      const spy = new IntersectionObserver(
        (entries) => {
          entries.forEach((en) => {
            if (en.isIntersecting) setActive(Number(en.target.getAttribute("data-nav-i")));
          });
        },
        { rootMargin: "-25% 0px -65% 0px" }
      );
      sections.forEach((s, i) => {
        s.dataset.navI = String(i);
        spy.observe(s);
      });
      navLinks.forEach((a) => a.addEventListener("click", (e) => {
        e.preventDefault();
        const id = a.getAttribute("href").slice(1);
        $(`#${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
        history.replaceState(null, "", `#${id}`);
      }));
    }
    const searchInput = $("#search-input");
    const noResults = $("#no-results");
    function applySearch(q) {
      const needle = q.trim().toLowerCase();
      let visible = 0;
      const totalDemos = $$(".demo").length;
      if (!needle) {
        $$(".demo").forEach((d) => d.classList.remove("is-searching"));
        visible = totalDemos;
      } else {
        sections.forEach((sec) => {
          const hits = $$(".demo", sec).filter((d) => d.textContent?.toLowerCase().includes(needle));
          $$(".demo", sec).forEach((d) => d.classList.toggle("is-searching", !hits.includes(d)));
          visible += hits.length;
        });
      }
      noResults?.classList.toggle("is-visible", visible === 0);
    }
    searchInput?.addEventListener("input", () => applySearch(searchInput.value));
    const palette = $("#palette");
    const paletteInput = $("#palette-input");
    const paletteList = $("#palette-list");
    let paletteItems = [];
    let paletteActive = 0;
    function buildPalette() {
      if (!paletteList) return;
      paletteList.innerHTML = secInfo.map((s, i) => `<button class="palette__item" data-pi="${i}" type="button"><span class="p-ico">${ico("i-grid")}</span><span>${esc(s.title)}</span><span class="p-num">${String(i + 1).padStart(2, "0")}</span></button>`).join("");
      paletteItems = $$(".palette__item", paletteList);
      paletteItems.forEach((it) => it.addEventListener("click", () => jumpTo(Number(it.dataset.pi))));
      filterPalette("");
    }
    function jumpTo(i) {
      const s = sections[i];
      if (!s) return;
      closePalette();
      s.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", `#${s.id}`);
    }
    function filterPalette(q) {
      if (!paletteList) return;
      const needle = q.trim().toLowerCase();
      let shown = 0;
      paletteItems.forEach((it, i) => {
        const hit = !needle || secInfo[i].title.toLowerCase().includes(needle);
        it.style.display = hit ? "" : "none";
        if (hit) shown++;
      });
      if (!paletteList.querySelector(".palette__empty")) {
        const empty = document.createElement("div");
        empty.className = "palette__empty";
        empty.textContent = "\uC77C\uCE58\uD558\uB294 \uCEF4\uD3EC\uB10C\uD2B8\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.";
        paletteList.append(empty);
      }
      const emptyEl = paletteList.querySelector(".palette__empty");
      emptyEl.style.display = shown === 0 ? "" : "none";
      paletteActive = 0;
      markActive();
    }
    function markActive() {
      paletteItems.forEach((it, i) => {
        const on = i === paletteActive && it.style.display !== "none";
        it.classList.toggle("is-active", on);
        if (on) it.scrollIntoView({ block: "nearest" });
      });
    }
    function openPalette() {
      if (!palette) return;
      palette.classList.add("is-open");
      palette.setAttribute("aria-hidden", "false");
      buildPalette();
      setTimeout(() => paletteInput?.focus(), 60);
    }
    function closePalette() {
      palette?.classList.remove("is-open");
      palette?.setAttribute("aria-hidden", "true");
      paletteInput?.blur();
    }
    $$("[data-palette-open]").forEach((b) => b.addEventListener("click", openPalette));
    $("[data-palette-close]")?.addEventListener("click", closePalette);
    paletteInput?.addEventListener("input", () => filterPalette(paletteInput.value));
    paletteInput?.addEventListener("keydown", (e) => {
      const visible = paletteItems.filter((it) => it.style.display !== "none");
      if (!visible.length) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const dir = e.key === "ArrowDown" ? 1 : -1;
        const cur = Math.max(0, visible.findIndex((it) => it.classList.contains("is-active")));
        const next = visible[(cur + dir + visible.length) % visible.length];
        const real = paletteItems.indexOf(next);
        if (real >= 0) paletteActive = real;
        markActive();
      } else if (e.key === "Enter") {
        e.preventDefault();
        const activeEl = paletteItems.find(
          (it) => it.classList.contains("is-active") && it.style.display !== "none"
        );
        const id = activeEl?.dataset.pi;
        if (id) jumpTo(Number(id));
      }
    });
    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (palette?.classList.contains("is-open")) closePalette();
        else openPalette();
      }
      if (e.key === "Escape") {
        closePalette();
        closeTopOverlay();
      }
    });
    const overlayStack = [];
    let lastFocused = null;
    const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    function lockScroll(on) {
      document.body.style.overflow = on ? "hidden" : "";
    }
    function openOverlay(el) {
      overlayStack.push(el);
      el.classList.add("is-open");
      el.setAttribute("aria-hidden", "false");
      lastFocused = document.activeElement;
      lockScroll(true);
      const first = el.querySelector(FOCUSABLE);
      setTimeout(() => first?.focus(), 90);
    }
    function closeOverlay(el) {
      const i = overlayStack.indexOf(el);
      if (i >= 0) overlayStack.splice(i, 1);
      if (!el.classList.contains("is-open")) return;
      el.classList.remove("is-open");
      el.setAttribute("aria-hidden", "true");
      if (overlayStack.length === 0) {
        lockScroll(false);
        lastFocused?.focus();
      }
    }
    function closeTopOverlay() {
      const top = overlayStack[overlayStack.length - 1];
      if (top) closeOverlay(top);
    }
    function trapFocus(e, el) {
      if (e.key !== "Tab") return;
      const items = $$(FOCUSABLE, el).filter((n) => n.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    const modals = $$(".modal");
    modals.forEach((m) => {
      m.addEventListener("keydown", (e) => trapFocus(e, m));
    });
    $$("[data-modal-open]").forEach((btn) => btn.addEventListener("click", () => {
      const m = $(`[data-modal="${btn.dataset.modalOpen}"]`);
      if (m) openOverlay(m);
    }));
    $$("[data-modal-close]").forEach((btn) => btn.addEventListener("click", () => {
      const m = btn.closest(".modal");
      if (m) closeOverlay(m);
    }));
    modals.forEach((m) => $(".modal__overlay", m)?.addEventListener("click", () => closeOverlay(m)));
    const drawers = $$(".drawer");
    drawers.forEach((d) => {
      d.addEventListener("keydown", (e) => trapFocus(e, d));
    });
    $$("[data-drawer-open]").forEach((btn) => btn.addEventListener("click", () => {
      const d = $(`[data-drawer="${btn.dataset.drawerOpen}"]`);
      if (d) openOverlay(d);
    }));
    $$("[data-drawer-close]").forEach((btn) => btn.addEventListener("click", () => {
      const d = btn.closest(".drawer");
      if (d) closeOverlay(d);
    }));
    drawers.forEach((d) => $(".drawer__overlay", d)?.addEventListener("click", () => closeOverlay(d)));
    function confirmDialog(opts) {
      return new Promise((resolve) => {
        const wrap = document.createElement("div");
        wrap.className = "modal";
        wrap.innerHTML = `<div class="modal__overlay" data-c-close></div><div class="modal__dialog modal__dialog--sm" role="alertdialog" aria-modal="true"><div class="modal__body" style="padding:24px">` + (opts.danger ? `<div class="modal__icon-big">${ico("i-trash")}</div>` : "") + `<h3 style="font-size:16px;font-weight:700">${esc(opts.title)}</h3>` + (opts.body ? `<p style="margin-top:8px;font-size:13.5px;color:var(--ink-2)">${esc(opts.body)}</p>` : "") + `</div><div class="modal__foot"><button class="btn btn--ghost" data-c-no type="button">\uCDE8\uC18C</button><button class="btn ${opts.danger ? "btn--danger" : "btn--primary"}" data-c-yes type="button">${esc(opts.ok ?? "\uD655\uC778")}</button></div></div>`;
        document.body.append(wrap);
        let done = false;
        const finish = (v) => {
          if (done) return;
          done = true;
          closeOverlay(wrap);
          setTimeout(() => wrap.remove(), 350);
          resolve(v);
        };
        wrap.querySelector("[data-c-yes]")?.addEventListener("click", () => finish(true));
        wrap.querySelector("[data-c-no]")?.addEventListener("click", () => finish(false));
        wrap.querySelector("[data-c-close]")?.addEventListener("click", () => finish(false));
        wrap.addEventListener("keydown", (e) => {
          if (e.key === "Escape") finish(false);
          trapFocus(e, wrap);
        });
        openOverlay(wrap);
      });
    }
    $$("[data-confirm]").forEach((btn) => btn.addEventListener("click", async () => {
      const ok = await confirmDialog({
        title: btn.dataset.title ?? "\uC815\uB9D0 \uC9C4\uD589\uD560\uAE4C\uC694?",
        body: btn.dataset.body,
        ok: btn.dataset.ok,
        danger: btn.hasAttribute("data-danger")
      });
      showToast(
        ok ? "\uD655\uC778\uB428" : "\uCDE8\uC18C\uB428",
        ok ? "ok" : "info",
        ok ? "\uC694\uCCAD\uD55C \uC791\uC5C5\uC774 \uC2E4\uD589\uB418\uC5C8\uC2B5\uB2C8\uB2E4." : "\uBCC0\uACBD \uC0AC\uD56D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4."
      );
    }));
    $$(".tabs[data-tabs]").forEach((group) => {
      const items = $$(".tabs__item", group);
      const select = (key) => {
        items.forEach((it) => {
          const on = it.dataset.tab === key;
          it.classList.toggle("is-active", on);
          it.setAttribute("aria-selected", String(on));
        });
        const host = group.parentElement;
        $$("[data-tab-panel]").forEach((p) => {
          const on = p.dataset.tabPanel === key;
          p.classList.toggle("is-active", on);
          if (host && !host.contains(p)) p.setAttribute("hidden", on ? "" : "hidden");
          else p.toggleAttribute("hidden", !on);
        });
      };
      items.forEach((it, idx) => {
        it.setAttribute("aria-selected", String(it.classList.contains("is-active")));
        it.addEventListener("click", () => select(it.dataset.tab ?? ""));
        it.addEventListener("keydown", (e) => {
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          e.preventDefault();
          const next = items[(idx + (e.key === "ArrowRight" ? 1 : -1) + items.length) % items.length];
          next.focus();
          next.click();
        });
      });
    });
    $$(".dropdown[data-dropdown]").forEach((dd) => {
      const toggle = $("[data-dropdown-toggle]", dd);
      toggle?.addEventListener("click", (e) => {
        e.stopPropagation();
        $$(".dropdown.is-open").forEach((o) => {
          if (o !== dd) o.classList.remove("is-open");
        });
        dd.classList.toggle("is-open");
      });
      dd.addEventListener("click", (e) => {
        if (!e.target.closest("[data-dropdown-toggle]")) dd.classList.remove("is-open");
      });
    });
    document.addEventListener("click", () => $$(".dropdown.is-open").forEach((d) => d.classList.remove("is-open")));
    $$(".accordion[data-accordion]").forEach((acc) => {
      const single = acc.hasAttribute("data-single");
      $$(".accordion__item", acc).forEach((item) => {
        item.querySelector(".accordion__head")?.addEventListener("click", () => {
          const willOpen = !item.classList.contains("is-open");
          if (single) {
            $$(".accordion__item", acc).forEach((o) => {
              o.classList.remove("is-open");
              o.querySelector(".accordion__head")?.setAttribute("aria-expanded", "false");
            });
          }
          item.classList.toggle("is-open", willOpen);
          item.querySelector(".accordion__head")?.setAttribute("aria-expanded", String(willOpen));
        });
      });
    });
    $$("[data-copy]").forEach((btn) => btn.addEventListener("click", async () => {
      const code = btn.closest(".codeblock")?.querySelector("pre code");
      const text = code?.textContent ?? "";
      try {
        await navigator.clipboard.writeText(text);
        showToast("\uBCF5\uC0AC\uB428", "ok", "\uD074\uB9BD\uBCF4\uB4DC\uC5D0 \uBCF5\uC0AC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.", { key: "copy" });
      } catch {
        showToast("\uBCF5\uC0AC \uC2E4\uD328", "danger", "\uD074\uB9BD\uBCF4\uB4DC \uAD8C\uD55C\uC744 \uD655\uC778\uD574\uC8FC\uC138\uC694.");
      }
    }));
    $$("[data-pwd-toggle]").forEach((btn) => btn.addEventListener("click", () => {
      const input = $(btn.dataset.pwdToggle ?? "");
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.innerHTML = ico(show ? "i-eye-off" : "i-eye");
    }));
    $$("input[data-range]").forEach((r) => {
      const out = $(r.dataset.rangeOut ?? "");
      const sync = () => {
        if (out) out.textContent = r.value;
      };
      r.addEventListener("input", sync);
      sync();
    });
    $$(".rating[data-rating]").forEach((rt) => {
      const readonly = rt.hasAttribute("data-readonly");
      const out = $(rt.dataset.ratingOut ?? "");
      let value = Number(rt.dataset.rating || 0);
      const render = () => {
        rt.innerHTML = Array.from({ length: 5 }, (_, i) => `<button type="button" class="${i < value ? "is-on" : ""}" data-v="${i + 1}" aria-label="${i + 1}\uC810">\u2605</button>`).join("");
        if (out) out.textContent = `${value} / 5 \uC810`;
      };
      rt.addEventListener("click", (e) => {
        if (readonly) return;
        const t = e.target.closest("button[data-v]");
        if (!t) return;
        const v = Number(t.dataset.v);
        value = v === value ? 0 : v;
        rt.dataset.rating = String(value);
        render();
      });
      render();
    });
    $$(".otp[data-otp]").forEach((wrap) => {
      const inputs = $$("input", wrap);
      inputs.forEach((inp, i) => {
        inp.addEventListener("input", () => {
          inp.value = inp.value.replace(/\D/g, "").slice(0, 1);
          if (inp.value && i < inputs.length - 1) inputs[i + 1].focus();
        });
        inp.addEventListener("keydown", (e) => {
          if (e.key === "Backspace" && !inp.value && i > 0) inputs[i - 1].focus();
          if (e.key === "ArrowLeft" && i > 0) {
            e.preventDefault();
            inputs[i - 1].focus();
          }
          if (e.key === "ArrowRight" && i < inputs.length - 1) {
            e.preventDefault();
            inputs[i + 1].focus();
          }
        });
        inp.addEventListener("paste", (e) => {
          e.preventDefault();
          const digits = (e.clipboardData?.getData("text") ?? "").replace(/\D/g, "").split("");
          digits.slice(0, inputs.length - i).forEach((d, k) => {
            inputs[i + k].value = d;
          });
          inputs[Math.min(i + digits.length, inputs.length - 1)].focus();
        });
      });
    });
    $$("[data-file-drop]").forEach((drop) => {
      const input = $("input[type=file]", drop);
      const label = $(".file-drop__file", drop);
      const setFile = (f) => {
        if (!label) return;
        label.textContent = f ? `${f.name} \xB7 ${(f.size / 1024).toFixed(0)}KB` : "";
        drop.classList.toggle("has-file", !!f);
      };
      drop.addEventListener("click", () => input?.click());
      drop.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          input?.click();
        }
      });
      input?.addEventListener("change", () => setFile(input.files?.[0] ?? null));
      ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => {
        e.preventDefault();
        drop.classList.add("is-drag");
      }));
      ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => {
        e.preventDefault();
        drop.classList.remove("is-drag");
      }));
      drop.addEventListener("drop", (e) => {
        const f = e.dataTransfer?.files?.[0] ?? null;
        setFile(f);
        if (f) showToast("\uD30C\uC77C \uC120\uD0DD\uB428", "ok", f.name);
      });
    });
    $$(".chips[data-chips]").forEach((wrap) => {
      const input = $("input[type=text]", wrap);
      const add = () => {
        const v = input?.value.trim() ?? "";
        if (!v) return;
        const exists = $$(".chip", wrap).some((c) => c.textContent?.replace("\xD7", "").trim() === v);
        if (exists) {
          showToast("\uC911\uBCF5 \uD0DC\uADF8", "warn", `"${v}"\uB294 \uC774\uBBF8 \uC788\uC2B5\uB2C8\uB2E4.`, { key: "dup" });
          return;
        }
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.innerHTML = `${esc(v)}<button type="button" aria-label="\uC81C\uAC70">\xD7</button>`;
        wrap.insertBefore(chip, input);
        if (input) input.value = "";
      };
      input?.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === ",") {
          e.preventDefault();
          add();
        }
        if (e.key === "Backspace" && !input.value) {
          wrap.querySelector(".chip:last-of-type")?.remove();
        }
      });
      input?.addEventListener("blur", add);
      wrap.addEventListener("click", (e) => {
        if (e.target.closest(".chip button")) {
          e.target.closest(".chip")?.remove();
        }
      });
    });
    $$("table[data-sort-table]").forEach((table) => {
      const tbody = table.tBodies[0];
      const rows = Array.from(tbody?.rows ?? []);
      $$("th[data-sort]", table).forEach((th) => {
        th.addEventListener("click", () => {
          const key = th.dataset.sort ?? "";
          const ascending = !th.classList.contains("sort-asc");
          table.querySelectorAll("th[data-sort]").forEach((h) => {
            h.classList.remove("sort-asc", "sort-desc");
            h.querySelector(".sort-ico").textContent = "\u25B2";
          });
          th.classList.toggle("sort-asc", ascending);
          th.classList.toggle("sort-desc", !ascending);
          th.querySelector(".sort-ico").textContent = ascending ? "\u25B2" : "\u25BC";
          const col = Array.from(th.parentElement.children).indexOf(th);
          const sorted = rows.map((r, i) => ({ r, i, cell: r.cells[col]?.textContent?.trim() ?? "" })).sort((a, b) => {
            const av = parseCell(a.cell);
            const bv = parseCell(b.cell);
            return (av.num !== null && bv.num !== null ? av.num - bv.num : av.raw.localeCompare(bv.raw, "ko")) * (ascending ? 1 : -1);
          });
          sorted.forEach(({ r }, i) => tbody.append(r));
        });
      });
      const checkAll = $("[data-check-all]", table);
      const rowChecks = $$("[data-check-row]", table);
      const refreshMaster = () => {
        if (!checkAll) return;
        const checked = rowChecks.filter((c) => c.checked).length;
        checkAll.checked = checked === rowChecks.length && checked > 0;
        checkAll.indeterminate = checked > 0 && checked < rowChecks.length;
      };
      rowChecks.forEach((c) => c.addEventListener("change", () => {
        c.closest("tr")?.classList.toggle("is-selected", c.checked);
        refreshMaster();
      }));
      checkAll?.addEventListener("change", () => {
        rowChecks.forEach((c) => {
          c.checked = checkAll.checked;
          c.closest("tr")?.classList.toggle("is-selected", checkAll.checked);
        });
        refreshMaster();
      });
      refreshMaster();
    });
    function parseCell(text) {
      const cleaned = text.replace(/[₩,,\s%]/g, "");
      const n = Number(cleaned);
      return { num: Number.isFinite(n) && cleaned !== "" ? n : null, raw: text };
    }
    $("[data-progress-demo]")?.addEventListener("click", () => {
      $$("[data-progress]").forEach((bar) => {
        const target = Number(bar.dataset.progress ?? 0);
        bar.style.width = "0%";
        requestAnimationFrame(() => requestAnimationFrame(() => {
          bar.style.width = `${target}%`;
        }));
      });
      const valEl = $("#progress-val");
      if (valEl) {
        const target = Number($("#progress-bar")?.dataset.progress ?? 0);
        const t0 = performance.now();
        const tick = (t) => {
          const p = Math.min(1, (t - t0) / 700);
          valEl.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    });
    const RING_C = 2 * Math.PI * 40;
    $("[data-ring-demo]")?.addEventListener("click", () => {
      $$("[data-ring]").forEach((circle) => {
        const target = Number(circle.dataset.ring ?? 0);
        circle.style.strokeDashoffset = String(RING_C);
        requestAnimationFrame(() => requestAnimationFrame(() => {
          circle.style.strokeDashoffset = String(RING_C * (1 - target / 100));
        }));
      });
      const valEl = $("#ring-val");
      if (valEl) {
        const target = Number($("[data-ring]")?.dataset.ring ?? 0);
        const t0 = performance.now();
        const tick = (t) => {
          const p = Math.min(1, (t - t0) / 800);
          valEl.textContent = `${Math.round(target * (1 - Math.pow(1 - p, 3)))}%`;
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    });
    $$("[data-progress]").forEach((bar) => {
      if (!bar.style.width || bar.style.width === "0%") bar.style.width = "0%";
    });
    $$("[data-ring]").forEach((c) => c.style.strokeDashoffset = String(RING_C * (1 - Number(c.dataset.ring ?? 0) / 100)));
    $$("[data-btn-loading]").forEach((btn) => btn.addEventListener("click", () => {
      if (btn.classList.contains("is-loading")) return;
      const label = btn.textContent?.trim() ?? "";
      btn.classList.add("is-loading");
      btn.setAttribute("aria-busy", "true");
      setTimeout(() => {
        btn.classList.remove("is-loading");
        btn.setAttribute("aria-busy", "false");
        showToast("\uC644\uB8CC", "ok", label ? `"${label}" \uC791\uC5C5\uC774 \uB05D\uB0AC\uC2B5\uB2C8\uB2E4.` : void 0);
      }, 1600);
    }));
    $$("[data-banner-close]").forEach((btn) => btn.addEventListener("click", () => {
      const target = $(btn.dataset.bannerClose ?? "");
      target?.classList.add("is-hidden");
    }));
    $$(".carousel[data-carousel]").forEach((car) => {
      const track = $(".carousel__track", car);
      const slides = $$(".carousel__slide", car);
      const dots = $$("[data-carousel-dot]", car);
      let idx = 0;
      const go = (i) => {
        idx = (i + slides.length) % slides.length;
        if (track) track.style.transform = `translateX(-${idx * 100}%)`;
        dots.forEach((d, k) => d.classList.toggle("is-active", k === idx));
      };
      $("[data-carousel-prev]", car)?.addEventListener("click", () => go(idx - 1));
      $("[data-carousel-next]", car)?.addEventListener("click", () => go(idx + 1));
      dots.forEach((d) => d.addEventListener("click", () => go(Number(d.dataset.carouselDot))));
    });
    $$("[data-ticker]").forEach((tk) => {
      const target = Date.now() + 24 * 3600 * 1e3;
      const pad = (n) => String(n).padStart(2, "0");
      const tick = () => {
        const diff = Math.max(0, target - Date.now());
        const s = Math.floor(diff / 1e3);
        const set = (k, v) => {
          const el = tk.querySelector(`[data-tick="${k}"]`);
          if (el) el.textContent = v;
        };
        set("d", pad(Math.floor(s / 86400)));
        set("h", pad(Math.floor(s % 86400 / 3600)));
        set("m", pad(Math.floor(s % 3600 / 60)));
        set("s", pad(s % 60));
      };
      tick();
      setInterval(tick, 1e3);
    });
    $$("form.js-form-demo").forEach((form) => {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        let ok = true;
        $$("[required]", form).forEach((inp) => {
          const field = inp.closest(".field");
          if (!inp.value.trim()) {
            field?.classList.add("has-error");
            ok = false;
          } else {
            field?.classList.remove("has-error");
          }
        });
        if (!ok) {
          showToast("\uC785\uB825 \uD655\uC778", "warn", "\uD544\uC218 \uD56D\uBAA9\uC744 \uCC44\uC6CC\uC8FC\uC138\uC694.");
          return;
        }
        const btn = $("[type=submit]", form);
        if (btn) {
          btn.classList.add("is-loading");
          btn.setAttribute("aria-busy", "true");
        }
        setTimeout(() => {
          btn?.classList.remove("is-loading");
          btn?.removeAttribute("aria-busy");
          form.reset();
          showToast("\uC81C\uCD9C \uC644\uB8CC", "ok", "\uB370\uBAA8 \uD3FC\uC774 \uC804\uC1A1\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
        }, 1400);
      });
    });
    document.documentElement.dataset.ready = "true";
  })();
})();
