const root = document.documentElement;
const themeToggle = document.querySelector<HTMLButtonElement>("#themeToggle");
const menuToggle = document.querySelector<HTMLButtonElement>("#menuToggle");
const sidebar = document.querySelector<HTMLElement>("#sidebar");
const scrim = document.querySelector<HTMLElement>("#scrim");

const storedTheme = localStorage.getItem("obsidian-theme");
if (storedTheme === "dark") root.dataset.theme = "dark";

function setTheme(theme: "light" | "dark") {
  root.dataset.theme = theme;
  localStorage.setItem("obsidian-theme", theme);
  themeToggle?.setAttribute(
    "aria-label",
    theme === "light" ? "다크 모드로 전환" : "라이트 모드로 전환",
  );
}

function setMenu(open: boolean) {
  sidebar?.classList.toggle("is-open", open);
  scrim?.classList.toggle("is-visible", open);
  menuToggle?.setAttribute("aria-expanded", String(open));
}

themeToggle?.addEventListener("click", () =>
  setTheme(root.dataset.theme === "dark" ? "light" : "dark"),
);
menuToggle?.addEventListener("click", () =>
  setMenu(!sidebar?.classList.contains("is-open")),
);
scrim?.addEventListener("click", () => setMenu(false));
sidebar
  ?.querySelectorAll("a")
  .forEach((link) => link.addEventListener("click", () => setMenu(false)));

const sections = [
  ...document.querySelectorAll<HTMLElement>(".catalog-section, #overview"),
];
const navLinks = [
  ...document.querySelectorAll<HTMLAnchorElement>(".side-nav a"),
];
const observer = new IntersectionObserver(
  (entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    navLinks.forEach((link) =>
      link.classList.toggle("is-active", link.hash === `#${visible.target.id}`),
    );
  },
  { rootMargin: "-20% 0px -65%", threshold: [0, 0.2, 0.5] },
);
sections.forEach((section) => observer.observe(section));

// Small controls -------------------------------------------------------------
document.querySelectorAll<HTMLElement>(".segmented").forEach((control) => {
  control
    .querySelectorAll<HTMLButtonElement>("[data-segment]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        control
          .querySelectorAll("[data-segment]")
          .forEach((item) => item.classList.remove("is-selected"));
        button.classList.add("is-selected");
      });
    });
});

const passwordInput =
  document.querySelector<HTMLInputElement>("#passwordInput");
const passwordToggle =
  document.querySelector<HTMLButtonElement>("#passwordToggle");
passwordToggle?.addEventListener("click", () => {
  if (!passwordInput) return;
  const showing = passwordInput.type === "text";
  passwordInput.type = showing ? "password" : "text";
  passwordToggle.textContent = showing ? "Show" : "Hide";
});

const noteInput = document.querySelector<HTMLTextAreaElement>("#noteInput");
const noteCount = document.querySelector<HTMLElement>("#noteCount");
noteInput?.addEventListener("input", () => {
  if (noteCount) noteCount.textContent = `${noteInput.value.length} / 140`;
});

const rangeInput = document.querySelector<HTMLInputElement>("#rangeInput");
const rangeOutput = document.querySelector<HTMLOutputElement>("#rangeOutput");
function updateRange() {
  if (!rangeInput || !rangeOutput) return;
  const value = Number(rangeInput.value);
  const min = Number(rangeInput.min);
  const max = Number(rangeInput.max);
  const percent = ((value - min) / (max - min)) * 100;
  rangeInput.style.background = `linear-gradient(to right, var(--ink) 0 ${percent}%, rgba(0,0,0,.18) ${percent}%)`;
  rangeOutput.value = `$${value.toLocaleString("en-US")}`;
}
rangeInput?.addEventListener("input", updateRange);
updateRange();

let stepperValue = 4;
const stepperOutput =
  document.querySelector<HTMLOutputElement>("#stepperOutput");
document
  .querySelectorAll<HTMLButtonElement>("[data-step]")
  .forEach((button) => {
    button.addEventListener("click", () => {
      stepperValue = Math.max(
        0,
        Math.min(99, stepperValue + Number(button.dataset.step)),
      );
      if (stepperOutput)
        stepperOutput.value = String(stepperValue).padStart(2, "0");
    });
  });

