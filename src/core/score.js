/* 밤티 — 스코어링
 * 발화한 시그널의 가중치 합 / 전체 가중치 합 → 0~100
 * 판정은 단정하지 않는다. "AI가 썼다"가 아니라 "지문 N개 발견".
 */
(() => {
  const B = (globalThis.BAMTI ||= {});
  const tr = B.I18N.t;

  const BANDS = [
    { min: 50, key: 'heavy',  get label() { return tr('많이 티남'); },   get line() { return tr('여러 UI 패턴이 겹칩니다. 미완성 흔적부터 검토해보세요.'); } },
    { min: 30, key: 'clear',  get label() { return tr('티남'); },        get line() { return tr('몇 군데만 손보면 인상이 크게 달라집니다.'); } },
    { min: 15, key: 'faint',  get label() { return tr('약간 티남'); },   get line() { return tr('대체로 괜찮고, 자잘한 흔적이 남아있습니다.'); } },
    { min: 0,  key: 'clean',  get label() { return tr('깨끗함'); },      get line() { return tr('발견된 패턴이 적습니다. 실제 동작도 함께 확인해주세요.'); } },
  ];

  /* ── 요소 설명 — 에이전트가 소스에서 찾아 고칠 수 있게 셀렉터·텍스트·HTML 조각을 만든다 ── */
  const esc = s => (globalThis.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/[^\w-]/g, '\\$&');
  const idOk = id => !!id && /^[A-Za-z][\w-]*$/.test(id);
  function cssPath(el, doc) {
    const uniq = sel => { try { return doc.querySelectorAll(sel).length === 1; } catch { return false; } };
    if (idOk(el.id) && uniq('#' + esc(el.id))) return { selector: '#' + esc(el.id), unique: true };
    const parts = []; let n = el;
    while (n && n.nodeType === 1 && n !== doc.body && n !== doc.documentElement && parts.length < 8) {
      if (idOk(n.id) && uniq('#' + esc(n.id))) { parts.unshift('#' + esc(n.id)); break; }
      let seg = n.tagName.toLowerCase();
      const cls = [...n.classList].filter(c => /^[A-Za-z_-][\w-]*$/.test(c)).slice(0, 2);
      if (cls.length) seg += '.' + cls.map(esc).join('.');
      const p = n.parentElement;
      if (p) { const same = [...p.children].filter(c => c.tagName === n.tagName); if (same.length > 1) seg += `:nth-of-type(${same.indexOf(n) + 1})`; }
      parts.unshift(seg); n = p;
    }
    const selector = parts.join(' > ');
    return { selector, unique: uniq(selector) };
  }
  B.describe = function describe(el, doc) {
    const win = doc.defaultView || globalThis;
    let r = {}; try { r = el.getBoundingClientRect(); } catch {}
    const { selector, unique } = cssPath(el, doc);
    return {
      selector, unique,
      tag: el.tagName.toLowerCase(),
      id: el.id || undefined,
      class: (el.getAttribute('class') || '').trim().slice(0, 80) || undefined,
      text: ((el.innerText ?? el.textContent) || '').replace(/\s+/g, ' ').trim().slice(0, 100) || undefined,
      html: (el.outerHTML || '').replace(/\s+/g, ' ').slice(0, 260),
      rect: { x: Math.round((r.left || 0) + (win.scrollX || 0)), y: Math.round((r.top || 0) + (win.scrollY || 0)), w: Math.round(r.width || 0), h: Math.round(r.height || 0) },
    };
  };
  B.TARGET_CAP = 12;   // 시그널당 직렬화하는 요소 수 상한 (count 는 실제 개수)

  B.run = function run(ctx) {
    B.I18N.setLocale(ctx.locale || 'ko');
    ctx = B.prepareContext(ctx);
    const fired = [];
    const errors = [];
    const skipped = [];
    const marketingRules = new Set(['everything-centered', 'three-col-feature-grid', 'uniform-section-rhythm',
      'canonical-section-order', 'three-tier-pricing', 'hero-badge-pill', 'fake-social-proof', 'generic-cta-copy',
      'section-template-repeat', 'card-clones', 'cta-banner', 'icon-circle-badges', 'no-real-images', 'zigzag-features', 'glass-panel-overuse']);

    for (const sig of B.SIGNALS) {
      if (ctx.pageType.key === 'application' && marketingRules.has(sig.id)) {
        skipped.push({ id: sig.id, reason: tr('서비스·도구 화면에는 랜딩페이지 구성 규칙을 적용하지 않음') });
        continue;
      }
      let res = null;
      try {
        res = sig.detect(ctx);
      } catch (e) {
        errors.push({ id: sig.id, message: String(e && e.message || e) });
        continue;
      }
      if (!res) continue;
      fired.push({
        id: sig.id, cat: sig.cat, weight: sig.weight,
        kind: sig.kind || 'tell',
        scope: sig.scope || 'element',
        label: res.label || sig.label, hint: sig.hint,
        evidence: res.ev,
        count: res.nodes ? res.nodes.length : 0,
      });
      if (res.nodes && res.nodes.length) {
        B._nodes.set(sig.id, res.nodes);
        try { fired[fired.length - 1].targets = res.nodes.slice(0, B.TARGET_CAP).map(el => B.describe(el, ctx.doc)); }
        catch (e) { errors.push({ id: sig.id, message: 'describe: ' + String(e && e.message || e) }); }
      }
    }

    // 'tell'(AI 지문)만 점수에 넣는다. 'taste'(취향 규칙)는 별도로 뺀다 —
    // 취향 규칙을 점수에 섞으면 취향을 추가할수록 슬롭 점수가 오르는 모순이 생긴다.
    const tells = fired.filter(f => f.kind !== 'taste');
    const taste = fired.filter(f => f.kind === 'taste');

    const allTellSigs = B.SIGNALS.filter(s => (s.kind || 'tell') !== 'taste');
    const tellSigs = allTellSigs.filter(s => !skipped.some(x => x.id === s.id));
    // Skipping unrelated rules must never inflate the same evidence into a higher score.
    const total = allTellSigs.reduce((s, x) => s + x.weight, 0);
    const got   = tells.reduce((s, x) => s + x.weight, 0);
    const score = total ? Math.round((got / total) * 100) : 0;
    const band  = BANDS.find(b => score >= b.min);

    // 카테고리별 집계 — 어디를 먼저 손봐야 하는지
    const byCat = {};
    for (const k of Object.keys(B.CATS)) {
      const items = tells.filter(f => f.cat === k);
      const catTotal = tellSigs.filter(s => s.cat === k).reduce((s, x) => s + x.weight, 0);
      byCat[k] = {
        ...B.CATS[k],
        count: items.length,
        weight: items.reduce((s, x) => s + x.weight, 0),
        pct: catTotal ? Math.round(items.reduce((s, x) => s + x.weight, 0) / catTotal * 100) : 0,
      };
    }

    tells.sort((a, b) => b.weight - a.weight);
    taste.sort((a, b) => b.weight - a.weight);

    let prose;
    try { prose = B.scanProse(ctx); }
    catch (e) {
      errors.push({ id: 'prose', message: String(e?.message || e) });
      prose = { status: 'error', signals: [], languages: [] };
    }

    return {
      locale: B.I18N.locale,
      url: ctx.url || location.href,
      host: ctx.host || location.host,
      title: ctx.doc.title,
      scannedAt: new Date().toISOString(),
      score, band: band.key,
      bandLabel: score < 15 ? tr('검출 근거 적음') : band.label,
      bandLine: score === 0
        ? tr('현재 규칙에서 점수에 반영할 패턴을 찾지 못했습니다. AI 스타일이 없거나 완성도가 높다는 뜻은 아닙니다.')
        : ctx.pageType.key === 'application'
        ? tr('도구 화면은 미완성 흔적 위주로 검사합니다. 낮은 점수로 완성도나 제작 방식을 판단할 수 없습니다.') : band.line,
      firedCount: tells.length, totalSignals: tellSigs.length,
      byCat, signals: tells, taste, prose, errors, skipped,
      pageType: ctx.pageType, domSize: ctx.domSize, truncated: ctx.truncated, hiddenRoots: ctx.hiddenRoots,
      scopeNote: ctx.pageType.key === 'application'
        ? tr`랜딩 구성 규칙 ${skipped.length}개 제외 · AI 제작 여부는 판정하지 않습니다.`
        : tr('렌더링된 UI의 규칙 검사입니다. AI 제작 여부는 판정하지 않습니다.'),
    };
  };
})();
