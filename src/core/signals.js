/* 밤티 — 시그널 정의
 * 각 시그널은 "AI가 뽑아낸 티"의 단일 증거 하나를 담당한다.
 * detect(ctx) -> null | { ev: string, nodes?: Element[] }
 *
 * cat: visual(시각) | structure(구조) | unfinished(미완성) | toolchain(툴체인)
 * weight: 확신도. unfinished 계열은 취향이 아니라 결함이라 가중치가 높다.
 */
(() => {
  const B = (globalThis.BAMTI ||= {});
  const tr = B.I18N.t;

  /* ── Tailwind 기본 팔레트 (커스텀 안 하면 그대로 남는 값들) ───────── */
  const TW_HEX = `
    ef4444 f97316 f59e0b eab308 84cc16 22c55e 10b981 14b8a6 06b6d4 0ea5e9
    3b82f6 6366f1 8b5cf6 a855f7 d946ef ec4899 f43f5e
    dc2626 ea580c d97706 ca8a04 65a30d 16a34a 059669 0d9488 0891b2 0284c7
    2563eb 4f46e5 7c3aed 9333ea c026d3 db2777 e11d48
    f8fafc f1f5f9 e2e8f0 cbd5e1 94a3b8 64748b 475569 334155 1e293b 0f172a
    f9fafb f3f4f6 e5e7eb d1d5db 9ca3af 6b7280 4b5563 374151 1f2937 111827
  `.trim().split(/\s+/);

  const TW_RGB = new Set(TW_HEX.map(h =>
    [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)].join(',')
  ));

  const EMOJI = /^\s*(\p{Extended_Pictographic}️?){1,2}\s*$/u;

  const GENERIC_CTA = [
    'get started','start free','try free','try it free','learn more','sign up free',
    'book a demo','request a demo','join waitlist','start building','get started free',
    '지금 시작','무료로 시작','무료 체험','자세히 보기','더 알아보기','문의하기','데모 신청'
  ];

  const PLACEHOLDER_HOSTS = [
    'images.unsplash.com','source.unsplash.com','picsum.photos','placehold.co',
    'via.placeholder.com','placekitten.com','dummyimage.com','i.pravatar.cc',
    'api.dicebear.com','ui-avatars.com','loremflickr.com'
  ];

  const DEFAULT_TITLES = [
    'vite + react','vite + vue','vite app','create next app','next.js','react app',
    'v0 app','svelte app','nuxt app','my app','untitled','document','home','astro'
  ];

  /* ── 색 유틸 ──────────────────────────────────────────────────── */
  const rgbOf = s => {
    const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(s || '');
    return m ? [ +m[1], +m[2], +m[3] ] : null;
  };
  const allRgb = s => [...String(s || '').matchAll(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/g)]
    .map(m => [ +m[1], +m[2], +m[3] ]);

  const hue = ([r,g,b]) => {
    r/=255; g/=255; b/=255;
    const mx = Math.max(r,g,b), mn = Math.min(r,g,b), d = mx - mn;
    if (!d) return -1;
    let h = mx === r ? ((g-b)/d) % 6 : mx === g ? (b-r)/d + 2 : (r-g)/d + 4;
    h *= 60; return h < 0 ? h + 360 : h;
  };
  const sat = ([r,g,b]) => {
    const mx = Math.max(r,g,b), mn = Math.min(r,g,b);
    return mx ? (mx - mn) / mx : 0;
  };
  const isPurple = c => { const h = hue(c); return h >= 255 && h <= 300 && sat(c) > .35; };
  const isBlue   = c => { const h = hue(c); return h >= 200 && h <  255 && sat(c) > .35; };
  const isPink   = c => { const h = hue(c); return h >  300 && h <= 345 && sat(c) > .35; };

  const mode = arr => {
    const m = new Map();
    for (const v of arr) m.set(v, (m.get(v) || 0) + 1);
    let best = null, n = 0;
    for (const [v,c] of m) if (c > n) { best = v; n = c; }
    return { value: best, count: n, total: arr.length };
  };

  const txt = el => (el.textContent || '').trim().toLowerCase();

  // Small labels above headings, matched by rendered structure, not class names.
  function labelReviews(ctx) {
    if (ctx.pageType.key === 'application') return [];
    const excluded = 'nav,footer,form,table,dl,label,legend,time,button,[role="status"],[role="alert"],[role="navigation"],[role="feed"],[role="tablist"],[role="menu"],[role="dialog"]';
    const visible = new Set(ctx.els);
    const heads = ctx.query('h1,h2,h3,h4').filter(el => !el.closest(excluded));
    const headingSet = new Set(heads);
    const decorative = el => {
      if (!visible.has(el)) return !heads.some(h => el.contains(h));
      const r = el.getBoundingClientRect();
      return !el.matches('a,button,input') && r.width <= 64 && r.height <= 48
        && (el.tagName.toLowerCase() === 'svg' || !/[\p{L}\p{N}]/u.test(el.textContent || ''));
    };
    const leadingHeading = (el, depth = 0) => {
      if (headingSet.has(el)) return el;
      if (depth >= 3 || el.closest(excluded)) return null;
      for (const node of el.childNodes) {
        if (node.nodeType === 3 && /[\p{L}\p{N}]/u.test(node.textContent)) return null;
        if (node.nodeType !== 1 || decorative(node)) continue;
        return leadingHeading(node, depth + 1);
      }
      return null;
    };
    const nextHeading = label => {
      let current = label;
      for (let level = 0; current && level < 4; level++) {
        let next = current.nextElementSibling;
        for (let n = 0; next && n < 4; n++, next = next.nextElementSibling) {
          if (decorative(next)) continue;
          return leadingHeading(next);
        }
        const parent = current.parentElement;
        if (!parent || parent.matches('section,article,main,body,a') || parent.closest(excluded)) return null;
        // A label below this card's heading must not attach to the next card.
        if (heads.some(h => parent.contains(h) && (h.compareDocumentPosition(label) & 4))) return null;
        current = parent;
      }
      return null;
    };
    const matched = new Map();
    for (const el of ctx.els) {
      if (!el.matches('p,span,div,small') || el.closest(excluded)) continue;
      if ([...el.children].some(c => !c.matches('span,strong,em,b,i,small,svg') && !decorative(c))) continue;
      const text = (el.textContent || '').trim();
      if (!text || text.length > 64 || !/[\p{L}]/u.test(text) || /^h[1-6]$/i.test(text)) continue;
      const size = parseFloat(ctx.cs(el).fontSize);
      if (!size || size > 15) continue;
      const heading = nextHeading(el);
      if (!heading || parseFloat(ctx.cs(heading).fontSize) / size < 1.4) continue;
      const r = el.getBoundingClientRect(), h = heading.getBoundingClientRect();
      if (h.top < r.bottom - 4 || h.top - r.bottom > 100 || Math.min(r.right, h.right) <= Math.max(r.left, h.left)) continue;
      const old = matched.get(heading);
      if (old && old.el.contains(el)) continue;
      const contextual = /^(for\s+|대상\s*[:：]|(?:개발자|사용자|제작자|고객|판매자)용(?:\s|$))/i.test(text)
        || /^[A-Z][A-Z\d.-]{1,15}(?:\s|$)/.test(text) || /^[\p{L}\d.-]{1,24}$/u.test(text);
      matched.set(heading, { el, heading, text, contextual });
    }
    return [...matched.values()];
  }

  /* ── 시그널 ───────────────────────────────────────────────────── */
  B.SIGNALS = [

    {
      id: 'glass-panel-overuse', cat: 'visual', weight: 6,
      get label() { return tr('콘텐츠 전반에 반복되는 유리 패널'); },
      get hint() { return tr('블러와 큰 둥근 모서리가 여러 콘텐츠 영역에 반복됩니다. 핵심 영역에만 효과를 남기고 설명·안내 영역은 단순한 배경으로 구분해보세요. 유리 효과 자체나 AI 제작 여부를 문제로 단정하지 않습니다.'); },
      detect(ctx) {
        const excluded = 'header,footer,nav,aside,[role="navigation"],[role="feed"],[role="menu"],[role="dialog"],[role="application"]';
        const headings = ctx.query('h1,h2,h3,h4').filter(el => !el.closest(excluded));
        const paragraphs = ctx.query('p').filter(el => !el.closest(excluded) && txt(el).length >= 20);
        const candidates = ctx.els.filter(el => {
          if (el.closest(excluded) || !/^(SECTION|ARTICLE|DIV|A|LI)$/.test(el.tagName)) return false;
          const s = ctx.cs(el);
          const blur = /blur\(([\d.]+)px\)/.exec(s.backdropFilter || s.webkitBackdropFilter || '');
          if (!blur || +blur[1] < 8 || Math.min(...[s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomLeftRadius, s.borderBottomRightRadius].map(parseFloat)) < 16) return false;
          // Opaque panels hide the backdrop. Only translucent paint is relevant.
          const alpha = s.backgroundColor.match(/rgba\([^)]*,\s*([\d.]+)\)$/);
          if (!alpha || +alpha[1] > .9) return false;
          if (s.backgroundImage !== 'none' && !/rgba\(|transparent/.test(s.backgroundImage)) return false;
          const r = el.getBoundingClientRect();
          return r.width >= 200 && r.height >= 90 && headings.some(h => el.contains(h)) && paragraphs.some(p => el.contains(p));
        });
        // Nested shells are one panel, not multiple independent observations.
        const nodes = candidates.filter(el => !candidates.some(parent => parent !== el && parent.contains(el)));
        if (nodes.length < 5) return null;
        const covered = headings.filter(h => nodes.some(panel => panel.contains(h))).length;
        if (!headings.length || covered / headings.length < .7) return null;
        return { ev: tr`큰 반투명 패널 ${nodes.length}개에 블러 ≥8px·모서리 ≥16px 반복 · 콘텐츠 제목 ${covered}/${headings.length}개 포함`, nodes };
      }
    },

    /* ═══ 🎨 시각 ═══════════════════════════════════════════════ */
    {
      id: 'gradient-text-heading', cat: 'visual', weight: 10,
      get label() { return tr('그라디언트 텍스트 헤드라인'); },
      get hint() { return tr('AI 생성 랜딩페이지에서 가장 흔한 단일 지문입니다. 헤드라인은 단색으로 두고, 강조가 필요하면 한 단어에만 색을 주세요.'); },
      detect(ctx) {
        const hit = ctx.els.filter(el => {
          if (!el.matches('h1,h2,h3') && !el.closest('h1,h2,h3')) return false;
          const cs = ctx.cs(el);
          return cs.backgroundImage.includes('gradient(') && (cs.backgroundClip === 'text' || cs.webkitBackgroundClip === 'text');
        });
        return hit.length ? { ev: tr`${hit.length}개 요소가 background-clip:text 그라디언트`, nodes: hit } : null;
      }
    },
    {
      id: 'purple-blue-gradient', cat: 'visual', weight: 10,
      get label() { return tr('보라→파랑 그라디언트'); },
      get hint() { return tr('2023년 이후 AI 생성 페이지의 사실상 기본값입니다. 브랜드 컬러 하나를 정하고 그 명도 변주로 대체하세요.'); },
      detect(ctx) {
        const hit = ctx.els.filter(el => {
          const bg = ctx.cs(el).backgroundImage;
          if (!bg || !bg.includes('gradient')) return false;
          const cs = allRgb(bg);
          return cs.some(isPurple) && cs.some(c => isBlue(c) || isPink(c));
        });
        return hit.length ? { ev: tr`${hit.length}개 요소에 보라-파랑/핑크 그라디언트`, nodes: hit } : null;
      }
    },
    {
      id: 'tailwind-stock-palette', kind: 'taste', cat: 'visual', weight: 8,
      get label() { return tr('Tailwind 기본 팔레트 그대로'); },
      get hint() { return tr('공개 팔레트와 겹치는 색입니다. 정상적인 디자인 시스템에서도 사용하므로 AI 생성이나 미완성의 근거로 채점하지 않습니다. 브랜드와 맞는지만 검토하세요.'); },
      detect(ctx) {
        const used = new Map();
        for (const el of ctx.els) {
          const cs = ctx.cs(el);
          for (const p of ['color','backgroundColor','borderTopColor']) {
            const c = rgbOf(cs[p]);
            if (!c || sat(c) < .12) continue;           // 무채색은 제외
            const k = c.join(',');
            used.set(k, (used.get(k) || 0) + 1);
          }
        }
        if (used.size < 3) return null;
        const stock = [...used.keys()].filter(k => TW_RGB.has(k));
        const ratio = stock.length / used.size;
        if (ratio < .5) return null;
        const stockSet = new Set(stock);
        const pick = prop => ctx.els.filter(el => {
          const c = rgbOf(ctx.cs(el)[prop]);
          return c && stockSet.has(c.join(',')) && el.offsetWidth > 24 && el.offsetHeight > 12;
        });
        let nodes = pick('backgroundColor');
        if (nodes.length < 3) nodes = nodes.concat(pick('color').filter(el => el.children.length === 0));   // 글자색으로 쓴 경우
        if (nodes.length < 3) nodes = nodes.concat(pick('borderTopColor'));
        nodes = [...new Set(nodes)].slice(0, 40);
        return { ev: tr`유채색 ${used.size}종 중 ${stock.length}종이 Tailwind 기본값 (${Math.round(ratio*100)}%)`, nodes };
      }
    },
    {
      id: 'no-custom-typeface', kind: 'taste', scope: 'page', cat: 'visual', weight: 6,
      get label() { return tr('커스텀 폰트 없음 (Inter/시스템 폰트만)'); },
      get hint() { return tr('시스템 폰트는 속도와 가독성을 위한 정상적인 선택입니다. 제목과 본문의 위계가 부족할 때만 크기·굵기를 검토하세요.'); },
      detect(ctx) {
        const fams = new Set();
        for (const el of ctx.els.slice(0, 1200)) {
          const f = ctx.cs(el).fontFamily.split(',')[0].replace(/["']/g,'').trim().toLowerCase();
          if (f) fams.add(f);
        }
        const generic = /^(inter|ui-sans-serif|system-ui|-apple-system|blinkmacsystemfont|segoe ui|roboto|helvetica|arial|sans-serif|geist)$/;
        const custom = [...fams].filter(f => !generic.test(f));
        return custom.length === 0
          ? { ev: tr`사용 폰트 전부 기본 스택 (${[...fams].slice(0,3).join(', ')})` }
          : null;
      }
    },
    {
      id: 'single-radius', kind: 'taste', cat: 'visual', weight: 5,
      get label() { return tr('모든 모서리 반경이 동일'); },
      get hint() { return tr('같은 반경을 반복하는 것은 일관된 디자인 토큰일 수 있습니다. 다른 역할의 요소가 실제로 구분되지 않을 때만 바꾸세요.'); },
      detect(ctx) {
        const radii = ctx.els
          .map(el => ctx.cs(el).borderTopLeftRadius)
          .filter(r => r && r !== '0px' && !r.includes('%'));
        if (radii.length < 8) return null;
        const m = mode(radii);
        if (m.count / m.total < .8) return null;
        const nodes = ctx.els.filter(el => ctx.cs(el).borderTopLeftRadius === m.value && el.offsetWidth > 40).slice(0, 24);
        return { ev: tr`둥근 요소 ${m.total}개 중 ${m.count}개가 ${m.value}`, nodes };
      }
    },
    {
      id: 'everything-centered', cat: 'visual', weight: 5,
      get label() { return tr('모든 것이 가운데 정렬'); },
      get hint() { return tr('히어로만 센터로 두고 나머지 섹션은 좌측 정렬로 바꾸면 리듬이 생깁니다.'); },
      detect(ctx) {
        const blocks = ctx.els.filter(el => el.offsetHeight > 200 && el.children.length >= 2);
        if (blocks.length < 3) return null;
        const c = blocks.filter(el => ctx.cs(el).textAlign === 'center');
        return c.length / blocks.length >= .6
          ? { ev: tr`주요 블록 ${blocks.length}개 중 ${c.length}개가 text-align:center`, nodes: c }
          : null;
      }
    },

    {
      id: 'eyebrow-microlabel', kind: 'taste', cat: 'visual', weight: 7,
      get label() { return tr('제목 위 작은 레이블 검토'); },
      get hint() { return tr('서비스 식별명과 대상 구분은 필요한 정보일 수 있습니다. 이름은 유지하고 제목과 겹치는 비유·슬로건만 줄일지 검토하세요. 레이블이 여러 영역에서 반복되면 일부 영역은 제목부터 시작해 위계를 단순하게 만들어보세요.'); },
      detect(ctx) {
        const pairs = labelReviews(ctx);
        if (!pairs.length) return null;
        const repeated = pairs.length >= 3;
        return {
          label: repeated ? tr('장식 레이블 반복 사용 검토') : tr('제목 위 작은 레이블 검토'),
          ev: (repeated ? tr`서로 다른 제목 ${pairs.length}곳 위에서 같은 레이블 구조 반복` : tr('레이블 한 곳부터 검토 · 점수 제외')) + ' · '
            + pairs.slice(0, 6).map(p => (p.contextual ? tr('문맥 확인') : tr('장식 여부 검토')) + `: “${p.text}” → “${(p.heading.textContent || '').trim().slice(0, 64)}”`).join(' / '),
          nodes: pairs.map(p => p.el),
        };
      }
    },
    {
      id: 'headline-terminal-period', kind: 'taste', cat: 'visual', weight: 5,
      get label() { return tr('짧은 문구 끝 마침표 검토'); },
      get hint() { return tr('짧게 독립 배치된 UI 문구 끝에 마침표가 붙어 있습니다. 완결된 문장이어도 마침표를 생략해 화면의 읽는 흐름을 가볍게 만들어보세요. 여러 문장이 이어지는 본문, 약어·숫자·브랜드 표기는 별도로 판단하세요. 문법 오류나 AI 작성 판정은 아닙니다.'); },
      detect(ctx) {
        const excluded = 'nav,footer,form,table,dl,time,code,pre,kbd,blockquote,q,cite,[role="navigation"],[role="feed"],[role="menu"],[role="status"],[contenteditable]:not([contenteditable="false"])';
        const ABBR = /\b(?:inc|ltd|co|corp|etc|vs|jr|sr|dr|mr|mrs|ms|st|no|ex|e\.g|i\.e)\./i;
        const parts = text => text.split(/[.．。!?！？]\s*/).map(s => s.trim()).filter(Boolean);
        const hits = [];
        for (const h of ctx.query('h1,h2,h3,h4,h5,h6,p,small,span,a,button,[role="button"]')) {
          if (h.closest(excluded) || h.querySelector('h1,h2,h3,h4,h5,h6,p,div,section,article,ul,ol')) continue;
          const raw = (h.innerText || h.textContent || '').trim();
          const t = raw.replace(/\s+/g, ' ');
          const explicitLines = !!h.querySelector('br');
          if (!t || t.length > (explicitLines ? 160 : 80)) continue;
          if (!/[.．。]$/.test(t) || /\.{2,}|…|[．。]{2,}/.test(t) || ABBR.test(t)) continue;
          // Numbers, addresses and dotted identifiers are not decorative stops.
          if (/\d[.．]\d|[\p{L}\d]\.[\p{L}\d]|https?:|www\.|@/u.test(t)) continue;
          const heading = h.matches('h1,h2,h3,h4,h5,h6');
          // Grammar is not the gate: complete sentences can be UI microcopy.
          // Keep continuous multi-sentence prose, including inline span children.
          const paragraph = h.parentElement?.closest('p,[role="paragraph"]');
          if (paragraph && !paragraph.querySelector('br') && parts(paragraph.innerText || paragraph.textContent || '').length > 1) continue;
          const frags = parts(t);
          if (!frags.length || frags.some(f => !/[\p{L}]/u.test(f))) continue;
          if (!heading && !explicitLines && frags.length > 1) continue;
          if (explicitLines && raw.split(/\n+/).some(line => line.trim().length > 80 || parts(line).length > 1)) continue;
          if (hits.some(x => x.node.contains(h))) continue;
          hits.push({ node: h, text: t });
        }
        if (!hits.length) return null;
        return {
          ev: hits.slice(0, 3).map(x => `"${x.text.slice(0, 64)}"`).join(', ')
              + (hits.length > 3 ? tr` 외 ${hits.length - 3}개` : ''),
          nodes: hits.map(x => x.node),
        };
      }
    },

    {
      id: 'value-sprawl', kind: 'taste', cat: 'visual', weight: 9,
      get label() { return tr('다양한 스타일 값 사용'); },
      get hint() { return tr('스타일 종류는 화면의 규모와 기능에 따라 늘어납니다. 이 개수로 AI 생성이나 시스템 부재를 판단하지 않습니다. 같은 역할의 요소끼리 비교할 때 참고하세요.'); },
      detect(ctx) {
        if (ctx.els.length < 120) return null;         // 너무 작은 페이지는 표본 부족
        const U = a => new Set(a).size;
        const checks = [
          { k: '글자 크기', v: U(ctx.els.map(e => ctx.cs(e).fontSize)), thr: 12 },
          { k: '배경색',    v: U(ctx.els.map(e => ctx.cs(e).backgroundColor)
                                  .filter(c => c && c !== 'rgba(0, 0, 0, 0)')), thr: 17 },
          { k: '그림자',    v: U(ctx.els.map(e => ctx.cs(e).boxShadow)
                                  .filter(x => x && x !== 'none')), thr: 6 },
          { k: '모서리 반경', v: U(ctx.els.map(e => ctx.cs(e).borderTopLeftRadius)
                                  .filter(r => r && r !== '0px' && !r.includes('%'))), thr: 9 },
        ];
        const over = checks.filter(c => c.v >= c.thr);
        if (over.length < 2) return null;
        // 표시: 기준을 넘긴 속성에서 '한두 요소에서만 쓰인 값'(별종)을 가진 요소 — 스케일 밖의 값이 어디 있는지
        const props = { '글자 크기': 'fontSize', '배경색': 'backgroundColor', '그림자': 'boxShadow', '모서리 반경': 'borderTopLeftRadius' };
        const nodes = [];
        for (const c of over) {
          const prop = props[c.k];
          const count = new Map();
          for (const el of ctx.els) { const v = ctx.cs(el)[prop]; count.set(v, (count.get(v) || 0) + 1); }
          for (const el of ctx.els) {
            const v = ctx.cs(el)[prop];
            if (!v || v === 'none' || v === '0px' || v === 'rgba(0, 0, 0, 0)') continue;
            if (count.get(v) <= 2 && el.offsetWidth > 16 && el.offsetHeight > 8) nodes.push(el);
            if (nodes.length >= 40) break;
          }
        }
        return { ev: over.map(c => tr`${tr(c.k)} ${c.v}종`).join(' · ') + tr` (기준 초과 ${over.length}/4)`, nodes: [...new Set(nodes)] };
      }
    },
    {
      id: 'typeface-sprawl', kind: 'taste', cat: 'visual', weight: 6,
      get label() { return tr('폰트 패밀리 3종 이상'); },
      get hint() { return tr('여러 서체는 코드·다국어·브랜드 영역을 구분하기 위한 선택일 수 있습니다. 같은 역할의 텍스트에서 불필요하게 달라지는지만 확인하세요.'); },
      detect(ctx) {
        const GENERIC = /^(ui-sans-serif|ui-serif|ui-monospace|system-ui|-apple-system|blinkmacsystemfont|sans-serif|serif|monospace|inherit|initial)$/;
        const fams = new Map();   // family → 표본 요소
        for (const el of ctx.els) {
          const f = ctx.cs(el).fontFamily.split(',')[0].replace(/["']/g, '').trim().toLowerCase();
          if (f && !GENERIC.test(f) && !fams.has(f) && (el.textContent || '').trim().length > 3) fams.set(f, el);
        }
        return fams.size >= 3
          ? { ev: tr`${fams.size}종 — ${[...fams.keys()].slice(0, 4).join(', ')}`, nodes: [...fams.values()] }
          : null;
      }
    },

    /* ═══ 🧱 구조 ═══════════════════════════════════════════════ */
    {
      id: 'three-col-feature-grid', cat: 'structure', weight: 7,
      get label() { return tr('3열 기능 그리드 (아이콘+제목+2줄)'); },
      get hint() { return tr('기능이 정말 3개라서 3개인지 확인하세요. 보통은 레이아웃이 개수를 정한 경우입니다.'); },
      detect(ctx) {
        const hit = ctx.els.filter(el => {
          const cs = ctx.cs(el);
          if (cs.display !== 'grid') return false;
          const cols = cs.gridTemplateColumns.split(' ').filter(Boolean);
          if (cols.length !== 3) return false;
          const kids = [...el.children];
          if (kids.length !== 3 && kids.length !== 6) return false;
          return kids.filter(k => k.querySelector('svg, img') && k.querySelector('h2,h3,h4')).length >= 2;
        });
        return hit.length ? { ev: tr`3열 기능 그리드 ${hit.length}개`, nodes: hit } : null;
      }
    },
    {
      id: 'uniform-section-rhythm', cat: 'structure', weight: 7,
      get label() { return tr('모든 섹션의 상하 여백이 동일'); },
      get hint() { return tr('섹션마다 중요도가 다른데 여백이 같으면 전부 똑같이 안 중요해 보입니다.'); },
      detect(ctx) {
        const secs = ctx.els.filter(el =>
          (el.tagName === 'SECTION' || el.parentElement?.tagName === 'MAIN' || el.parentElement === ctx.doc.body)
          && el.offsetHeight > 240
        );
        if (secs.length < 3) return null;
        const pads = secs.map(el => ctx.cs(el).paddingTop);
        const m = mode(pads.filter(p => p !== '0px'));
        return m.count >= 3 && m.count / secs.length >= .55
          ? { ev: tr`섹션 ${secs.length}개 중 ${m.count}개가 padding-top:${m.value}`, nodes: secs }
          : null;
      }
    },
    {
      id: 'canonical-section-order', cat: 'structure', weight: 8,
      get label() { return tr('정석 랜딩페이지 순서 (Features→Pricing→FAQ)'); },
      get hint() { return tr('이 순서 자체가 나쁘진 않지만, 방문자가 실제로 궁금해하는 순서인지 다시 보세요.'); },
      detect(ctx) {
        const seq = ['features','기능','how it works','작동','pricing','요금','가격','testimonial','후기','faq','자주'];
        const found = [], nodes = [];
        for (const h of ctx.query('h2,h3')) {
          const t = txt(h);
          const i = seq.findIndex(s => t.includes(s));
          if (i >= 0) { found.push(seq[i]); nodes.push(h); }
        }
        const uniq = [...new Set(found)];
        return uniq.length >= 3 ? { ev: tr`정석 섹션 ${uniq.length}종 발견: ${uniq.join(' → ')}`, nodes } : null;
      }
    },
    {
      id: 'three-tier-pricing', cat: 'structure', weight: 6,
      get label() { return tr('3단 요금제 + 가운데 "인기"'); },
      get hint() { return tr('실제 가격 정책이 정해지기 전이라면 요금 섹션은 아예 빼는 편이 신뢰에 낫습니다.'); },
      detect(ctx) {
        const sections = ctx.query('section').filter(sec =>
          ctx.query('h2,h3').some(h => sec.contains(h) && /^(pricing|plans|요금|요금제|가격)(\b|\s|$)/i.test(txt(h))));
        const badge = /most popular|가장 인기|추천|인기|best value|recommended/i;
        const price = /[$€£₩]\s*\d|\d[\d,]*\s*(원|\/\s*(mo|month|월))|contact (us|sales)|custom/i;
        const nodes = [];
        for (const sec of sections) {
          for (const box of ctx.els.filter(el => sec.contains(el) && el.children.length === 3)) {
            const cards = [...box.children];
            if (!cards.every(c => c.querySelector('h3,h4') && c.querySelector('a,button') && price.test(txt(c)))) continue;
            if (badge.test(txt(cards[1])) && !badge.test(txt(cards[0])) && !badge.test(txt(cards[2]))) nodes.push(cards[1]);
          }
        }
        return nodes.length ? { ev: tr`가격·CTA가 있는 3개 요금 카드 중 가운데 추천 ${nodes.length}곳`, nodes } : null;
      }
    },
    {
      id: 'hero-badge-pill', cat: 'structure', weight: 5,
      get label() { return tr('히어로 상단 알약 뱃지'); },
      get hint() { return tr('"✨ Introducing…" 뱃지는 실제 공지가 있을 때만 쓰세요.'); },
      detect(ctx) {
        const h1 = ctx.query('h1')[0];
        if (!h1) return null;
        const near = [...(h1.parentElement?.children || [])].filter(el => el !== h1);
        const hit = near.filter(el => {
          const cs = ctx.cs(el);
          const t = txt(el);
          return parseFloat(cs.borderTopLeftRadius) >= 999 && t.length > 0 && t.length < 60;
        });
        return hit.length ? { ev: tr`히어로 상단 알약 요소: "${txt(hit[0]).slice(0,40)}"`, nodes: hit } : null;
      }
    },
    {
      id: 'fake-social-proof', cat: 'structure', weight: 7,
      get label() { return tr('검증 불가능한 사회적 증거'); },
      get hint() { return tr('"10,000+ 팀이 사용" 같은 숫자는 출처 링크가 없으면 오히려 신뢰를 깎습니다. 실제 고객 1곳이 낫습니다.'); },
      detect(ctx) {
        const m = /(trusted by|loved by|join|used by|이상의|여 개[의]? 팀|명이 사용)[^.。\n]{0,40}?[\d,]{3,}\+?/i.exec(ctx.rawText)
               || /[\d,]{3,}\+\s*(users|teams|companies|developers|customers|명|팀|개 기업)/i.exec(ctx.rawText);
        if (!m) return null;
        const needle = m[0].trim().slice(0, 30);
        const nodes = ctx.els.filter(el => el.children.length <= 2 && (el.textContent || '').includes(needle)).slice(0, 3);
        return { ev: `"${m[0].trim().slice(0,60)}"`, nodes };
      }
    },
    {
      id: 'generic-cta-copy', cat: 'structure', weight: 6,
      get label() { return tr('무색무취 CTA 문구'); },
      get hint() { return tr('CTA는 "무엇을 얻는지"를 써야 합니다. "지금 시작하기" → "무료로 첫 리포트 받기".'); },
      detect(ctx) {
        const btns = ctx.query('a,button').filter(el => !el.closest('nav,footer,aside,[role="navigation"]'))
          .filter(el => GENERIC_CTA.some(g => txt(el) === g || txt(el).replace(/\s+/g,'') === g.replace(/\s+/g,'')));
        return btns.length
          ? { ev: tr`${btns.length}개: ${[...new Set(btns.map(b => txt(b)))].slice(0,3).join(' / ')}`, nodes: btns }
          : null;
      }
    },

    /* ═══ 🧱 구성 — 일반 페이지의 조립 방식 지문 ═══════════════════ */
    {
      id: 'section-template-repeat', cat: 'structure', weight: 6,
      get label() { return tr('같은 틀의 섹션 반복 (제목 + 설명 + 카드 그리드)'); },
      get hint() { return tr('섹션 3개 이상이 "h2 → p → 카드 그리드" 같은 동일한 틀입니다. 내용이 틀을 정한 게 아니라 틀에 내용을 부은 흔적이에요. 섹션마다 정보의 형태에 맞는 레이아웃을 고르세요 — 표, 한 장의 큰 이미지, 긴 글, 비교.'); },
      detect(ctx) {
        const secs = ctx.els.filter(el =>
          (el.tagName === 'SECTION' || el.parentElement?.tagName === 'MAIN' || el.parentElement === ctx.doc.body)
          && el.offsetHeight > 200 && el.tagName !== 'HEADER' && el.tagName !== 'FOOTER' && el.tagName !== 'NAV');
        if (secs.length < 3) return null;
        const isGrid = el => { const cs = ctx.cs(el); return (cs.display === 'grid' || (cs.display === 'flex' && cs.flexWrap === 'wrap')) && el.children.length >= 3; };
        const cat = el => {
          if (/^H[1-6]$/.test(el.tagName)) return el.tagName.toLowerCase();
          if (el.tagName === 'P') return 'p';
          if (/^(IMG|PICTURE|VIDEO)$/.test(el.tagName)) return 'media';
          if (/^(A|BUTTON)$/.test(el.tagName)) return 'cta';
          if (isGrid(el) || [...el.children].some(isGrid)) return 'grid';
          return 'div';
        };
        const sig = sec => {
          let box = sec;
          while (box.children.length === 1) box = box.children[0];   // .wrap 같은 단일 래퍼는 통과
          return [...new Set([...box.children].map(cat))].sort().join('+');
        };
        const groups = new Map();
        for (const sec of secs) { const k = sig(sec); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(sec); }
        const hit = [...groups.entries()].filter(([k, arr]) => arr.length >= 3 && k.includes('grid'));
        if (!hit.length) return null;
        const [k, arr] = hit.sort((a, b) => b[1].length - a[1].length)[0];
        return { ev: tr`섹션 ${arr.length}개가 같은 틀 (${k.replace(/\+/g, ' + ')})`, nodes: arr };
      }
    },
    {
      id: 'card-clones', cat: 'structure', weight: 6,
      get label() { return tr('내용까지 균일한 카드 클론'); },
      get hint() { return tr('카드들의 구조가 같은 건 정상이지만, 글자 수까지 거의 같으면 내용이 채워 넣은 필러라는 뜻입니다. 실제 정보는 길이가 들쭉날쭉합니다. 카드마다 진짜 말할 게 있는지 확인하고, 없으면 카드 수를 줄이세요.'); },
      detect(ctx) {
        const isCard = el => el.querySelector('h2,h3,h4') && el.querySelector('p') && el.offsetHeight > 60;
        const anatomy = el => [...el.querySelectorAll('*')].slice(0, 12).map(x => x.tagName).filter(t => /^(SVG|IMG|H[2-4]|P|A|BUTTON|UL|SPAN)$/.test(t)).join(',');
        const nodes = []; let sets = 0;
        for (const box of ctx.els) {
          const kids = [...box.children];
          if (kids.length < 3 || kids.length > 12) continue;
          const cards = kids.filter(isCard);
          if (cards.length < 3 || cards.length < kids.length * .8) continue;
          const sigs = cards.map(anatomy);
          const m = mode(sigs);
          if (m.count / sigs.length < .8) continue;
          const lens = cards.map(c => (c.textContent || '').trim().length);
          const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
          if (!mean) continue;
          const cv = Math.sqrt(lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length) / mean;
          if (cv > .25) continue;                    // 내용 길이가 실제로 다르면 정상
          sets++; nodes.push(...cards);
        }
        if (nodes.length < 6) return null;
        return { ev: tr`카드 ${nodes.length}개(${sets}묶음)가 구조·글자 수까지 균일`, nodes: nodes.slice(0, 30) };
      }
    },
    {
      id: 'cta-banner', cat: 'structure', weight: 6,
      get label() { return tr('푸터 직전 CTA 배너 섹션'); },
      get hint() { return tr('"Ready to get started?" 배너는 모든 생성 페이지의 마지막 섹션입니다. 있어야 한다면 이 페이지에서만 할 수 있는 약속을 쓰세요. 아니면 빼고 푸터를 바로 붙이세요.'); },
      detect(ctx) {
        const secs = ctx.els.filter(el =>
          (el.tagName === 'SECTION' || el.parentElement?.tagName === 'MAIN' || el.parentElement === ctx.doc.body)
          && el.offsetHeight > 120 && !/^(HEADER|FOOTER|NAV)$/.test(el.tagName));
        if (secs.length < 3) return null;
        const tail = secs.slice(-3);                 // 마지막 3개 섹션만
        const lum = c => { const m = rgbOf(c); return m ? (m[0]*299 + m[1]*587 + m[2]*114) / 255000 : 1; };
        const hit = tail.filter((sec, i) => {
          if (secs.indexOf(sec) === 0) return false;
          const cs = ctx.cs(sec);
          const bg = cs.backgroundColor, bgi = cs.backgroundImage;
          const opaque = rgbOf(bg) && !/rgba\([^)]*,\s*0(\.0+)?\)$/.test(bg);   // 투명 배경은 '어둡다'가 아니다
          const accent = (bgi && bgi.includes('gradient')) || (opaque && (sat(rgbOf(bg)) > .3 || lum(bg) < .3));
          if (!accent) return false;
          if (!sec.querySelector('h2,h3')) return false;
          if (!sec.querySelector('a,button')) return false;
          let box = sec; while (box.children.length === 1) box = box.children[0];
          return ctx.cs(box).textAlign === 'center' || ctx.cs(sec).textAlign === 'center';
        });
        return hit.length ? { ev: tr`강조 배경 + 가운데 정렬 + 버튼: "${txt(hit[0].querySelector('h2,h3')).slice(0, 40)}"`, nodes: hit } : null;
      }
    },
    {
      id: 'icon-circle-badges', cat: 'toolchain', weight: 6,
      get label() { return tr('아이콘을 담은 원형 배지'); },
      get hint() { return tr('연한 배경의 원 안에 선 아이콘 — 생성 UI 기능 카드의 시그니처입니다. 아이콘을 원에서 꺼내 텍스트와 나란히 두거나, 아이콘 대신 실제 화면 조각을 쓰세요.'); },
      detect(ctx) {
        const hit = ctx.els.filter(el => {
          const w = el.offsetWidth, h = el.offsetHeight;
          if (w < 28 || w > 88 || Math.abs(w - h) > 6) return false;
          const cs = ctx.cs(el);
          const r = cs.borderTopLeftRadius;
          if (!(r.includes('%') && parseFloat(r) >= 50) && parseFloat(r) < Math.min(w, h) / 2 - 1) return false;
          if (!el.querySelector('svg') && !EMOJI.test(el.textContent || '')) return false;
          return cs.backgroundColor !== 'rgba(0, 0, 0, 0)';
        });
        return hit.length >= 3 ? { ev: tr`원형 아이콘 배지 ${hit.length}개`, nodes: hit } : null;
      }
    },
    {
      id: 'no-real-images', scope: 'page', cat: 'structure', weight: 7,
      get label() { return tr('실사 이미지가 한 장도 없음'); },
      get hint() { return tr('마케팅 페이지인데 사진·스크린샷이 없고 아이콘·그라디언트만 있습니다. 보여줄 실제 제품이 없을 때 나오는 형태예요. 실제 화면 캡처 한 장이 기능 카드 여섯 개보다 설득력 있습니다.'); },
      detect(ctx) {
        if (!ctx.query('h1').length) return null;
        const marketing = ctx.query('h2,h3').some(h => /features|pricing|기능|요금|how it works|작동|testimonial|후기/i.test(txt(h)));
        if (!marketing) return null;
        const secs = ctx.els.filter(el => el.tagName === 'SECTION' || el.parentElement === ctx.doc.body || el.parentElement?.tagName === 'MAIN').filter(el => el.offsetHeight > 200);
        if (secs.length < 3) return null;
        const real = ctx.query('img,picture,video,canvas').filter(el => {
          if (el.tagName === 'IMG' && /^data:image\/svg|\.svg(\?|$)/i.test(el.currentSrc || el.src || '')) return false;
          const r = el.getBoundingClientRect();
          return Math.max(r.width, el.width || 0) >= 120;
        });
        return real.length === 0 ? { ev: tr`120px 이상 이미지·영상 0개 (섹션 ${secs.length}개, svg/이모지만 사용)` } : null;
      }
    },
    {
      id: 'zigzag-features', cat: 'structure', weight: 5,
      get label() { return tr('가짜 미디어 지그재그 섹션'); },
      get hint() { return tr('이미지-글, 글-이미지를 번갈아 놓는 배치 자체는 흔합니다. 문제는 이미지 자리에 실제 이미지가 아닌 그라디언트 상자나 아이콘이 들어간 것 — 보여줄 게 없어서 배치만 흉내 낸 상태입니다.'); },
      detect(ctx) {
        const secs = ctx.els.filter(el => (el.tagName === 'SECTION' || el.parentElement?.tagName === 'MAIN' || el.parentElement === ctx.doc.body) && el.offsetHeight > 200);
        const rows = [];
        for (const sec of secs) {
          let box = sec; while (box.children.length === 1) box = box.children[0];
          const cs = ctx.cs(box);
          const two = (cs.display === 'grid' && cs.gridTemplateColumns.split(' ').filter(Boolean).length === 2)
                   || (cs.display === 'flex' && cs.flexDirection.startsWith('row') && box.children.length === 2);
          if (!two || box.children.length !== 2) continue;
          const [a, b] = box.children;
          const isText = el => !!el.querySelector('h2,h3') && !!el.querySelector('p');
          const isFakeMedia = el => !isText(el) && !el.querySelector('img,video,picture')
            && (el.querySelector('svg') || (ctx.cs(el).backgroundImage || '').includes('gradient') || ctx.cs(el).backgroundColor !== 'rgba(0, 0, 0, 0)');
          if (isText(a) && isFakeMedia(b)) rows.push({ sec, media: 1 });
          else if (isText(b) && isFakeMedia(a)) rows.push({ sec, media: 0 });
        }
        if (rows.length < 2) return null;
        const alternates = rows.some((r, i) => i > 0 && r.media !== rows[i - 1].media);
        return alternates ? { ev: tr`지그재그 ${rows.length}단, 미디어 칸이 전부 가짜(그라디언트/아이콘)`, nodes: rows.map(r => r.sec) } : null;
      }
    },

    /* ═══ 🧟 미완성 (취향 아님 — 진짜 결함) ═════════════════════ */
    {
      id: 'dead-links', cat: 'unfinished', weight: 12,
      get label() { return tr('목적지가 비어 있는 링크'); },
      get hint() { return tr('href만으로 동작 여부를 확정할 수 없습니다. 클릭 시 의도한 동작이 있는지 확인하고, 동작 버튼이면 button을, 이동 링크이면 실제 주소를 사용하세요.'); },
      detect(ctx) {
        const links = ctx.query('a[href]');
        const dead = links.filter(a => {
          if (a.matches('[onclick],[aria-controls],[aria-expanded],[aria-haspopup],[role="button"],[role="tab"],[role="menuitem"]') || a.querySelector('button,input,select')) return false;
          const h = a.getAttribute('href');
          return h === '' || h === '#' || /^javascript:\s*(void\s*\(\s*0\s*\)|;)\s*;?$/i.test(h);
        });
        return dead.length > 0
          ? { ev: tr`보이는 링크 ${links.length}개 중 ${dead.length}개에 이동 주소 없음 · 클릭 동작은 미검증`, nodes: dead }
          : null;
      }
    },
    {
      id: 'placeholder-copy', cat: 'unfinished', weight: 12,
      get label() { return tr('플레이스홀더 문구가 남아있음'); },
      get hint() { return tr('실제 배포 전 반드시 제거. 검색엔진에도 그대로 색인됩니다.'); },
      detect(ctx) {
        // STRONG: 산문에 섞여 나와도 플레이스홀더가 확실한 것
        const STRONG = [/lorem\s+ipsum/i, /\bcompany name\b/i, /\byour name here\b/i,
                        /\blogo here\b/i, /여기에 (내용|텍스트)/, /샘플 텍스트/];
        // SLOT: 브랜드 자리표시자. 요소의 "전체 텍스트"일 때만 인정한다.
        //   Stripe의 "...for your company" 같은 정상 카피를 오탐하지 않기 위함.
        const SLOT = /^(your (company|product|brand|logo)|acme(,? inc\.?)?|브랜드명|회사명|서비스명)$/i;

        const hits = STRONG.map(p => p.exec(ctx.rawText)).filter(Boolean).map(h => h[0]);
        const nodes = [];
        for (const el of ctx.els) {
          if (el.children.length) continue;
          const t = (el.textContent || '').trim();
          if (!t) continue;
          if (t.length < 40 && SLOT.test(t)) { hits.push(t); nodes.push(el); }
          else if (STRONG.some(p => p.test(t))) nodes.push(el);
          if (nodes.length >= 12) break;
        }
        return hits.length
          ? { ev: [...new Set(hits)].slice(0,4).map(h => `"${h}"`).join(', '), nodes }
          : null;
      }
    },
    {
      id: 'default-page-title', scope: 'page', cat: 'unfinished', weight: 10,
      get label() { return tr('기본 <title> 그대로'); },
      get hint() { return tr('브라우저 탭·검색결과·공유 카드에 전부 노출됩니다. 30초짜리 수정.'); },
      detect(ctx) {
        const t = (ctx.title || '').trim().toLowerCase();
        if (!t) return { ev: tr('<title>이 비어있음') };
        return DEFAULT_TITLES.includes(t) ? { ev: tr`<title>이 "${ctx.title}"` } : null;
      }
    },
    {
      id: 'placeholder-images', cat: 'unfinished', weight: 9,
      get label() { return tr('더미 이미지 서비스 사용'); },
      get hint() { return tr('자리표시자용 이미지 서비스가 연결돼 있습니다. 실제 제품 화면인지 확인하세요. 일반 스톡 사진은 이 규칙에서 제외합니다.'); },
      detect(ctx) {
        const imgs = ctx.query('img');
        const hit = imgs.filter(i => {
          try {
            const host = new URL(i.currentSrc || i.src).hostname;
            return PLACEHOLDER_HOSTS.filter(h => !h.includes('unsplash')).includes(host);
          } catch { return false; }
        });
        if (!hit.length) return null;
        const hosts = [...new Set(hit.map(i => { try { return new URL(i.currentSrc || i.src).host; } catch { return '?'; } }))];
        return { ev: tr`${hit.length}개 (${hosts.join(', ')})`, nodes: hit };
      }
    },
    {
      id: 'missing-favicon', scope: 'page', cat: 'unfinished', weight: 5,
      get label() { return tr('프레임워크 파비콘 경로'); },
      get hint() { return tr('시작 템플릿 이름이 남은 파비콘 경로입니다. 실제 아이콘을 확인해주세요. favicon.ico라는 파일명이나 link 태그 누락만으로 기본 아이콘을 판단하지 않습니다.'); },
      detect(ctx) {
        const l = ctx.doc.querySelector('link[rel~="icon"]');
        if (!l) return null; // /favicon.ico 자동 탐색은 DOM만으로 확인할 수 없다.
        const href = l.getAttribute('href') || '';
        let pathname;
        try { pathname = new URL(href, ctx.doc.baseURI).pathname; } catch { return null; }
        return /\/(vite|next)\.svg$/i.test(pathname) ? { ev: tr`템플릿 이름이 남은 경로: ${pathname}`, } : null;
      }
    },
    {
      id: 'no-meta-description', scope: 'page', cat: 'unfinished', weight: 6,
      get label() { return tr('meta description / OG 태그 없음'); },
      get hint() { return tr('링크를 공유하면 미리보기가 비어서 나옵니다. 유입에 직접 영향.'); },
      detect(ctx) {
        const miss = [];
        if (!ctx.doc.querySelector('meta[name="description"]')) miss.push('description');
        if (!ctx.doc.querySelector('meta[property="og:title"]')) miss.push('og:title');
        if (!ctx.doc.querySelector('meta[property="og:image"]')) miss.push('og:image');
        return miss.length >= 2 ? { ev: tr`누락: ${miss.join(', ')}` } : null;
      }
    },

    /* ═══ 🔧 툴체인 ═════════════════════════════════════════════ */
    {
      id: 'lucide-icons', kind: 'taste', cat: 'toolchain', weight: 6,
      get label() { return tr('24px 선형 아이콘 사용'); },
      get hint() { return tr('여러 아이콘 라이브러리가 같은 SVG 규격을 사용합니다. 이것만으로 Lucide 사용 여부나 AI 생성을 식별할 수 없습니다.'); },
      detect(ctx) {
        const hit = ctx.svgs.filter(s =>
          s.getAttribute('stroke') === 'currentColor' &&
          s.getAttribute('fill') === 'none' &&
          String(s.getAttribute('stroke-width')) === '2' &&
          (s.getAttribute('viewBox') || '').trim() === '0 0 24 24'
        );
        return hit.length >= 3 ? { ev: tr`24px · stroke-width=2인 선형 SVG ${hit.length}개`, nodes: hit } : null;
      }
    },
    {
      id: 'emoji-as-icons', cat: 'toolchain', weight: 6,
      get label() { return tr('이모지를 아이콘으로 사용'); },
      get hint() { return tr('🚀⚡✨ 는 플랫폼마다 다르게 렌더링되고 디자인 통제가 안 됩니다. 아이콘 세트로 교체하세요.'); },
      detect(ctx) {
        const hit = ctx.els.filter(el => el.children.length === 0 && EMOJI.test(el.textContent || ''));
        return hit.length >= 3 ? { ev: tr`이모지 단독 요소 ${hit.length}개`, nodes: hit } : null;
      }
    },
    {
      id: 'shadcn-defaults', kind: 'taste', cat: 'toolchain', weight: 7,
      get label() { return tr('컴포넌트 라이브러리 속성 사용'); },
      get hint() { return tr('data-slot·Radix 속성은 기능과 접근성을 위한 구현 흔적입니다. 테마 수정 여부나 제작자를 알 수 없으므로 점수에서 제외합니다.'); },
      detect(ctx) {
        const slotEls = ctx.query('[data-slot]');
        const radixEls = ctx.query('[data-radix-collection-item],[data-state][data-orientation]');
        return (slotEls.length + radixEls.length) >= 3
          ? { ev: tr`data-slot ${slotEls.length}개 / Radix 속성 ${radixEls.length}개`, nodes: [...slotEls, ...radixEls].slice(0, 30) } : null;
      }
    },
    {
      id: 'unused-dark-toggle', kind: 'taste', cat: 'toolchain', weight: 3,
      get label() { return tr('아무도 요청 안 한 다크모드 토글'); },
      get hint() { return tr('유지비가 두 배입니다. 실사용 데이터 없으면 v1에서 빼세요.'); },
      detect(ctx) {
        const hit = ctx.query('button,[role="switch"]').filter(el => {
          const s = (el.getAttribute('aria-label') || '') + ' ' + txt(el) + ' ' + (el.className?.baseVal || el.className || '');
          return /dark|theme|모드 전환|다크/i.test(String(s));
        });
        return hit.length ? { ev: tr('테마 토글 존재'), nodes: hit } : null;
      }
    },
  ];

  B.CATS = {
    visual:     { icon: '🎨', get name() { return tr('시각 지문'); },   get desc() { return tr('화면에서 발견한 시각 패턴'); } },
    structure:  { icon: '🧱', get name() { return tr('구조 지문'); },   get desc() { return tr('반복되는 랜딩 구성'); } },
    unfinished: { icon: '🧟', get name() { return tr('미완성 흔적'); }, get desc() { return tr('배포 전 확인할 항목'); } },
    toolchain:  { icon: '🔧', get name() { return tr('툴체인 흔적'); }, get desc() { return tr('아이콘·컴포넌트 패턴'); } },
  };
})();
