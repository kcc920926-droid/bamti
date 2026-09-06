/* 렌더링 결과 특징 추출기 — 익스텐션이 실제로 볼 수 있는 것만 측정 */
(() => {
  const els = [...document.body.querySelectorAll('*')];
  const cs = new WeakMap();
  const S = el => { let v = cs.get(el); if (!v) { v = getComputedStyle(el); cs.set(el, v); } return v; };
  const uniq = a => [...new Set(a)];
  const num = s => parseFloat(s) || 0;

  // 같은 출처 스타일시트에서 CSS 소스 특징 (dev 서버에서는 읽힌다)
  let rules = 0, customProps = 0, mediaQueries = 0, keyframes = 0, sheetsRead = 0;
  for (const sh of document.styleSheets) {
    let rs; try { rs = sh.cssRules; } catch { continue; }
    sheetsRead++;
    const walk = list => { for (const r of list) {
      rules++;
      if (r.type === 4) { mediaQueries++; if (r.cssRules) walk(r.cssRules); }
      else if (r.type === 7) keyframes++;
      else if (r.style) for (const p of r.style) if (p.startsWith('--')) customProps++;
    }};
    walk(rs);
  }

  const fs   = uniq(els.map(e => S(e).fontSize));
  const fams = uniq(els.map(e => S(e).fontFamily.split(',')[0].replace(/["']/g,'').trim().toLowerCase()));
  const radii= uniq(els.map(e => S(e).borderTopLeftRadius).filter(r => r && r !== '0px'));
  const pads = uniq(els.flatMap(e => [S(e).paddingTop, S(e).paddingLeft]).filter(p => p && p !== '0px'));
  const weights = uniq(els.map(e => S(e).fontWeight));
  const ls = els.filter(e => { const v = num(S(e).letterSpacing); return v !== 0; });
  const trans = els.filter(e => S(e).transitionDuration !== '0s');
  const classed = els.filter(e => (e.className || '').toString().trim());
  const classNames = uniq(classed.flatMap(e => e.className.toString().split(/\s+/))).filter(Boolean);

  const bem = classNames.filter(c => /__|--/.test(c)).length;
  const util = classNames.filter(c => /^(m|p)[trblxy]?-\d|^(flex|grid|text|bg|w|h)-/.test(c)).length;

  const depth = (() => { let m = 0; for (const e of els) { let d = 0, n = e; while (n && n !== document.body) { d++; n = n.parentElement; } m = Math.max(m, d); } return m; })();

  return {
    dom: els.length, depth,
    fontSizes: fs.length, fontFamilies: fams.length, families: fams.slice(0, 4),
    weights: weights.length, radii: radii.length, paddings: pads.length,
    letterSpaced: ls.length, transitions: trans.length,
    svg: document.querySelectorAll('svg').length,
    aria: els.filter(e => [...e.attributes].some(a => a.name.startsWith('aria-'))).length,
    semantic: ['main','section','article','nav','aside','header','footer','figure','dl']
              .filter(t => document.querySelector(t)).length,
    classRatio: Math.round(classed.length / Math.max(els.length,1) * 100),
    classNames: classNames.length, bem, util,
    rules, customProps, mediaQueries, keyframes, sheetsRead,
    darkTheme: !!document.querySelector('[data-theme],[class*="dark"]'),
  };
})()