const pinInputs = [
  ...document.querySelectorAll<HTMLInputElement>("#pinInput input"),
];
pinInputs.forEach((input, index) => {
  input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, "").slice(0, 1);
    if (input.value) pinInputs[index + 1]?.focus();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Backspace" && !input.value)
      pinInputs[index - 1]?.focus();
  });
  input.addEventListener("paste", (event) => {
    const code = event.clipboardData
      ?.getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (!code) return;
    event.preventDefault();
    [...code].forEach((char, itemIndex) => {
      if (pinInputs[itemIndex]) pinInputs[itemIndex].value = char;
    });
    pinInputs[Math.min(code.length, 6) - 1]?.focus();
  });
});

const dropzone = document.querySelector<HTMLElement>("#dropzone");
["dragenter", "dragover"].forEach((name) =>
  dropzone?.addEventListener(name, (event) => {
    event.preventDefault();
    dropzone.classList.add("is-dragging");
  }),
);
["dragleave", "drop"].forEach((name) =>
  dropzone?.addEventListener(name, (event) => {
    event.preventDefault();
    dropzone.classList.remove("is-dragging");
  }),
);

// Navigation and disclosure --------------------------------------------------
document.querySelectorAll<HTMLElement>("[data-tabs]").forEach((tabs) => {
  const buttons = [...tabs.querySelectorAll<HTMLButtonElement>("[data-tab]")];
  const panels = [...tabs.querySelectorAll<HTMLElement>(".tab-panel")];
  buttons.forEach((button, index) => {
    button.addEventListener("click", () => {
      buttons.forEach((item) => {
        item.classList.remove("is-active");
        item.setAttribute("aria-selected", "false");
      });
      panels.forEach((panel) => panel.classList.remove("is-active"));
      button.classList.add("is-active");
      button.setAttribute("aria-selected", "true");
      document
        .querySelector<HTMLElement>(`#${button.dataset.tab}`)
        ?.classList.add("is-active");
    });
    button.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      const next =
        event.key === "ArrowRight"
          ? (index + 1) % buttons.length
          : (index - 1 + buttons.length) % buttons.length;
      buttons[next].focus();
      buttons[next].click();
    });
  });
});

document
  .querySelectorAll<HTMLButtonElement>(".pagination button")
  .forEach((button) => {
    if (!/^\d+$/.test(button.textContent?.trim() ?? "")) return;
    button.addEventListener("click", () => {
      document
        .querySelectorAll(".pagination button")
        .forEach((item) => item.classList.remove("is-current"));
      button.classList.add("is-current");
    });
  });

document
  .querySelectorAll<HTMLElement>("[data-accordion]")
  .forEach((accordion) => {
    accordion
      .querySelectorAll<HTMLButtonElement>(".accordion-item > button")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const item = button.parentElement;
          const opening = !item?.classList.contains("is-open");
          accordion.querySelectorAll(".accordion-item").forEach((row) => {
            row.classList.remove("is-open");
            const trigger = row.querySelector("button");
            trigger?.setAttribute("aria-expanded", "false");
            const symbol = trigger?.querySelector("span");
            if (symbol) symbol.textContent = "+";
          });
          if (opening && item) {
            item.classList.add("is-open");
            button.setAttribute("aria-expanded", "true");
            const symbol = button.querySelector("span");
            if (symbol) symbol.textContent = "−";
          }
        });
      });
  });

// Table ----------------------------------------------------------------------
const tableFilter = document.querySelector<HTMLInputElement>("#tableFilter");
const projectRows =
  document.querySelector<HTMLTableSectionElement>("#projectRows");
