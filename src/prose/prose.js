/* Local writing-style lint, not an authorship classifier.
 * im-not-ai taxonomy/metrics subset + slop-gate vocabulary matcher.
 * Browser extraction and conservative gates are Bamti adaptations.
 * See THIRD_PARTY_NOTICES.md and src/prose/README.md for exact provenance.
 */
(() => {
  const B = (globalThis.BAMTI ||= {});
  const tr = B.I18N.t;
  const KO_SOURCE = { name: 'im-not-ai', revision: '31a66d165a9cc6c26c4c1246553f95d0468d27fb', url: 'https://github.com/epoko77-ai/im-not-ai' };
  const EN_SOURCE = { name: 'slop-gate', revision: 'cae0ef32cdf2de03cd636642bfa5deb30a5051dd', url: 'https://github.com/hwajongpark/slop-gate' };
  const LIMITS = { blocks: 300, characters: 60000, blockCharacters: 6000, examples: 8 };
  const excluded = 'h1,h2,h3,h4,h5,h6,nav,header,footer,aside,button,input,textarea,select,option,pre,code,kbd,samp,blockquote,q,cite,math,script,style,template,noscript,[role="navigation"],[role="button"],[role="menu"],[role="listbox"],[role="feed"],[aria-hidden="true"],[inert],[contenteditable]:not([contenteditable="false"])';
  const block = 'p,li,div,article,section,main,td,dd,figcaption,[role="paragraph"]';
  // Replace excluded spans with equal-length spaces: offsets always refer to original text.
  const mask = text => text.replace(/"[^"\n]*"|“[^”\n]*”|「[^」\n]*」|`[^`\n]*`|https?:\/\/[^\s]+/g, s => ' '.repeat(s.length));
  const sentences = text => text.trim().split(/(?<=[.!?。])\s+|\n/).filter(s => s.trim());
  function matches(text, re, ruleId) {
    re.lastIndex = 0;
    return [...text.matchAll(re)].map(m => ({ text: m[0], start: m.index, end: m.index + m[0].length, ruleId }));
  }

  // Direct JS port of the three comma metrics from im-not-ai metrics.py.
  // Its proxy z-scores, genre baselines and author-risk bands are intentionally NOT used.
  function koreanMetrics(text) {
    const s = sentences(text);
    const endings = matches(text, /(?:고|며|지만|면서|아서|어서)(?=[\s,.!?、。]|$)/g, 'C-11');
    const commas = matches(text, /(?:고|며|지만|면서|아서|어서)\s*,/g, 'C-11');
    return { commaInclusionRate: s.length ? s.filter(x => x.includes(',')).length / s.length : 0,
      commaUsageRate: s.length ? (text.match(/,/g) || []).length / s.length : 0,
      endingCommaRate: endings.length ? commas.length / endings.length : 0 };
  }

  // Pattern IDs and repetition thresholds follow quick-rules.md unless noted in README.
  const KO_RULES = [
    ['A-1', /에 대해(?:서)?/g, 3, '“~에 대해” 반복', '반복된 “~에 대해” 일부를 목적격 조사로 연결해보세요. 한두 번 쓴 표현은 그대로 두어도 됩니다.'],
    ['A-2', /[를을] 통(?:해|하여)/g, 3, '“~를 통해” 반복', '반복된 “~를 통해” 일부를 “~로”나 구체적인 행동으로 풀어보세요.'],
    ['A-3', /에 있어(?:서)?/g, 2, '“~에 있어서” 반복', '“~에서” 또는 “~을 볼 때”로 줄여도 의미가 유지되는지 확인하세요.'],
    ['A-4', /라는 점에서/g, 3, '“~라는 점에서” 반복', '반복된 연결구 일부를 “~라는 이유로” 또는 직접적인 설명으로 바꿔보세요.'],
    ['A-8', /(?:되어[지진]|지게 된)[가-힣]*/g, 2, '이중 피동 반복', '행위자를 명확히 하거나 피동 표현을 하나만 남겨보세요. 원문의 책임·주체를 바꾸지는 마세요.'],
    ['A-10', /[가-힣]+ 수 있[가-힣]*/g, 4, '가능 표현 반복', '가능성의 강도는 유지하면서 문장 순서나 표현을 바꿔보세요. “할 수 있다”를 사실 단정으로 바꾸지 마세요.'],
    ['A-19', /(?:에서의|에로의|으로의|으로부터의|로부터의|에의)/g, 3, '겹조사 밀집', '겹조사를 줄이거나 절로 풀어 관계를 명확히 해보세요.'],
    ['C-8', /(?:것이 아니라|것은 아니다|[가-힣]+가 아니라|[가-힣]+이 아니라)/g, 2, '“A가 아니라 B” 대구 반복', '가장 효과적인 대구 하나는 남기고 나머지는 비대칭 문장으로 풀어보세요.'],
    ['C-11', /(?:고|며|지만|면서|아서|어서)\s*,/g, 6, '연결어미 뒤 쉼표 밀집', '연결어미 뒤 쉼표 중 호흡에 불필요한 것만 덜어보세요. 쉼표 습관만으로 작성자를 판단하지 않습니다.'],
    ['D-1', /결론적으로|따라서|이를 통해|그러므로|요약하면|정리하자면/g, 4, '결산·요약 표현 반복', '결산 표현을 한두 번만 남기고 나머지는 실제 결론부터 시작해보세요.'],
    ['D-4', /혁신적|획기적|압도적|파격적|폭발적|전례 없는/g, 3, '과장 수식어 밀집', '과장 수식어 대신 확인 가능한 기능·수치·사례를 적어보세요. 없는 근거를 만들지는 마세요.'],
    ['G-2', /가능성이 있을 수 있[가-힣]*|보여질 수 있[가-힣]*/g, 2, '완곡 표현 중첩', '중첩된 완곡 표현을 정리하되 가능성·부정·조건의 의미는 유지하세요.'],
    ['H-1', /(?:^|(?<=[.!?。])\s+)(?:또한|따라서|즉|나아가|아울러|게다가|더욱이)(?=[\s,])/g, 3, '문두 접속사 밀집', '문장 관계가 분명한 곳의 접속사만 일부 덜어보세요. 접속사 자체는 정상적인 표현입니다.'],
  ];
  const englishRules = B.EN_PROSE_PACK.rules.map(rule => ({ ...rule, re: new RegExp(rule.match, 'gi') }));
  const ambiguousEnglish = new Set(['leverage', 'robust', 'unlock', 'harness', 'proactive', 'crucial', 'pivotal', 'vibrant', 'meticulous', 'realm', 'delve']);

  function analyzeBlock(raw) {
    const text = mask(raw);
    if (text.trim().length < 80) return { languages: [], findings: [] };
    const languages = [], findings = [];
    if ((text.match(/[가-힣]/g) || []).length >= 30) {
      languages.push('ko');
      for (const [id, re, min, label, hint] of KO_RULES) {
        const hits = matches(text, re, id);
        if (hits.length >= min) findings.push({ id: 'prose-ko-' + id, language: 'ko', label: tr(label), hint: tr(hint), source: KO_SOURCE, matches: hits });
      }
    }
    if ((text.match(/\b[A-Za-z]{2,}\b/g) || []).length >= 12) {
      languages.push('en');
      // Upstream's reset-lastIndex + matchAll matcher; retain IDs and exact regexes.
      const hits = englishRules.flatMap(r => matches(text, r.re, r.id)).sort((a, b) => a.start - b.start || b.end - a.end);
      const unique = [];
      // "in the realm of" and "realm" are one occurrence, not independent evidence.
      for (const h of hits) if (!unique.some(x => h.start < x.end && h.end > x.start)) unique.push(h);
      const words = (text.match(/\b[A-Za-z]+\b/g) || []).length;
      // A single normal word or an em dash never triggers a writing finding.
      const specificKinds = new Set(unique.filter(h => !ambiguousEnglish.has(h.ruleId)).map(h => h.ruleId)).size;
      if (unique.length >= 4 && new Set(unique.map(h => h.ruleId)).size >= 3 && specificKinds >= 2 && unique.length / words >= 0.025) {
        findings.push({ id: 'prose-en-vocabulary', language: 'en', label: tr('영어 상투 표현 밀집'),
          hint: tr('일반적인 수식어·상투적 도입이 한 문단에 겹칩니다. 제품이 실제로 하는 일과 구체적인 근거로 바꿔보세요. 기술 용어는 문맥을 확인한 뒤 유지하세요.'),
          source: EN_SOURCE, matches: unique });
      }
    }
    return { languages, findings, metrics: languages.includes('ko') ? koreanMetrics(text) : undefined };
  }

  function extract(ctx) {
    const visible = new Set(ctx.els), map = new Map();
    let chars = 0, visited = 0, limited = false;
    const stack = ctx.doc.body ? [{ node: ctx.doc.body, owner: ctx.doc.body }] : [];
    while (stack.length && visited++ < 30000) {
      const { node, owner } = stack.pop();
      if (node.nodeType === 3) {
        const value = node.textContent;
        if (!value.trim() && !map.has(owner)) continue;
        if (!map.has(owner)) {
          if (map.size >= LIMITS.blocks) { limited = true; continue; }
          map.set(owner, '');
        }
        const old = map.get(owner), room = Math.min(LIMITS.blockCharacters - old.length, LIMITS.characters - chars);
        if (value.length > room) limited = true;
        const added = value.slice(0, Math.max(0, room));
        map.set(owner, old + added); chars += added.length;
        if (chars >= LIMITS.characters) { limited = true; break; }
        continue;
      }
      if (node.nodeType !== 1 || node.matches(excluded) || node.id?.startsWith('bamti-overlay-')) continue;
      // Standalone linked labels are navigation/card titles; inline prose links are kept.
      if (node.tagName === 'A' && !node.closest('p,li,dd,figcaption,[role="paragraph"]')) continue;
      const style = ctx.cs(node);
      if (style.display === 'none' || style.contentVisibility === 'hidden' || Number(style.opacity) === 0) continue;
      // Hidden containers may explicitly reveal a child; only their text is excluded.
      const own = node.matches(block) ? node : owner;
      const kids = node.tagName === 'DETAILS' && !node.open ? [...node.children].filter(n => n.tagName === 'SUMMARY') : [...(node.shadowRoot?.childNodes || node.childNodes)];
      for (let i = kids.length - 1; i >= 0; i--) {
        if (kids[i].nodeType === 3 && (!visible.has(node) || style.visibility !== 'visible')) continue;
        stack.push({ node: kids[i], owner: own });
      }
    }
    return { blocks: [...map].map(([node, text]) => ({ node, text: text.trim() })).filter(x => x.text), limited: limited || stack.length > 0 || !!ctx.truncated };
  }

  B.PROSE = { analyzeBlock, koreanMetrics, limits: LIMITS, sources: [KO_SOURCE, EN_SOURCE] };
  B.scanProse = function(ctx) {
    const extracted = extract(ctx), found = new Map(), languages = new Set();
    let inspected = 0, characters = 0;
    for (const { node, text } of extracted.blocks) {
      const result = analyzeBlock(text);
      if (!result.languages.length) continue;
      inspected++; characters += text.length;
      result.languages.forEach(l => languages.add(l));
      for (const f of result.findings) {
        if (!found.has(f.id)) found.set(f.id, { ...f, matches: undefined, nodes: [], examples: [], occurrences: 0 });
        const item = found.get(f.id);
        item.nodes.push(node); item.occurrences += f.matches.length;
        for (const hit of f.matches.slice(0, LIMITS.examples - item.examples.length)) {
          item.examples.push({ ...hit, block: inspected, excerpt: text.slice(Math.max(0, hit.start - 45), Math.min(text.length, hit.end + 65)) });
        }
      }
    }
    const signals = [...found.values()].map(({ nodes, ...f }) => {
      B._nodes.set(f.id, nodes);
      return { ...f, cat: 'prose', kind: 'prose', scope: 'element', weight: 0, count: nodes.length,
        evidence: tr`${f.language.toUpperCase()} · ${f.occurrences}회 · ${nodes.length}개 문단` + ' · ' + [...new Set(f.examples.map(x => x.text))].slice(0, 4).map(x => `“${x}”`).join(', '),
        targets: nodes.slice(0, B.TARGET_CAP).map(el => B.describe(el, ctx.doc)) };
    });
    return { version: 1, status: inspected ? 'checked' : 'insufficient', languages: [...languages], inspectedBlocks: inspected,
      characters, limited: extracted.limited, signals, sources: [KO_SOURCE, EN_SOURCE],
      note: tr('읽을 수 있는 한·영 본문만 로컬 검사합니다. 메뉴·입력창·코드·인용은 제외하며, UI 점수와 AI 작성 확률에 반영하지 않습니다.') };
  };
})();
