/* Rendered UI context shared by the extension and regression harnesses.
 * Offscreen content is included; hidden templates, closed panels and SVG paths are not.
 * Page classification uses DOM evidence only, never a hostname allowlist.
 */
(() => {
  const B = (globalThis.BAMTI ||= {});
  const tr = B.I18N.t;
  const SKIP = /^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT|HEAD|META|LINK)$/i;
  B.prepareContext = function prepareContext(input) {
    if (input._prepared) return input;
    const doc = input.doc;
    const win = doc.defaultView;
    const styles = new WeakMap();
    const cs = el => {
      if (!styles.has(el)) styles.set(el, win.getComputedStyle(el));
      return styles.get(el);
    };
    const els = [], chunks = [], stack = doc.body ? [doc.body] : [];
    let visited = 0, hiddenRoots = 0;
    while (stack.length && els.length < 6000 && visited < 30000) {
      const el = stack.pop();
      if (el.nodeType === 3) {
        const parentStyle = cs(el.parentElement || el.getRootNode().host);
        if (parentStyle.visibility !== 'hidden' && parentStyle.visibility !== 'collapse') chunks.push(el.textContent);
        continue;
      }
      if (el.nodeType !== 1) continue;
      visited++;
      if (SKIP.test(el.tagName) || el.id?.startsWith('bamti-overlay-')) continue;
      const s = cs(el);
      if (s.display === 'none' || s.contentVisibility === 'hidden' || Number(s.opacity) === 0 || el.hasAttribute('inert')) {
        hiddenRoots++;
        continue;
      }
      const r = el.getBoundingClientRect();
      if (s.visibility !== 'hidden' && s.visibility !== 'collapse' && r.width > 0 && r.height > 0) els.push(el);
      if (el.tagName.toLowerCase() === 'svg') continue;
      if (/^(P|DIV|SECTION|ARTICLE|H[1-6]|LI|BUTTON|A)$/.test(el.tagName)) chunks.push('\n');
      const children = el.shadowRoot ? el.shadowRoot.childNodes : el.childNodes;
      // Closed <details> content is not rendered even if descendants have style declarations.
      const kids = el.tagName === 'DETAILS' && !el.open ? [...children].filter(c => c.tagName === 'SUMMARY') : [...children];
      for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
    }
    const query = selector => els.filter(el => el.matches(selector));
    const rawText = chunks.join('');
    const headings = query('h2,h3').map(h => h.textContent.trim().toLowerCase());
    const marketingGroups = [
      /^(features|our features|기능|주요 기능|핵심 기능)(\b|\s|$)/i,
      /^(pricing|plans|요금|요금제|가격)(\b|\s|$)/i,
      /^(faq|frequently asked|자주 묻는)/i,
      /^(testimonials|reviews|후기|고객 후기)/i,
      /^(how it works|작동 방식|이용 방법)/i,
    ];
    const marketing = marketingGroups.filter(re => headings.some(t => re.test(t))).length;
    const fields = query('input:not([type="hidden"]):not([type="submit"]):not([type="button"]),select,textarea').length;
    const buttons = query('button,[role="button"]').length;
    const search = query('[role="search"],input[type="search"],[role="combobox"]').length;
    const widgets = query('[role="tablist"],[role="grid"],[role="feed"],[role="application"],video').length;
    const customElements = els.filter(el => el.tagName.includes('-')).length;
    const landing = query('h1').length > 0 && marketing >= 2;
    const application = !landing && (((fields >= 2 || search > 0) && buttons >= 3 && headings.length <= 4)
      || (widgets > 0 && buttons >= 3 && headings.length <= 4)
      || (customElements >= 20 && search > 0 && buttons >= 3));
    const pageType = landing
      ? { key: 'landing', label: tr('소개·랜딩 페이지'), reason: tr`마케팅 섹션 ${marketing}종` }
      : application
        ? { key: 'application', label: tr('서비스·도구 화면'), reason: tr`입력 ${fields}개 · 버튼 ${buttons}개` }
        : { key: 'general', label: tr('일반 페이지'), reason: tr('특정 화면 유형의 근거 부족') };
    const truncated = stack.length ? visited + stack.length : 0;
    return { ...input, _prepared: true, doc, els, cs, query, rawText,
      text: rawText.toLowerCase(), title: doc.title,
      svgs: query('svg'), pageType, hiddenRoots, truncated, domSize: els.length,
      sampleLimited: !!stack.length,
    };
  };
})();