const selectAll = document.querySelector<HTMLInputElement>("#selectAll");
tableFilter?.addEventListener("input", () => {
  const query = tableFilter.value.toLocaleLowerCase();
  projectRows?.querySelectorAll<HTMLTableRowElement>("tr").forEach((row) => {
    row.classList.toggle(
      "is-filtered",
      !row.textContent?.toLocaleLowerCase().includes(query),
    );
  });
});
selectAll?.addEventListener("change", () => {
  projectRows
    ?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
    .forEach((checkbox) => {
      checkbox.checked = selectAll.checked;
      checkbox
        .closest("tr")
        ?.classList.toggle("is-selected", selectAll.checked);
    });
});
projectRows
  ?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
  .forEach((checkbox) => {
    checkbox.addEventListener("change", () =>
      checkbox.closest("tr")?.classList.toggle("is-selected", checkbox.checked),
    );
  });
let sortDirection = 1;
document
  .querySelectorAll<HTMLButtonElement>("[data-sort]")
  .forEach((button) => {
    button.addEventListener("click", () => {
      if (!projectRows) return;
      const key = button.dataset.sort ?? "name";
      const rows = [...projectRows.querySelectorAll<HTMLTableRowElement>("tr")];
      rows.sort(
        (a, b) =>
          (a.dataset[key] ?? "").localeCompare(
            b.dataset[key] ?? "",
            undefined,
            { numeric: true },
          ) * sortDirection,
      );
      sortDirection *= -1;
      rows.forEach((row) => projectRows.append(row));
    });
  });

// Local filtering ------------------------------------------------------------
const componentFilter =
  document.querySelector<HTMLInputElement>("#componentFilter");
const filterHost = componentFilter?.closest(".specimen");
componentFilter?.addEventListener("input", () => {
  const query = componentFilter.value.trim().toLocaleLowerCase();
  document.querySelectorAll<HTMLElement>(".specimen").forEach((card) => {
    const shouldHide =
      Boolean(query) &&
      card !== filterHost &&
      !card.textContent?.toLocaleLowerCase().includes(query);
    card.classList.toggle("is-search-hidden", shouldHide);
  });
  document
    .querySelectorAll<HTMLElement>(".catalog-section")
    .forEach((section) => {
      const cards = [...section.querySelectorAll<HTMLElement>(".specimen")];
      section.classList.toggle(
        "is-search-hidden",
        Boolean(query) &&
          cards.every((card) => card.classList.contains("is-search-hidden")),
      );
    });
});

// Feedback -------------------------------------------------------------------
document
  .querySelectorAll<HTMLButtonElement>(".alert > button, .demo-toast > button")
  .forEach((button) => {
    button.addEventListener("click", () => button.parentElement?.remove());
  });

function showToast(title: string, message: string) {
  const region = document.querySelector<HTMLElement>("#toastRegion");
  if (!region) return;
  const toast = document.createElement("div");
  toast.className = "live-toast";
  toast.innerHTML = `<span>✓</span><div><b>${title}</b><small>${message}</small></div><button type="button" aria-label="닫기">×</button>`;
  region.append(toast);
  toast
    .querySelector("button")
    ?.addEventListener("click", () => toast.remove());
  window.setTimeout(() => toast.remove(), 4200);
}

document
  .querySelector("#toastTrigger")
  ?.addEventListener("click", () =>
    showToast("Saved successfully", "Your preferences are up to date."),
  );
document
  .querySelector("#splitAction")
  ?.addEventListener("click", () =>
    showToast("Export started", "Your report will be ready shortly."),
  );
document
  .querySelector("#copyCode")
  ?.addEventListener("click", async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    try {
      await navigator.clipboard.writeText(
        document.querySelector(".code-card pre")?.textContent ?? "",
      );
    } catch {
      /* file:// can deny clipboard */
    }
    button.textContent = "Copied";
    window.setTimeout(() => {
      button.textContent = "Copy";
    }, 1500);
  });

// Popovers -------------------------------------------------------------------
document
  .querySelectorAll<HTMLButtonElement>("[data-popover-trigger]")
  .forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      const target = document.querySelector<HTMLElement>(
        `#${trigger.dataset.popoverTrigger}`,
      );
      if (!target) return;
      const visible = target.classList.toggle("is-visible");
      trigger.setAttribute("aria-expanded", String(visible));
    });
  });
