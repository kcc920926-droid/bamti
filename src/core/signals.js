/* 밤티 — 시그널 정의
 * 각 시그널은 "AI가 뽑아낸 티"의 단일 증거 하나를 담당한다.
 * detect(ctx) -> null | { ev: string, nodes?: Element[] }
 *
 * cat: visual(시각) | structure(구조) | unfinished(미완성) | toolchain(툴체인)
 * weight: 확신도. unfinished 계열은 취향이 아니라 결함이라 가중치가 높다.
 */
(() => {
  const B = (globalThis.BAMTI ||= {});

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

  /* ── 시그널 ───────────────────────────────────────────────────── */
  B.SIGNALS = [

    /* ═══ 🎨 시각 ═══════════════════════════════════════════════ */
    {
      id: 'gradient-text-heading', cat: 'visual', weight: 10,
      label: '그라디언트 텍스트 헤드라인',
      hint: 'AI 생성 랜딩페이지에서 가장 흔한 단일 지문입니다. 헤드라인은 단색으로 두고, 강조가 필요하면 한 단어에만 색을 주세요.',
      detect(ctx) {
        const hit = ctx.els.filter(el => {
          if (!/^H[1-3]$/.test(el.tagName) && !el.querySelector?.('span')) return false;
          const cs = ctx.cs(el);
          return cs.backgroundClip === 'text' || cs.webkitBackgroundClip === 'text';
        });
        return hit.length ? { ev: `${hit.length}개 요소가 background-clip:text 그라디언트`, nodes: hit } : null;
      }
    },
    {
      id: 'purple-blue-gradient', cat: 'visual', weight: 10,
      label: '보라→파랑 그라디언트',
      hint: '2023년 이후 AI 생성 페이지의 사실상 기본값입니다. 브랜드 컬러 하나를 정하고 그 명도 변주로 대체하세요.',
      detect(ctx) {
        const hit = ctx.els.filter(el => {
          const bg = ctx.cs(el).backgroundImage;
          if (!bg || !bg.includes('gradient')) return false;
          const cs = allRgb(bg);
          return cs.some(isPurple) && cs.some(c => isBlue(c) || isPink(c));
        });
        return hit.length ? { ev: `${hit.length}개 요소에 보라-파랑/핑크 그라디언트`, nodes: hit } : null;
      }
    },
    {
      id: 'tailwind-stock-palette', cat: 'visual', weight: 8,
      label: 'Tailwind 기본 팔레트 그대로',
      hint: '팔레트를 한 번도 커스텀하지 않았다는 뜻입니다. 브랜드 색 1개만 정의해도 인상이 완전히 달라집니다.',
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
        return { ev: `유채색 ${used.size}종 중 ${stock.length}종이 Tailwind 기본값 (${Math.round(ratio*100)}%)`, nodes };
      }
    },
    {
      id: 'no-custom-typeface', scope: 'page', cat: 'visual', weight: 6,
      label: '커스텀 폰트 없음 (Inter/시스템 폰트만)',
      hint: '제목용 폰트 하나만 바꿔도 "템플릿 느낌"이 크게 줄어듭니다.',
      detect(ctx) {
        const fams = new Set();
        for (const el of ctx.els.slice(0, 1200)) {
          const f = ctx.cs(el).fontFamily.split(',')[0].replace(/["']/g,'').trim().toLowerCase();
          if (f) fams.add(f);
        }
        const generic = /^(inter|ui-sans-serif|system-ui|-apple-system|blinkmacsystemfont|segoe ui|roboto|helvetica|arial|sans-serif|geist)$/;
        const custom = [...fams].filter(f => !generic.test(f));
        return custom.length === 0
          ? { ev: `사용 폰트 전부 기본 스택 (${[...fams].slice(0,3).join(', ')})` }
          : null;
      }
    },
    {
      id: 'single-radius', cat: 'visual', weight: 5,
      label: '모든 모서리 반경이 동일',
      hint: '카드·버튼·입력창이 전부 같은 radius면 시각적 위계가 사라집니다. 최소 2단계로 나누세요.',
      detect(ctx) {
        const radii = ctx.els
          .map(el => ctx.cs(el).borderTopLeftRadius)
          .filter(r => r && r !== '0px' && !r.includes('%'));
        if (radii.length < 8) return null;
        const m = mode(radii);
        if (m.count / m.total < .8) return null;
        const nodes = ctx.els.filter(el => ctx.cs(el).borderTopLeftRadius === m.value && el.offsetWidth > 40).slice(0, 24);
        return { ev: `둥근 요소 ${m.total}개 중 ${m.count}개가 ${m.value}`, nodes };
      }
    },
    {
      id: 'everything-centered', cat: 'visual', weight: 5,
      label: '모든 것이 가운데 정렬',
      hint: '히어로만 센터로 두고 나머지 섹션은 좌측 정렬로 바꾸면 리듬이 생깁니다.',
      detect(ctx) {
        const blocks = ctx.els.filter(el => el.offsetHeight > 200 && el.children.length >= 2);
        if (blocks.length < 3) return null;
        const c = blocks.filter(el => ctx.cs(el).textAlign === 'center');
        return c.length / blocks.length >= .6
          ? { ev: `주요 블록 ${blocks.length}개 중 ${c.length}개가 text-align:center`, nodes: c }
          : null;
      }
    },

    {
      id: 'eyebrow-microlabel', kind: 'taste', cat: 'visual', weight: 7,
      label: '올캡스 자간 마이크로 레이블 (eyebrow)',
      hint: '"INTERFACE INVENTORY · 2026" 류의 장식 레이블입니다. 정보를 거의 안 나르면서 헤드라인의 첫인상을 가로막습니다. 지우고 헤드라인부터 시작하세요. 꼭 필요한 정보면 헤드라인이나 본문 안으로 넣으세요.',
      detect(ctx) {
        // 시맨틱 라벨은 장식이 아니라 라벨링이다 — 제외
        const SEMANTIC = /^(DT|TH|LABEL|LEGEND|CAPTION|OPTION|TIME|KBD)$/;
        // <span class="kicker"><i></i>TEXT</span> 처럼 장식용 빈 자식은 허용
        const leafish = el => el.children.length === 0
          || [...el.children].every(c => !(c.textContent || '').trim());

        // eyebrow의 정의적 특징: "바로 뒤에 헤딩이 온다"
        const headingAfter = el => {
          let nx = el.nextElementSibling;
          if (!nx && el.parentElement && el === el.parentElement.lastElementChild)
            nx = el.parentElement.nextElementSibling;
          return nx && /^H[1-3]$/.test(nx.tagName) ? nx : null;
        };

        const micro = [], eyebrows = [];
        for (const el of ctx.els) {
          if (SEMANTIC.test(el.tagName) || !leafish(el)) continue;
          const t = (el.textContent || '').trim();
          if (!t || t.length > 42 || /^[\d,.]+$/.test(t)) continue;
          if (/^h[1-6]$/i.test(t)) continue;            // 타이포 견본의 "H1" 라벨

          const cs = ctx.cs(el);
          const fs = parseFloat(cs.fontSize) || 16;
          if (fs > 15) continue;                                   // 마이크로 사이즈만

          const ls = parseFloat(cs.letterSpacing);
          const spaced = !isNaN(ls) && ls / fs >= 0.04;            // 자간 4% 이상
          const upper  = cs.textTransform === 'uppercase'
                      || (/[A-Za-z]/.test(t) && t === t.toUpperCase());
          if (!spaced && !upper) continue;
          micro.push(el);

          const h = headingAfter(el);
          if (!h) continue;
          // 크기 대비가 없으면 eyebrow가 아니라 그냥 소제목이다
          if ((parseFloat(ctx.cs(h).fontSize) || 16) / fs < 1.6) continue;
          eyebrows.push({ el, t });
        }

        if (eyebrows.length < 2) return null;
        const sample = eyebrows.slice(0, 3).map(e => `"${e.t.slice(0, 26)}"`).join(', ');
        const rest = micro.length - eyebrows.length;
        return {
          ev: `헤드라인 위 ${eyebrows.length}개 — ${sample}`
              + (rest > 0 ? ` · 마이크로 레이블 ${rest}개는 헤딩 앞이 아니라 제외` : ''),
          nodes: eyebrows.map(e => e.el),
        };
      }
    },
    {
      id: 'headline-terminal-period', kind: 'taste', cat: 'visual', weight: 5,
      label: '대제목 끝 마침표',
      hint: '"Small parts. Clear systems." 처럼 짧은 대제목에 찍는 마침표는 편집디자인 흉내로 읽힙니다. 헤드라인은 문장이 아니라 표지라서 종지부가 필요 없습니다. 빼세요.',
      detect(ctx) {
        const ABBR = /\b(inc|ltd|co|corp|etc|vs|jr|sr|dr|mr|ms|st|no|ex|e\.g|i\.e)\.$/i;
        const hits = [];
        for (const h of ctx.doc.querySelectorAll('h1')) {   // 대제목만 — h2 소제목은 문장일 수 있다
          const t = (h.innerText || h.textContent || '').replace(/\s+/g, ' ').trim();
          if (!t || t.length > 80) continue;
          if (!/[.．。]$/.test(t) || /\.{2,}$/.test(t) || ABBR.test(t)) continue;

          // 이 장치의 핵심형: 짧은 조각을 마침표로 끊어 나열
          const frags = t.split(/[.．。]\s*/).filter(Boolean);
          const isStacked = frags.length >= 2 && frags.every(f => f.length <= 30);
          const isTerse   = t.length <= 30;
          if (!isStacked && !isTerse) continue;             // 완결된 문장형 헤드라인은 통과

          hits.push(t);
        }
        if (!hits.length) return null;
        return {
          ev: hits.slice(0, 3).map(t => `"${t.slice(0, 34)}"`).join(', ')
              + (hits.length > 3 ? ` 외 ${hits.length - 3}개` : ''),
          nodes: [...ctx.doc.querySelectorAll('h1')].filter(h =>
            hits.includes((h.innerText || h.textContent || '').replace(/\s+/g, ' ').trim())),
        };
      }
    },

    {
      id: 'value-sprawl', cat: 'visual', weight: 9,
      label: '토큰만 있고 시스템은 없음',
      hint: '디자인 시스템의 외형은 갖췄는데 값이 컴포넌트마다 새로 만들어집니다. 사람이 만든 디자인시스템(Polaris·Atlassian·Bootstrap)은 글자 크기를 4~11종으로 끝냅니다. 쓰이는 값을 세어보고 스케일로 묶으세요 — 크기 6단계, 반경 3단계, 그림자 3단계면 충분합니다.',
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
        return { ev: over.map(c => `${c.k} ${c.v}종`).join(' · ') + ` (기준 초과 ${over.length}/4)`, nodes: [...new Set(nodes)] };
      }
    },
    {
      id: 'typeface-sprawl', cat: 'visual', weight: 6,
      label: '폰트 패밀리 3종 이상',
      hint: '실제 제품은 라이선스 비용과 로딩 성능 때문에 서체 하나에 커밋합니다 (Stripe·Basecamp는 1종). 본문 하나로 줄이고, 강조가 필요하면 굵기와 크기로 만드세요.',
      detect(ctx) {
        const GENERIC = /^(ui-sans-serif|ui-serif|ui-monospace|system-ui|-apple-system|blinkmacsystemfont|sans-serif|serif|monospace|inherit|initial)$/;
        const fams = new Map();   // family → 표본 요소
        for (const el of ctx.els) {
          const f = ctx.cs(el).fontFamily.split(',')[0].replace(/["']/g, '').trim().toLowerCase();
          if (f && !GENERIC.test(f) && !fams.has(f) && (el.textContent || '').trim().length > 3) fams.set(f, el);
        }
        return fams.size >= 3
          ? { ev: `${fams.size}종 — ${[...fams.keys()].slice(0, 4).join(', ')}`, nodes: [...fams.values()] }
          : null;
      }
    },

    /* ═══ 🧱 구조 ═══════════════════════════════════════════════ */
    {
      id: 'three-col-feature-grid', cat: 'structure', weight: 7,
      label: '3열 기능 그리드 (아이콘+제목+2줄)',
      hint: '기능이 정말 3개라서 3개인지 확인하세요. 보통은 레이아웃이 개수를 정한 경우입니다.',
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
        return hit.length ? { ev: `3열 기능 그리드 ${hit.length}개`, nodes: hit } : null;
      }
    },
    {
      id: 'uniform-section-rhythm', cat: 'structure', weight: 7,
      label: '모든 섹션의 상하 여백이 동일',
      hint: '섹션마다 중요도가 다른데 여백이 같으면 전부 똑같이 안 중요해 보입니다.',
      detect(ctx) {
        const secs = ctx.els.filter(el =>
          (el.tagName === 'SECTION' || el.parentElement?.tagName === 'MAIN' || el.parentElement === ctx.doc.body)
          && el.offsetHeight > 240
        );
        if (secs.length < 3) return null;
        const pads = secs.map(el => ctx.cs(el).paddingTop);
        const m = mode(pads.filter(p => p !== '0px'));
        return m.count >= 3 && m.count / secs.length >= .55
          ? { ev: `섹션 ${secs.length}개 중 ${m.count}개가 padding-top:${m.value}`, nodes: secs }
          : null;
      }
    },
    {
      id: 'canonical-section-order', cat: 'structure', weight: 8,
      label: '정석 랜딩페이지 순서 (Features→Pricing→FAQ)',
      hint: '이 순서 자체가 나쁘진 않지만, 방문자가 실제로 궁금해하는 순서인지 다시 보세요.',
      detect(ctx) {
        const seq = ['features','기능','how it works','작동','pricing','요금','가격','testimonial','후기','faq','자주'];
        const found = [], nodes = [];
        for (const h of ctx.doc.querySelectorAll('h2,h3')) {
          const t = txt(h);
          const i = seq.findIndex(s => t.includes(s));
          if (i >= 0) { found.push(seq[i]); nodes.push(h); }
        }
        const uniq = [...new Set(found)];
        return uniq.length >= 3 ? { ev: `정석 섹션 ${uniq.length}종 발견: ${uniq.join(' → ')}`, nodes } : null;
      }
    },
    {
      id: 'three-tier-pricing', cat: 'structure', weight: 6,
      label: '3단 요금제 + 가운데 "인기"',
      hint: '실제 가격 정책이 정해지기 전이라면 요금 섹션은 아예 빼는 편이 신뢰에 낫습니다.',
      detect(ctx) {
        const t = ctx.text;
        if (!/pricing|요금|가격/.test(t)) return null;
        const re = /most popular|가장 인기|추천|인기|best value|recommended/i;
        if (!re.test(t)) return null;
        const nodes = ctx.els.filter(el => el.children.length === 0 && re.test(el.textContent || '') && (el.textContent || '').length < 40).slice(0, 6);
        return { ev: '요금 섹션에 "인기/추천" 뱃지 패턴', nodes };
      }
    },
    {
      id: 'hero-badge-pill', cat: 'structure', weight: 5,
      label: '히어로 상단 알약 뱃지',
      hint: '"✨ Introducing…" 뱃지는 실제 공지가 있을 때만 쓰세요.',
      detect(ctx) {
        const h1 = ctx.doc.querySelector('h1');
        if (!h1) return null;
        const near = [...(h1.parentElement?.children || [])].filter(el => el !== h1);
        const hit = near.filter(el => {
          const cs = ctx.cs(el);
          const t = txt(el);
          return parseFloat(cs.borderTopLeftRadius) >= 999 && t.length > 0 && t.length < 60;
        });
        return hit.length ? { ev: `히어로 상단 알약 요소: "${txt(hit[0]).slice(0,40)}"`, nodes: hit } : null;
      }
    },
    {
      id: 'fake-social-proof', cat: 'structure', weight: 7,
      label: '검증 불가능한 사회적 증거',
      hint: '"10,000+ 팀이 사용" 같은 숫자는 출처 링크가 없으면 오히려 신뢰를 깎습니다. 실제 고객 1곳이 낫습니다.',
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
      label: '무색무취 CTA 문구',
      hint: 'CTA는 "무엇을 얻는지"를 써야 합니다. "지금 시작하기" → "무료로 첫 리포트 받기".',
      detect(ctx) {
        const btns = [...ctx.doc.querySelectorAll('a,button')]
          .filter(el => GENERIC_CTA.some(g => txt(el) === g || txt(el).replace(/\s+/g,'') === g.replace(/\s+/g,'')));
        return btns.length
          ? { ev: `${btns.length}개: ${[...new Set(btns.map(b => txt(b)))].slice(0,3).join(' / ')}`, nodes: btns }
          : null;
      }
    },

    /* ═══ 🧱 구성 — 일반 페이지의 조립 방식 지문 ═══════════════════ */
    {
      id: 'section-template-repeat', cat: 'structure', weight: 6,
      label: '같은 틀의 섹션 반복 (제목 + 설명 + 카드 그리드)',
      hint: '섹션 3개 이상이 "h2 → p → 카드 그리드" 같은 동일한 틀입니다. 내용이 틀을 정한 게 아니라 틀에 내용을 부은 흔적이에요. 섹션마다 정보의 형태에 맞는 레이아웃을 고르세요 — 표, 한 장의 큰 이미지, 긴 글, 비교.',
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
        return { ev: `섹션 ${arr.length}개가 같은 틀 (${k.replace(/\+/g, ' + ')})`, nodes: arr };
      }
    },
    {
      id: 'card-clones', cat: 'structure', weight: 6,
      label: '내용까지 균일한 카드 클론',
      hint: '카드들의 구조가 같은 건 정상이지만, 글자 수까지 거의 같으면 내용이 채워 넣은 필러라는 뜻입니다. 실제 정보는 길이가 들쭉날쭉합니다. 카드마다 진짜 말할 게 있는지 확인하고, 없으면 카드 수를 줄이세요.',
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
        return { ev: `카드 ${nodes.length}개(${sets}묶음)가 구조·글자 수까지 균일`, nodes: nodes.slice(0, 30) };
      }
    },
    {
      id: 'cta-banner', cat: 'structure', weight: 6,
      label: '푸터 직전 CTA 배너 섹션',
      hint: '"Ready to get started?" 배너는 모든 생성 페이지의 마지막 섹션입니다. 있어야 한다면 이 페이지에서만 할 수 있는 약속을 쓰세요. 아니면 빼고 푸터를 바로 붙이세요.',
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
        return hit.length ? { ev: `강조 배경 + 가운데 정렬 + 버튼: "${txt(hit[0].querySelector('h2,h3')).slice(0, 40)}"`, nodes: hit } : null;
      }
    },
    {
      id: 'icon-circle-badges', cat: 'toolchain', weight: 6,
      label: '아이콘을 담은 원형 배지',
      hint: '연한 배경의 원 안에 선 아이콘 — 생성 UI 기능 카드의 시그니처입니다. 아이콘을 원에서 꺼내 텍스트와 나란히 두거나, 아이콘 대신 실제 화면 조각을 쓰세요.',
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
        return hit.length >= 3 ? { ev: `원형 아이콘 배지 ${hit.length}개`, nodes: hit } : null;
      }
    },
    {
      id: 'no-real-images', scope: 'page', cat: 'structure', weight: 7,
      label: '실사 이미지가 한 장도 없음',
      hint: '마케팅 페이지인데 사진·스크린샷이 없고 아이콘·그라디언트만 있습니다. 보여줄 실제 제품이 없을 때 나오는 형태예요. 실제 화면 캡처 한 장이 기능 카드 여섯 개보다 설득력 있습니다.',
      detect(ctx) {
        if (!ctx.doc.querySelector('h1')) return null;
        const marketing = [...ctx.doc.querySelectorAll('h2,h3')].some(h => /features|pricing|기능|요금|how it works|작동|testimonial|후기/i.test(txt(h)));
        if (!marketing) return null;
        const secs = ctx.els.filter(el => el.tagName === 'SECTION' || el.parentElement === ctx.doc.body || el.parentElement?.tagName === 'MAIN').filter(el => el.offsetHeight > 200);
        if (secs.length < 3) return null;
        const real = [...ctx.doc.querySelectorAll('img,picture,video,canvas')].filter(el => {
          if (el.tagName === 'IMG' && /^data:image\/svg|\.svg(\?|$)/i.test(el.currentSrc || el.src || '')) return false;
          const r = el.getBoundingClientRect();
          return Math.max(r.width, el.width || 0) >= 120;
        });
        return real.length === 0 ? { ev: `120px 이상 이미지·영상 0개 (섹션 ${secs.length}개, svg/이모지만 사용)` } : null;
      }
    },
    {
      id: 'zigzag-features', cat: 'structure', weight: 5,
      label: '가짜 미디어 지그재그 섹션',
      hint: '이미지-글, 글-이미지를 번갈아 놓는 배치 자체는 흔합니다. 문제는 이미지 자리에 실제 이미지가 아닌 그라디언트 상자나 아이콘이 들어간 것 — 보여줄 게 없어서 배치만 흉내 낸 상태입니다.',
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
        return alternates ? { ev: `지그재그 ${rows.length}단, 미디어 칸이 전부 가짜(그라디언트/아이콘)`, nodes: rows.map(r => r.sec) } : null;
      }
    },

    /* ═══ 🧟 미완성 (취향 아님 — 진짜 결함) ═════════════════════ */
    {
      id: 'dead-links', cat: 'unfinished', weight: 12,
      label: '죽은 링크',
      hint: '방문자가 처음 누르는 링크가 아무 반응 없으면 그 순간 신뢰가 끝납니다. 최우선 수정 대상.',
      detect(ctx) {
        const links = [...ctx.doc.querySelectorAll('a')];
        if (links.length < 5) return null;
        const dead = links.filter(a => {
          const h = a.getAttribute('href');
          return h === null || h === '' || h === '#' || h === 'javascript:void(0)';
        });
        return dead.length / links.length >= .35 || dead.length >= 8
          ? { ev: `링크 ${links.length}개 중 ${dead.length}개가 href="#" 또는 없음`, nodes: dead }
          : null;
      }
    },
    {
      id: 'placeholder-copy', cat: 'unfinished', weight: 12,
      label: '플레이스홀더 문구가 남아있음',
      hint: '실제 배포 전 반드시 제거. 검색엔진에도 그대로 색인됩니다.',
      detect(ctx) {
        // STRONG: 산문에 섞여 나와도 플레이스홀더가 확실한 것
        const STRONG = [/lorem ipsum/i, /\bcompany name\b/i, /\byour name here\b/i,
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
      label: '기본 <title> 그대로',
      hint: '브라우저 탭·검색결과·공유 카드에 전부 노출됩니다. 30초짜리 수정.',
      detect(ctx) {
        const t = (ctx.title || '').trim().toLowerCase();
        if (!t) return { ev: '<title>이 비어있음' };
        return DEFAULT_TITLES.includes(t) ? { ev: `<title>이 "${ctx.title}"` } : null;
      }
    },
    {
      id: 'placeholder-images', cat: 'unfinished', weight: 9,
      label: '스톡/더미 이미지',
      hint: 'Unsplash 사진과 dicebear 아바타는 "아직 진짜 사용자가 없다"는 신호로 읽힙니다.',
      detect(ctx) {
        const imgs = [...ctx.doc.querySelectorAll('img')];
        const hit = imgs.filter(i => PLACEHOLDER_HOSTS.some(h => (i.currentSrc || i.src || '').includes(h)));
        if (!hit.length) return null;
        const hosts = [...new Set(hit.map(i => { try { return new URL(i.currentSrc || i.src).host; } catch { return '?'; } }))];
        return { ev: `${hit.length}개 (${hosts.join(', ')})`, nodes: hit };
      }
    },
    {
      id: 'missing-favicon', scope: 'page', cat: 'unfinished', weight: 5,
      label: '파비콘 없음 / 기본 파비콘',
      hint: '탭에 지구본이나 Vite 로고가 뜹니다. 북마크했을 때 바로 티납니다.',
      detect(ctx) {
        const l = ctx.doc.querySelector('link[rel~="icon"]');
        if (!l) return { ev: '<link rel="icon"> 없음' };
        const href = l.getAttribute('href') || '';
        return /vite\.svg|favicon\.ico$|next\.svg|default/i.test(href) ? { ev: `기본 파비콘: ${href}` } : null;
      }
    },
    {
      id: 'no-meta-description', scope: 'page', cat: 'unfinished', weight: 6,
      label: 'meta description / OG 태그 없음',
      hint: '링크를 공유하면 미리보기가 비어서 나옵니다. 유입에 직접 영향.',
      detect(ctx) {
        const miss = [];
        if (!ctx.doc.querySelector('meta[name="description"]')) miss.push('description');
        if (!ctx.doc.querySelector('meta[property="og:title"]')) miss.push('og:title');
        if (!ctx.doc.querySelector('meta[property="og:image"]')) miss.push('og:image');
        return miss.length >= 2 ? { ev: `누락: ${miss.join(', ')}` } : null;
      }
    },

    /* ═══ 🔧 툴체인 ═════════════════════════════════════════════ */
    {
      id: 'lucide-icons', cat: 'toolchain', weight: 6,
      label: 'Lucide 아이콘 기본 세트',
      hint: '아이콘 자체는 문제없지만, 전부 기본 스트로크 2px 24px면 "붙여넣은 티"가 납니다. 크기·굵기에 변주를 주세요.',
      detect(ctx) {
        const hit = ctx.svgs.filter(s =>
          s.getAttribute('stroke') === 'currentColor' &&
          s.getAttribute('fill') === 'none' &&
          String(s.getAttribute('stroke-width')) === '2' &&
          (s.getAttribute('viewBox') || '').trim() === '0 0 24 24'
        );
        return hit.length >= 3 ? { ev: `Lucide 지문 SVG ${hit.length}개`, nodes: hit } : null;
      }
    },
    {
      id: 'emoji-as-icons', cat: 'toolchain', weight: 6,
      label: '이모지를 아이콘으로 사용',
      hint: '🚀⚡✨ 는 플랫폼마다 다르게 렌더링되고 디자인 통제가 안 됩니다. 아이콘 세트로 교체하세요.',
      detect(ctx) {
        const hit = ctx.els.filter(el => el.children.length === 0 && EMOJI.test(el.textContent || ''));
        return hit.length >= 3 ? { ev: `이모지 단독 요소 ${hit.length}개`, nodes: hit } : null;
      }
    },
    {
      id: 'shadcn-defaults', cat: 'toolchain', weight: 7,
      label: 'shadcn/ui 기본 컴포넌트 그대로',
      hint: '기본 테마를 한 번도 안 건드렸다는 신호입니다. radius·색·그림자만 조정해도 달라 보입니다.',
      detect(ctx) {
        const slotEls = [...ctx.doc.querySelectorAll('[data-slot]')];
        const radixEls = [...ctx.doc.querySelectorAll('[data-radix-collection-item],[data-state][data-orientation]')];
        return (slotEls.length + radixEls.length) >= 3
          ? { ev: `data-slot ${slotEls.length}개 / Radix 속성 ${radixEls.length}개`, nodes: [...slotEls, ...radixEls].slice(0, 30) } : null;
      }
    },
    {
      id: 'unused-dark-toggle', kind: 'taste', cat: 'toolchain', weight: 3,
      label: '아무도 요청 안 한 다크모드 토글',
      hint: '유지비가 두 배입니다. 실사용 데이터 없으면 v1에서 빼세요.',
      detect(ctx) {
        const hit = [...ctx.doc.querySelectorAll('button,[role="switch"]')].filter(el => {
          const s = (el.getAttribute('aria-label') || '') + ' ' + txt(el) + ' ' + (el.className?.baseVal || el.className || '');
          return /dark|theme|모드 전환|다크/i.test(String(s));
        });
        return hit.length ? { ev: '테마 토글 존재', nodes: hit } : null;
      }
    },
  ];

  B.CATS = {
    visual:     { icon: '🎨', name: '시각 지문',   desc: 'AI 기본 스타일 그대로' },
    structure:  { icon: '🧱', name: '구조 지문',   desc: '템플릿 레이아웃 답습' },
    unfinished: { icon: '🧟', name: '미완성 흔적', desc: '취향 아님 — 실제 결함' },
    toolchain:  { icon: '🔧', name: '툴체인 흔적', desc: '생성 도구 기본값' },
  };
})();
