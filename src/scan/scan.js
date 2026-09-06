/* 밤티 — 페이지 스캐너 + 오버레이 (activeTab / 허용 출처에 주입됨)
 * 재주입 시 리스너가 중복되지 않도록 가드한다.
 * 오버레이는 페이지 요소에 클래스를 붙이지 않고 별도 레이어에 상자를 그린다 —
 * 페이지 CSS와 충돌하지 않고, img/svg 같은 ::after 불가 요소에도 라벨을 붙일 수 있다.
 */
(() => {
  const B = (globalThis.BAMTI ||= {});
  // 재스캔마다 재주입되므로 기존 레이어와 리스너를 먼저 해제한다.
  B.dispose?.();
  B._nodes = new Map();

  /* ── 스캔 컨텍스트: 비싼 연산은 여기서 한 번만 ─────────────── */
  function buildCtx() {
    const cache = new WeakMap();
    const cs = el => { let v = cache.get(el); if (!v) { v = getComputedStyle(el); cache.set(el, v); } return v; };
    const all = [...document.body.querySelectorAll('*')].filter(el => !el.closest('#' + LAYER_ID));
    const els = all.length > 6000 ? all.slice(0, 6000) : all;
    const rawText = document.body.innerText || '';
    return { doc: document, els, cs, svgs: [...document.querySelectorAll('svg')].filter(s => !s.closest('#' + LAYER_ID)),
             rawText, text: rawText.toLowerCase(), title: document.title, truncated: all.length > 6000 ? all.length : 0 };
  }

  B.scan = function scan() {
    clearHighlights();
    B._nodes.clear();
    const t0 = performance.now();
    const ctx = buildCtx();
    const report = B.run(ctx);
    report.ms = Math.round(performance.now() - t0);
    report.domSize = ctx.els.length;
    report.truncated = ctx.truncated;
    return report;
  };

  /* ── 오버레이 레이어 ──────────────────────────────────────── */
  const LAYER_ID = 'bamti-overlay-' + Math.random().toString(36).slice(2, 7);
  const CAT_COLOR = { unfinished: '#e11d48', visual: '#7c3aed', structure: '#d97706', toolchain: '#0891b2', taste: '#71717a' };
  let layer = null, boxes = [], raf = 0, wired = false;

  function ensureLayer() {
    if (layer && layer.isConnected) return layer;
    layer = document.createElement('div');
    layer.id = LAYER_ID;
    layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483646;font:11px/1.3 ui-sans-serif,-apple-system,sans-serif;';
    document.documentElement.appendChild(layer);
    if (!wired) {   // 레이어가 재생성되어도 리스너는 한 번만
      wired = true;
      addEventListener('scroll', schedule, { capture: true, passive: true });
      addEventListener('resize', schedule, { passive: true });
    }
    return layer;
  }
  function schedule() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; try { draw(); } catch (e) { console.warn('[밤티] overlay draw', e); } }); }

  function draw() {
    if (!layer || !boxes.length) return;
    const vw = innerWidth || 4000, vh = innerHeight || 4000;   // 숨김 탭(0×0)에서는 컬링하지 않는다
    for (const b of boxes) {
      if (!b.el.isConnected) { b.div.style.display = 'none'; continue; }
      const r = b.el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.bottom < -40 || r.top > vh + 40 || r.right < 0 || r.left > vw) { b.div.style.display = 'none'; continue; }
      b.div.style.display = 'block';
      b.div.style.transform = `translate(${r.left}px, ${r.top}px)`;
      b.div.style.width = r.width + 'px';
      b.div.style.height = r.height + 'px';
      // 라벨이 화면 위로 나가면 상자 안쪽으로
      b.tag.style.top = r.top < 18 ? '0' : '-17px';
    }
  }

  function clearHighlights() {
    boxes = [];
    if (layer) layer.replaceChildren();
  }

  /* items: [{ id, label, cat, weight }] — 요소마다 가장 가중치 높은 시그널 하나만 라벨로 */
  function highlightAll(items, limit = 80) {
    ensureLayer(); clearHighlights();
    const best = new Map();                      // el → item
    for (const it of [...items].sort((a, b) => b.weight - a.weight)) {
      for (const el of (B._nodes.get(it.id) || [])) {
        if (!best.has(el)) best.set(el, it);
        if (best.size >= limit) break;
      }
      if (best.size >= limit) break;
    }
    for (const [el, it] of best) addBox(el, it, false);
    draw();
    return best.size;
  }

  function highlight(signalId, meta) {
    ensureLayer(); clearHighlights();
    const nodes = B._nodes.get(signalId) || [];
    nodes.forEach((el, i) => addBox(el, meta || { id: signalId, label: signalId, cat: 'visual' }, i === 0));
    draw();
    const first = nodes.find(el => el.isConnected);
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return nodes.length;
  }

  function addBox(el, it, lead) {
    const color = CAT_COLOR[it.cat] || CAT_COLOR.visual;
    const div = document.createElement('div');
    div.style.cssText = `position:absolute;left:0;top:0;box-sizing:border-box;border:2px ${lead ? 'solid' : 'solid'} ${color};` +
                        `border-radius:3px;background:${color}14;will-change:transform;`;
    const tag = document.createElement('span');
    tag.textContent = it.label;
    tag.style.cssText = `position:absolute;left:-2px;top:-17px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;` +
                        `padding:1px 6px;border-radius:3px 3px 3px 0;background:${color};color:#fff;font-weight:600;letter-spacing:0;`;
    div.appendChild(tag);
    layer.appendChild(div);
    boxes.push({ el, div, tag });
  }

  B.highlightAll = highlightAll; B.highlight = highlight; B.clearHighlights = clearHighlights;
  B.dispose = () => {
    cancelAnimationFrame(raf);
    removeEventListener('scroll', schedule, true);
    removeEventListener('resize', schedule);
    layer?.remove();
    boxes = [];
  };

  /* ── 메시지 라우팅 (중복 등록 가드, 하네스에서는 chrome 없음) ── */
  if (!B._wired && globalThis.chrome?.runtime?.onMessage) {
    B._wired = true;
    chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
      if (msg?.type === 'bamti:scan')          { respond({ ok: true, report: B.scan() }); return true; }
      if (msg?.type === 'bamti:highlight-all') { respond({ ok: true, n: B.highlightAll(msg.items || []) }); return true; }
      if (msg?.type === 'bamti:highlight')     { respond({ ok: true, n: B.highlight(msg.signalId, msg.meta) }); return true; }
      if (msg?.type === 'bamti:clear')         { B.clearHighlights(); respond({ ok: true }); return true; }
      if (msg?.type === 'bamti:ping')          { respond({ ok: true }); return true; }
      return false;
    });
  }
})();
