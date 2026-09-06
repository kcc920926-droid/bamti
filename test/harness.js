/* 밤티 테스트 하네스 — 브라우저 콘솔/CDP에서 __bamti() 호출 */
(async () => {
  const load = src => new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error('load ' + src));
    document.head.append(s);
  });
  const v = '?v=' + (globalThis.__bamtiV || (globalThis.__bamtiV = String(performance.timeOrigin | 0)));
  if (!globalThis.BAMTI?.SIGNALS) {
    await load('/src/core/signals.js' + v);
    await load('/src/core/score.js' + v);
  }
  globalThis.__bamti = () => {
    const B = globalThis.BAMTI;
    B._nodes = new Map();
    const cache = new WeakMap();
    const cs = el => { let v = cache.get(el); if (!v) { v = getComputedStyle(el); cache.set(el, v); } return v; };
    const all = [...document.body.querySelectorAll('*')].slice(0, 6000);
    const rawText = document.body.innerText || '';
    const r = B.run({ doc: document, els: all, cs, svgs: [...document.querySelectorAll('svg')],
                      rawText, text: rawText.toLowerCase(), title: document.title, truncated: 0 });
    return { score: r.score, band: r.bandLabel, tells: `${r.firedCount}/${r.totalSignals}`,
             errors: r.errors, dom: all.length,
             hit: r.signals.map(s => `[${s.weight}] ${s.label} — ${s.evidence}`),
             taste: (r.taste || []).map(s => `${s.label} — ${s.evidence}`) };
  };
  globalThis.__bamtiReady = true;
})();
