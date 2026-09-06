function get<T extends Element>(sel: string): T | null {
  return document.querySelector<T>(sel);
}

function on<T extends Element>(sel: string, event: string, fn: (el: T, e: Event) => void): void {
  const el = get<T>(sel);
  if (el) el.addEventListener(event, (e) => fn(el, e));
}

on<HTMLButtonElement>("#loadingBtn", "click", (btn) => {
  btn.classList.add("loading");
  btn.textContent = "Loading...";
  setTimeout(() => {
    btn.classList.remove("loading");
    btn.textContent = "Done ✓";
    setTimeout(() => { btn.textContent = "Click to Load"; }, 1500);
  }, 2000);
});

on<HTMLButtonElement>("#toastBtn", "click", () => {
  const container = get("#toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = "🔔 This is a toast notification!";
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
});

const modal = get<HTMLElement>("#modalOverlay");
["#modalBtn"].forEach((s) => on(s, "click", () => modal?.classList.remove("hidden")));
["#modalClose", "#modalCancel", "#modalConfirm"].forEach((s) =>
  on(s, "click", () => modal?.classList.add("hidden"))
);
modal?.addEventListener("click", (e) => {
  if (e.target === modal) modal.classList.add("hidden");
});

on<HTMLButtonElement>("#dropdownBtn", "click", () => {
  get("#dropdownMenu")?.classList.toggle("hidden");
});

document.querySelectorAll<HTMLButtonElement>("#tabsDemo .tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll("#tabsDemo .tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    document.querySelectorAll<HTMLElement>(".tab-panel").forEach((p) => p.classList.add("hidden"));
    const target = tab.dataset["tab"];
    if (target) get<HTMLElement>("#" + target)?.classList.remove("hidden");
  });
});

document.querySelectorAll<HTMLButtonElement>(".accordion-header").forEach((btn) => {
  btn.addEventListener("click", () => {
    const id = btn.dataset["accordion"];
    if (id) get<HTMLElement>("#" + id)?.classList.toggle("hidden");
  });
});

const step = (delta: number) => {
  const input = get<HTMLInputElement>("#stepValue");
  if (input) input.value = String(Number(input.value) + delta);
};
on("#stepUp", "click", () => step(1));
on("#stepDown", "click", () => step(-1));