document.addEventListener("click", (event) => {
  document
    .querySelectorAll<HTMLElement>(
      ".mini-menu.is-visible, .profile-popover.is-visible",
    )
    .forEach((menu) => {
      if (menu.contains(event.target as Node)) return;
      const trigger = document.querySelector<HTMLButtonElement>(
        `[data-popover-trigger="${menu.id}"]`,
      );
      if (trigger?.contains(event.target as Node)) return;
      menu.classList.remove("is-visible");
      trigger?.setAttribute("aria-expanded", "false");
    });
});

// Modal, drawer and command palette -----------------------------------------
const overlayScrim = document.querySelector<HTMLElement>("#overlayScrim");
const dialog = document.querySelector<HTMLElement>("#demoDialog");
const drawer = document.querySelector<HTMLElement>("#demoDrawer");
const commandPalette = document.querySelector<HTMLElement>("#commandPalette");
const commandInput = document.querySelector<HTMLInputElement>("#commandInput");
let lastFocused: HTMLElement | null = null;
let drawerCloseTimer = 0;

function openLayer(layer: "dialog" | "drawer" | "command") {
  lastFocused = document.activeElement as HTMLElement;
  overlayScrim?.classList.add("is-visible");
  document.body.style.overflow = "hidden";
  if (layer === "dialog" && dialog) {
    dialog.hidden = false;
    dialog.querySelector<HTMLElement>("button")?.focus();
  }
  if (layer === "drawer" && drawer) {
    window.clearTimeout(drawerCloseTimer);
    drawer.hidden = false;
    window.requestAnimationFrame(() => {
      drawer.classList.add("is-visible");
      drawer.querySelector<HTMLElement>("button")?.focus();
    });
  }
  if (layer === "command" && commandPalette) {
    commandPalette.hidden = false;
    commandInput?.focus();
  }
}

function closeLayers() {
  overlayScrim?.classList.remove("is-visible");
  if (dialog) dialog.hidden = true;
  drawer?.classList.remove("is-visible");
  drawerCloseTimer = window.setTimeout(() => {
    if (drawer && !drawer.classList.contains("is-visible"))
      drawer.hidden = true;
  }, 260);
  if (commandPalette) commandPalette.hidden = true;
  document.body.style.overflow = "";
  lastFocused?.focus();
}

document
  .querySelector("#modalTrigger")
  ?.addEventListener("click", () => openLayer("dialog"));
document
  .querySelector("#drawerTrigger")
  ?.addEventListener("click", () => openLayer("drawer"));
document
  .querySelectorAll("#commandTrigger, #commandRow, #commandLaunch")
  .forEach((button) =>
    button.addEventListener("click", () => openLayer("command")),
  );
document
  .querySelectorAll("[data-close-overlay]")
  .forEach((button) => button.addEventListener("click", closeLayers));
overlayScrim?.addEventListener("click", closeLayers);
document.querySelector("#publishConfirm")?.addEventListener("click", () => {
  closeLayers();
  showToast("Workspace published", "All 24 members can now see the update.");
});
document.querySelector("#commandTheme")?.addEventListener("click", () => {
  setTheme(root.dataset.theme === "dark" ? "light" : "dark");
  closeLayers();
});

const commandButtons = [
  ...document.querySelectorAll<HTMLButtonElement>("#commandResults > button"),
];
commandButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.target;
    if (target) document.querySelector(`#${target}`)?.scrollIntoView();
    closeLayers();
  });
});
commandInput?.addEventListener("input", () => {
  const query = commandInput.value.toLocaleLowerCase();
  commandButtons.forEach((button) =>
    button.classList.toggle(
      "is-search-hidden",
      !button.textContent?.toLocaleLowerCase().includes(query),
    ),
  );
});

document.addEventListener("keydown", (event) => {
  const target = event.target as HTMLElement;
  const isTyping = target.matches(
    "input, textarea, select, [contenteditable='true']",
  );
  if (
    (event.metaKey || event.ctrlKey) &&
    event.key.toLocaleLowerCase() === "k"
  ) {
    event.preventDefault();
    openLayer("command");
  }
  if (event.key === "/" && !isTyping) {
    event.preventDefault();
    componentFilter?.focus();
  }
  if (event.key === "Escape") {
    setMenu(false);
    closeLayers();
  }
});
