function get(sel) {
  return document.querySelector(sel);
}
function on(sel, event, fn) {
  const el = get(sel);
  if (el) el.addEventListener(event, (e) => fn(el, e));
}
on("#loadingBtn", "click", (btn) => {
  btn.classList.add("loading");
  btn.textContent = "Loading...";
  setTimeout(() => {
    btn.classList.remove("loading");
    btn.textContent = "Done \u2713";
    setTimeout(() => {
      btn.textContent = "Click to Load";
    }, 1500);
  }, 2e3);
});
on("#toastBtn", "click", () => {
  const container = get("#toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = "\u{1F514} This is a toast notification!";
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3e3);
});
const modal = get("#modalOverlay");
["#modalBtn"].forEach((s) => on(s, "click", () => modal?.classList.remove("hidden")));
["#modalClose", "#modalCancel", "#modalConfirm"].forEach(
  (s) => on(s, "click", () => modal?.classList.add("hidden"))
);
modal?.addEventListener("click", (e) => {
  if (e.target === modal) modal.classList.add("hidden");
});
on("#dropdownBtn", "click", () => {
  get("#dropdownMenu")?.classList.toggle("hidden");
});
document.querySelectorAll("#tabsDemo .tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll("#tabsDemo .tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.add("hidden"));
    const target = tab.dataset["tab"];
    if (target) get("#" + target)?.classList.remove("hidden");
  });
});
document.querySelectorAll(".accordion-header").forEach((btn) => {
  btn.addEventListener("click", () => {
    const id = btn.dataset["accordion"];
    if (id) get("#" + id)?.classList.toggle("hidden");
  });
});
const step = (delta) => {
  const input = get("#stepValue");
  if (input) input.value = String(Number(input.value) + delta);
};
on("#stepUp", "click", () => step(1));
on("#stepDown", "click", () => step(-1));
