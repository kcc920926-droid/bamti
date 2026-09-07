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
  const LIMITS = { blocks: 300, characters: 60000, blockCharacters: 6000, examples: 8, windowBlocks: 5, windowCharacters: 2400 };
  const excluded = 'h1,h2,h3,h4,h5,h6,nav,header,footer,aside,button,input,textarea,select,option,pre,code,kbd,samp,blockquote,q,cite,math,script,style,template,noscript,[role="navigation"],[role="button"],[role="menu"],[role="listbox"],[role="feed"],[aria-hidden="true"],[inert],[contenteditable]:not([contenteditable="false"])';
  const block = 'p,li,div,article,section,main,td,dd,figcaption,[role="paragraph"]';
  const fragmentExcluded = 'nav,footer,input,textarea,select,option,pre,code,kbd,samp,blockquote,q,cite,math,script,style,template,noscript,[role="navigation"],[role="menu"],[role="listbox"],[role="feed"],[aria-hidden="true"],[inert],[contenteditable]:not([contenteditable="false"])';
  const fragmentBlock = block + ',h1,h2,h3,h4,h5,h6,a,button,[role="button"]';
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

  const koreanMinimum = new Map(KO_RULES.map(([id, , min]) => ['prose-ko-' + id, min]));
  function qualifies(f, stats) {
    if (f.language === 'ko') return f.matches.length >= koreanMinimum.get(f.id);
    const kinds = new Set(f.matches.map(h => h.ruleId));
    const specific = new Set(f.matches.filter(h => !ambiguousEnglish.has(h.ruleId)).map(h => h.ruleId));
    return f.matches.length >= 4 && kinds.size >= 3 && specific.size >= 2 && f.matches.length / stats.words >= .025;
  }

  // Collect matches before applying repetition thresholds, so neighboring
  // paragraphs can contribute without inventing cross-boundary phrases.
  function collect(raw, short = false) {
    const text = mask(raw);
    const stats = { hangul: (text.match(/[가-힣]/g) || []).length, words: (text.match(/\b[A-Za-z]+\b/g) || []).length };
    if (text.trim().length < (short ? 24 : 80)) return { languages: [], findings: [], stats };
    const languages = [], findings = [];
    if (stats.hangul >= (short ? 10 : 30)) {
      languages.push('ko');
      for (const [id, re, , label, hint] of KO_RULES) {
        const hits = matches(text, re, id);
        if (hits.length) findings.push({ id: 'prose-ko-' + id, language: 'ko', label: tr(label), hint: tr(hint), source: KO_SOURCE, matches: hits });
      }
    }
    if ((text.match(/\b[A-Za-z]{2,}\b/g) || []).length >= (short ? 5 : 12)) {
      languages.push('en');
      // Upstream's reset-lastIndex + matchAll matcher; retain IDs and exact regexes.
      const hits = englishRules.flatMap(r => matches(text, r.re, r.id)).sort((a, b) => a.start - b.start || b.end - a.end);
      const unique = [];
      // "in the realm of" and "realm" are one occurrence, not independent evidence.
      for (const h of hits) if (!unique.some(x => h.start < x.end && h.end > x.start)) unique.push(h);
      if (unique.length) {
        findings.push({ id: 'prose-en-vocabulary', language: 'en', label: tr('영어 상투 표현 밀집'),
          hint: tr('본문 문단에 일반적인 수식어·상투적 도입이 반복됩니다. 제품이 실제로 하는 일과 구체적인 근거로 바꿔보세요. 기술 용어는 문맥을 확인한 뒤 유지하세요.'),
          source: EN_SOURCE, matches: unique });
      }
    }
    return { languages, findings, stats, metrics: languages.includes('ko') ? koreanMetrics(text) : undefined };
  }
  function analyzeBlock(raw) {
    const result = collect(raw);
    return { ...result, findings: result.findings.filter(f => qualifies(f, result.stats)) };
  }

  function extract(ctx, fragments = false) {
    const visible = new Set(ctx.els), map = new Map();
    const pieces = [];
    let activePiece = null;
    let chars = 0, visited = 0, limited = false;
    const stack = ctx.doc.body ? [{ node: ctx.doc.body, owner: ctx.doc.body }] : [];
    while (stack.length && visited++ < 30000) {
      const { node, owner, linked = false } = stack.pop();
      if (node.nodeType === 3) {
        if (linked) continue;
        const value = node.textContent;
        if (fragments) {
          if (!value.trim() && activePiece?.node !== owner) continue;
          if (activePiece?.node !== owner) {
            if (pieces.length >= LIMITS.blocks) { limited = true; continue; }
            activePiece = { node: owner, text: '' }; pieces.push(activePiece);
          }
          const room = Math.min(LIMITS.blockCharacters - activePiece.text.length, LIMITS.characters - chars);
          if (value.length > room) limited = true;
          const added = value.slice(0, Math.max(0, room));
          activePiece.text += added; chars += added.length;
          if (chars >= LIMITS.characters) { limited = true; break; }
          continue;
        }
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
      if (node.nodeType !== 1 || node.matches(fragments ? fragmentExcluded : excluded) || node.id?.startsWith('bamti-overlay-')) { activePiece = null; continue; }
      // Keep explicit prose inside linked cards, not their bare labels/titles.
      const linkedOnly = fragments || node.matches('p,li,dd,figcaption,[role="paragraph"]') ? false
        : linked || (node.tagName === 'A' && !node.closest('p,li,dd,figcaption,[role="paragraph"]'));
      const style = ctx.cs(node);
      if (style.display === 'none' || style.contentVisibility === 'hidden' || Number(style.opacity) === 0) { activePiece = null; continue; }
      // Hidden containers may explicitly reveal a child; only their text is excluded.
      const inlineControl = fragments && node.matches('a,button,[role="button"]') && node.parentElement?.closest('p,h1,h2,h3,h4,h5,h6,[role="paragraph"]');
      const own = !inlineControl && node.matches(fragments ? fragmentBlock : block) ? node : owner;
      if (fragments && own !== owner) activePiece = null;
      const kids = node.tagName === 'DETAILS' && !node.open ? [...node.children].filter(n => n.tagName === 'SUMMARY') : [...(node.shadowRoot?.childNodes || node.childNodes)];
      for (let i = kids.length - 1; i >= 0; i--) {
        if (kids[i].nodeType === 3 && (!visible.has(node) || style.visibility !== 'visible')) { activePiece = null; continue; }
        stack.push({ node: kids[i], owner: own, linked: linkedOnly });
      }
    }
    return { blocks: (fragments ? pieces : [...map].map(([node, text]) => ({ node, text }))).map(x => ({ ...x, text: x.text.trim() })).filter(x => x.text), limited: limited || stack.length > 0 || !!ctx.truncated };
  }

  // Editing suggestions, not authorship verdicts. One occurrence is enough;
  // length, repetition, density and language-count gates do not apply here.
  const fragmentKo = {
    'A-1': ['context', '“~에 대해”를 목적어로 바로 연결하면 더 간결한지 확인하세요. 자연스러운 표현이면 유지해도 됩니다.'],
    'A-2': ['context', '“~를 통해”를 “~로” 또는 구체적인 행동으로 바꿔보세요. 수단을 강조해야 한다면 유지해도 됩니다.'],
    'A-3': ['suggestion', '“~에 있어서”를 “~에서”나 “~을 볼 때”로 줄여보세요.'],
    'A-4': ['context', '“~라는 점에서” 대신 이유나 차이를 바로 설명해보세요.'],
    'A-8': ['suggestion', '이중 피동을 줄이고 누가 무엇을 하는지 명확히 해보세요. 원문의 주체는 바꾸지 마세요.'],
    'A-10': ['context', '가능 표현이 꼭 필요한지 확인하세요. 불확실한 내용을 확정된 사실로 바꾸지는 마세요.'],
    'A-19': ['context', '겹친 조사를 줄이거나 짧은 절로 풀어 관계를 명확히 해보세요.'],
    'C-8': ['context', '대조가 꼭 필요한지 확인하고, 필요 없다면 실제 장점을 바로 적어보세요.'],
    'C-11': ['context', '연결어미 뒤 쉼표가 문장의 흐름에 필요한지 확인하세요. 쉼표 자체는 문제가 아닙니다.'],
    'D-1': ['context', '요약을 예고하는 말 없이 결론부터 써도 의미가 유지되는지 확인하세요.'],
    'D-4': ['suggestion', '과장된 수식어 대신 실제 기능·수치·사례를 적어보세요. 없는 근거를 만들지는 마세요.'],
    'G-2': ['suggestion', '겹친 완곡 표현을 하나로 줄이되 가능성·부정·조건은 유지하세요.'],
    'H-1': ['context', '접속사 없이도 문장 관계가 분명한지 확인하세요. 연결이 필요하면 그대로 두어도 됩니다.'],
  };
  const fragmentEnglishContext = new Set([...ambiguousEnglish, 'moreover', 'furthermore', 'in-conclusion', 'feel-free', 'when-it-comes-to', 'bustling', 'nestled']);
  function scanFragments(ctx, repeated) {
    const extracted = extract(ctx, true), found = new Map(), languages = new Set();
    let inspected = 0, characters = 0;
    for (const { node, text: raw } of extracted.blocks) {
      const text = mask(raw);
      if (!/[가-힣A-Za-z]/.test(text)) continue;
      inspected++; characters += raw.length;
      if (/[가-힣]/.test(text)) languages.add('ko');
      if (/[A-Za-z]/.test(text)) languages.add('en');
      const hits = [
        ...KO_RULES.flatMap(([id, re]) => matches(text, re, id).map(h => ({ ...h, language: 'ko' }))),
        ...englishRules.flatMap(rule => matches(text, rule.re, rule.id).map(h => ({ ...h, language: 'en' }))),
      ].sort((a, b) => a.start - b.start || b.end - a.end);
      const accepted = [];
      for (const hit of hits) {
        if (accepted.some(h => h.language === hit.language && hit.start < h.end && hit.end > h.start)) continue;
        accepted.push(hit);
        const parentRule = hit.language === 'ko' ? 'prose-ko-' + hit.ruleId : 'prose-en-vocabulary';
        // The repeat finding already explains this phrase in this element.
        if (repeated.some(s => s.id === parentRule && (B._nodes.get(s.id) || []).includes(node))) continue;
        const id = `prose-fragment-${hit.language}-${hit.ruleId}`;
        if (!found.has(id)) {
          const [reviewLevel, hint] = hit.language === 'ko' ? fragmentKo[hit.ruleId]
            : [fragmentEnglishContext.has(hit.ruleId) ? 'context' : 'suggestion', fragmentEnglishContext.has(hit.ruleId)
              ? '기술 용어·일반 표현일 수 있습니다. 문맥에 맞으면 유지하고, 모호할 때만 더 구체적인 말로 바꿔보세요.'
              : '상투적인 수식어나 도입 대신 제품이 실제로 하는 일과 독자에게 필요한 정보를 적어보세요.'];
          const phrase = hit.text.trim().slice(0, 60);
          found.set(id, { id, language: hit.language, ruleId: hit.ruleId, reviewLevel,
            label: reviewLevel === 'context' ? tr`문맥 확인: ${phrase}` : tr`표현 제안: ${phrase}`,
            hint: tr(hint), source: hit.language === 'ko' ? KO_SOURCE : EN_SOURCE,
            nodes: new Set(), occurrences: 0, examples: [] });
        }
        const item = found.get(id);
        item.nodes.add(node); item.occurrences++;
        if (item.examples.length < LIMITS.examples) item.examples.push({ text: hit.text, ruleId: hit.ruleId,
          start: hit.start, end: hit.end, block: inspected,
          excerpt: raw.slice(Math.max(0, hit.start - 45), Math.min(raw.length, hit.end + 65)) });
      }
    }
    const signals = [...found.values()].sort((a, b) => (a.reviewLevel === 'context') - (b.reviewLevel === 'context')).map(({ nodes: set, ...f }) => {
      const nodes = [...set]; B._nodes.set(f.id, nodes);
      return { ...f, kind: 'prose', cat: 'prose', scope: 'element', weight: 0, analysisScopes: ['fragment'], count: nodes.length,
        evidence: tr`단일 표현 검사 · ${f.occurrences}회 · ${nodes.length}개 위치 · AI 작성 판정 아님`,
        targets: nodes.slice(0, B.TARGET_CAP).map(node => B.describe(node, ctx.doc)) };
    });
    return { status: inspected ? 'checked' : 'insufficient', inspectedBlocks: inspected, characters,
      languages: [...languages], limited: extracted.limited, signals };
  }

  B.PROSE = { analyzeBlock, koreanMetrics, limits: LIMITS, sources: [KO_SOURCE, EN_SOURCE] };
  B.scanProse = function(ctx) {
    const extracted = extract(ctx), found = new Map(), languages = new Set();
    const units = [];
    let inspected = 0, characters = 0, windows = 0;
    function add(f, scope) {
      if (!found.has(f.id)) found.set(f.id, { ...f, matches: undefined, nodes: new Set(), hits: new Map(), scopes: new Set() });
      const item = found.get(f.id);
      item.scopes.add(scope);
      for (const { unit, ...hit } of f.matches) {
        item.nodes.add(unit.node);
        const key = `${unit.index}:${hit.ruleId}:${hit.start}:${hit.end}`;
        if (!item.hits.has(key)) item.hits.set(key, { ...hit, block: unit.index,
          excerpt: unit.text.slice(Math.max(0, hit.start - 45), Math.min(unit.text.length, hit.end + 65)) });
      }
    }
    for (const { node, text } of extracted.blocks) {
      // Short semantic paragraphs can join a window. Bare layout text still
      // needs the original 80-character gate to avoid pooling UI labels.
      const semantic = node.matches('p,li,dd,figcaption,[role="paragraph"]');
      const result = collect(text, semantic);
      if (!result.languages.length) continue;
      inspected++; characters += text.length;
      result.languages.forEach(l => languages.add(l));
      const local = analyzeBlock(text).findings;
      const unit = { node, text, index: inspected, ...result, localIds: new Set(local.map(f => f.id)),
        region: node.closest('article,[role="article"],main,[role="main"]') || node.getRootNode() };
      units.push(unit);
      for (const f of local) add({ ...f, matches: f.matches.map(h => ({ ...h, unit })) }, 'paragraph');
    }
    // Bounded sliding windows, not one page-wide bag of words. The same
    // article region must be contiguous; article cards never merge together.
    for (let start = 0; start < units.length; start++) {
      const window = [], texts = new Set();
      let length = 0;
      for (let end = start; end < Math.min(units.length, start + LIMITS.windowBlocks); end++) {
        const unit = units[end];
        if (unit.region !== units[start].region || length + unit.text.length > LIMITS.windowCharacters) break;
        length += unit.text.length;
        const normalized = unit.text.replace(/\s+/g, ' ').toLowerCase();
        if (texts.has(normalized)) continue; // duplicated DOM copy is not independent evidence
        texts.add(normalized); window.push(unit);
        if (window.length < 2) continue;
        windows++;
        const candidates = new Map();
        for (const part of window) for (const f of part.findings) {
          if (!candidates.has(f.id)) candidates.set(f.id, { ...f, matches: [] });
          candidates.get(f.id).matches.push(...f.matches.map(h => ({ ...h, unit: part })));
        }
        for (const f of candidates.values()) {
          // A strong single paragraph must not pull innocent neighbors into
          // its finding. This pass fills gaps where no paragraph qualifies.
          if (window.some(part => part.localIds.has(f.id))) continue;
          const relevant = window.filter(part => part.languages.includes(f.language));
          const matched = new Set(f.matches.map(h => h.unit));
          if (matched.size < 2 || matched.size / relevant.length < .6) continue;
          const stats = relevant.reduce((sum, part) => ({ words: sum.words + part.stats.words, hangul: sum.hangul + part.stats.hangul }), { words: 0, hangul: 0 });
          if (!qualifies(f, stats)) continue;
          // Common Korean constructions scattered through long text are not
          // a cluster merely because the document is long.
          if (f.language === 'ko' && f.matches.length / stats.hangul < .006) continue;
          add(f, 'nearby-paragraphs');
        }
      }
    }
    const signals = [...found.values()].map(({ nodes: nodeSet, hits, scopes, ...f }) => {
      const nodes = [...nodeSet].sort((a, b) => units.find(u => u.node === a).index - units.find(u => u.node === b).index);
      const examples = [...hits.values()].sort((a, b) => a.block - b.block || a.start - b.start).slice(0, LIMITS.examples);
      const occurrences = hits.size;
      B._nodes.set(f.id, nodes);
      return { ...f, occurrences, examples, analysisScopes: [...scopes], cat: 'prose', kind: 'prose', scope: 'element', weight: 0, count: nodes.length,
        evidence: (scopes.has('nearby-paragraphs') ? tr('문단 간 반복') + ' · ' : '') + tr`${f.language.toUpperCase()} · ${occurrences}회 · ${nodes.length}개 문단` + ' · ' + [...new Set(examples.map(x => x.text))].slice(0, 4).map(x => `“${x}”`).join(', '),
        targets: nodes.slice(0, B.TARGET_CAP).map(el => B.describe(el, ctx.doc)) };
    });
    const fragments = scanFragments(ctx, signals);
    return { version: 3, status: inspected ? 'checked' : 'insufficient', languages: [...languages], inspectedBlocks: inspected, crossParagraphWindows: windows,
      characters, limited: extracted.limited || fragments.limited, signals, fragments, sources: [KO_SOURCE, EN_SOURCE],
      note: tr('제목·짧은 설명·버튼·링크의 표현은 한 번만 나와도 표시합니다. 표현 제안과 문맥 확인을 구분하며, 반복 검사는 추가 근거입니다. AI 작성 여부나 UI 점수는 판정하지 않습니다.') };
  };
})();
