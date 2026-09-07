// Self-contained SVG architecture sources. No images, web fonts or runtime scripts.
// node docs/architecture/build.mjs --write    regenerate the four SVGs
// node docs/architecture/build.mjs --check    detect generated-file drift
// Default: print a JSON map, useful for patch-based regeneration.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const xml = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;' }[c]));

const copy = {
  ko: {
    title: '밤티, 어떻게 작동하나요?',
    analogy: ['검사관처럼 페이지를 살피고,', '고칠 곳에 포스트잇을 붙입니다.'],
    declaration: '코드에 있음: Chrome MV3 + 선택형 로컬 MCP',
    notRunning: '설치·실행은 별도 · 실제 사용자 연결 상태는 미확인',
    flow: '01 / 페이지에서 개선 방향까지',
    boundary: '현재 컴퓨터 · 검사에는 외부 추론 서버가 필요 없음',
    page: ['원본 · 현재 웹페이지', '내 사이트 / 다른 사이트 / 로컬 HTML', '렌더링된 DOM을 읽고, 원본은 수정하지 않음'],
    trigger: '아이콘 / 단축키',
    collect: ['요청 · 패널 → 주입 스캐너', '서비스 워커가 패널을 열고, 패널이 검사를 요청', 'activeTab 또는 허용한 출처 · 숨겨진 DOM 제외'],
    dom: '같은 DOM, 서로 다른 검사',
    ui: ['UI 검사', '24종 점수 규칙 + 10종 참고', '가중치 점수 ≠ AI 생성 확률'],
    prose: ['한·영 문체 검사', '한국어 13패턴 / 영어 39규칙', '반복·밀집만 검토 · UI 점수 제외'],
    report: ['결과 · 사이드패널 + 하이라이트', '근거 → 개선 방향 → 해당 요소 / 문단 표시', '전체 리포트: score · signals · taste · prose'],
    ws: '직접 켠 경우만 · WebSocket',
    mcp: ['선택 · 로컬 MCP 서버', '127.0.0.1:8765 · 토큰 인증', '마지막 리포트는 메모리에만'],
    stdio: 'MCP / stdio ↔',
    agent: ['선택 · 개발 에이전트', '스캔 요청 ↔ 리포트 조회', '소스 수정은 에이전트 역할'],
    loop: ['수정 후 새로고침 → 패널 재검사', '패널이 열려 있고 접근 권한이 있을 때'],
    storageTitle: '데이터의 주인',
    storage: ['원본: 웹페이지 / 프로젝트 파일', '설정: Chrome storage · 토큰 파일', '파생 결과: 패널 / MCP 메모리, 영구 DB 없음'],
    privacy: ['MCP 연결 시 원문·HTML 일부도 리포트로 전달됩니다.', '그 뒤 모델로 보내는지는 연결한 에이전트 설정에 따릅니다.'],
    strengthsTitle: '02 / 잘 나눈 경계',
    strengths: [
      ['로컬 우선', '계정·LLM 없이 기본 검사'],
      ['점수 분리', '취향·문체로 UI 점수 부풀리지 않음'],
      ['권한 범위', '클릭 또는 사용자가 허용한 출처'],
    ],
    risksTitle: '03 / 지금 알아둘 한계',
    risks: [
      ['표현 제안 ≠ AI 작성 판정', '문맥 확인 항목은 수정이 필수가 아님'],
      ['리포트는 메모리 스냅샷', '재시작 시 소실 · 연결 해제 시 오래될 수 있음'],
      ['6자리 HEX 기본 토큰', '요청 제한도 없어 인증 보강 필요'],
    ],
    nextTitle: '04 / 다음 세 가지',
    next: ['1  MCP 인증 길이·연결 제한 강화', '2  낡은 리포트 표시 보강', '3  실제 연결·단축키 + 장르별 오탐 검증'],
    planned: ['계획만 있음 · LLM 정밀 분석 / OAuth', '현재 실행 경로와 연결되지 않음'],
    proof: ['관찰: 문체 121 / UI 정밀 31 검사 통과', 'MCP 모의 왕복 확인 · 실제 에이전트 연결은 미검증'],
    footer: '로컬 소스 · 확인 2026-09-07 · 실선: 코드 경로 / 점선: 계획',
  },
  en: {
    title: 'How Bamti works',
    analogy: ['An inspector for your page,', 'with sticky notes where you can improve.'],
    declaration: 'In code: Chrome MV3 + optional local MCP',
    notRunning: 'Setup required · your live agent connection is not verified',
    flow: '01 / From a page to useful feedback',
    boundary: 'This computer · no external inference server needed to scan',
    page: ['Source · current web page', 'Your site / another site / local HTML', 'Reads rendered DOM; does not edit the original'],
    trigger: 'Click / shortcut',
    collect: ['Request · panel → injected scanner', 'The worker opens the panel; the panel requests a scan', 'activeTab or an allowed origin · hidden DOM excluded'],
    dom: 'One DOM, two kinds of checks',
    ui: ['UI checks', '24 scored rules + 10 references', 'Pattern score ≠ AI probability'],
    prose: ['Writing-style checks', 'Korean: 13 / English: 39 rules', 'Repetition & clusters · not scored'],
    report: ['Result · side panel + highlights', 'Evidence → suggestion → element / paragraph location', 'Full report: score · signals · taste · prose'],
    ws: 'Explicit opt-in · WebSocket',
    mcp: ['Optional · local MCP server', '127.0.0.1:8765 · token auth', 'Latest report held in memory'],
    stdio: 'MCP / stdio ↔',
    agent: ['Optional · coding agent', 'Request scans ↔ read reports', 'The agent edits source files'],
    loop: ['Edit, then reload → panel rescans', 'Requires an open panel and page access'],
    storageTitle: 'Who owns the data?',
    storage: ['Source: web page / project files', 'Settings: Chrome storage · token file', 'Derived: panel / MCP memory; no persistent database'],
    privacy: ['MCP reports also carry excerpts of page text and HTML.', 'Any onward model sharing depends on the agent configuration.'],
    strengthsTitle: '02 / Sound boundaries',
    strengths: [
      ['Local first', 'Basic checks need no account or LLM'],
      ['Separate scores', 'Taste and prose never inflate UI scores'],
      ['Scoped access', 'A click, or origins the user allows'],
    ],
    risksTitle: '03 / Know the current limits',
    risks: [
      ['Wording advice ≠ AI verdict', 'Context checks do not require edits'],
      ['Reports are memory snapshots', 'Lost on restart; may be stale after disconnect'],
      ['Default token: 6 hex digits', 'No attempt limit; authentication needs hardening'],
    ],
    nextTitle: '04 / Next, in order',
    next: ['1  Harden MCP tokens and connection limits', '2  Mark stale reports clearly', '3  Test live setup, shortcuts & genre false positives'],
    planned: ['Planned only · LLM review / OAuth', 'Not connected to the current execution path'],
    proof: ['Observed: 121 prose / 31 UI precision checks passed', 'Mock MCP round trips; live agent setup not verified'],
    footer: 'Local source · 2026-09-07 · Solid: code / dashed: planned',
  },
};

function make(lang, mobile) {
  const c = copy[lang], W = mobile ? 360 : 736, pad = mobile ? 16 : 24;
  const inner = W - pad * 2, font = mobile ? 13 : 14, line = mobile ? 19 : 21;
  const prefix = 'bamti-' + lang + (mobile ? '-m' : '-d');
  const out = [];
  const text = (x, y, value, cls = '', size = font) => {
    size = Math.max(size, font);
    const lines = Array.isArray(value) ? value : [value];
    out.push('<text x="' + x + '" y="' + y + '" class="' + cls + '" font-size="' + size + '">' +
      lines.map((s, i) => '<tspan x="' + x + '" dy="' + (i ? line : 0) + '">' + xml(s) + '</tspan>').join('') + '</text>');
  };
  // Conservative font-independent wrap; layout tests measure the actual glyphs.
  const wrap = (s, width, size = font) => {
    size = Math.max(size, font);
    const parts = [], tokens = s.match(/[가-힣]|[^\s가-힣]+|\s+/g) || [];
    let row = '', used = 0;
    for (const token of tokens) {
      const n = [...token].reduce((a, v) => a + (/[가-힣]/.test(v) ? size : size * 0.54), 0);
      if (used + n > width && row) { parts.push(row.trim()); row = ''; used = 0; }
      row += token; used += n;
    }
    if (row.trim()) parts.push(row.trim());
    return parts;
  };
  const rect = (x,y,w,h,cls='node',rx=12) => out.push('<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+rx+'" class="'+cls+'"/>');
  const pathLine = (d, both = false) => out.push('<path d="'+d+'" class="edge" '+(both?'marker-start="url(#'+prefix+'-arrow)" ':'')+'marker-end="url(#'+prefix+'-arrow)"/>');
  const node = (x,y,w,contents,cls='node') => {
    const title = wrap(contents[0], w-32, mobile ? 16 : 17);
    const body = contents.slice(1).flatMap(s => wrap(s,w-32));
    const h = 30 + title.length * line + body.length * line + 10;
    out.push('<g data-box="'+x+','+y+','+w+','+h+'">');
    rect(x,y,w,h,cls);
    text(x+16,y+28,title,'node-title',mobile?16:17);
    text(x+16,y+28+title.length*line+6,body,'secondary');
    out.push('</g>');
    return h;
  };
  const section = (y, title) => { text(pad,y,title,'section',15); };
  const down = (x,y,to,label,both = false) => {
    pathLine('M '+x+' '+y+' V '+to, both);
    if (label) {
      const labelWidth = Math.min(inner, mobile ? 242 : 310);
      rect(x-labelWidth/2,y+(to-y)/2-14,labelWidth,23,'label-bg',0);
      text(x,y+(to-y)/2+2,label,'edge-label',12);
    }
  };
  text(pad,30,'BAMTI / ARCHITECTURE','kicker',12);
  text(pad,70,c.title,'headline',mobile?25:34);
  text(pad,103,c.analogy,'secondary',mobile?14:16);
  let y = 150;
  const declared = wrap(c.declaration, inner-24);
  const undeployed = wrap(c.notRunning, inner-24, 12);
  const stateH = 25 + (declared.length+undeployed.length)*line;
  rect(pad,y,inner,stateH,'state');
  text(pad+12,y+23,declared,'accent');
  text(pad+12,y+23+declared.length*line+3,undeployed,'secondary',12);
  y += stateH+34;
  section(y,c.flow); y += 23;
  const boundaryLines = wrap(c.boundary,inner,12);
  text(pad,y,boundaryLines,'secondary',12); y += boundaryLines.length*line+12;
  const flowStart = y;
  const nx = pad+12, nw = inner-24, cx=W/2;
  const pageH=node(nx,y,nw,c.page,'source');
  y+=pageH; down(cx,y,y+46,c.trigger); y+=46;
  const collectH=node(nx,y,nw,c.collect);
  y+=collectH;
  if (mobile) {
    down(cx,y,y+46,c.dom); y+=46;
    const engineY=y;
    y+=12;
    const h1=node(nx+10,y,nw-20,c.ui); y+=h1+12;
    const h2=node(nx+10,y,nw-20,c.prose); y+=h2+12;
    // Both checks share a container; there is no serial engine-to-engine arrow.
    rect(nx,engineY,nw,y-engineY,'boundary',12);
    down(cx,y,y+28); y+=28;
  } else {
    const gap=20, col=(nw-gap)/2, left=nx+col/2, right=nx+col+gap+col/2;
    pathLine('M '+cx+' '+y+' V '+(y+40)+' H '+left+' V '+(y+58));
    pathLine('M '+cx+' '+(y+40)+' H '+right+' V '+(y+58));
    rect(cx-155,y+8,310,23,'label-bg',0);
    text(cx,y+26,c.dom,'edge-label',12);
    y+=58;
    const h1=node(nx,y,col,c.ui), h2=node(nx+col+gap,y,col,c.prose);
    y+=Math.max(h1,h2);
    out.push('<path class="edge" d="M '+left+' '+y+' V '+(y+18)+' H '+right+' V '+y+'"/>');
    down(cx,y+18,y+38); y+=38;
  }
  const reportH=node(nx,y,nw,c.report,'source'); y+=reportH;
  if (mobile) down(cx,y,y+48,c.ws,true);
  else {
    const serverCenter=nx+(nw-100)/4;
    pathLine('M '+cx+' '+y+' V '+(y+33)+' H '+serverCenter+' V '+(y+48),true);
    rect(cx-155,y+5,310,23,'label-bg',0);
    text(cx,y+22,c.ws,'edge-label',12);
  }
  y+=48;
  if (mobile) {
    y+=node(nx,y,nw,c.mcp);
    down(cx,y,y+44,c.stdio,true); y+=44;
    y+=node(nx,y,nw,c.agent);
  } else {
    const col=(nw-100)/2;
    const hm=node(nx,y,col,c.mcp), ha=node(nx+col+100,y,col,c.agent);
    pathLine('M '+(nx+col)+' '+(y+hm/2)+' H '+(nx+col+100),true);
    text(cx,y+hm/2-12,'stdio ↔','edge-label',12);
    y+=Math.max(hm,ha);
  }
  text(cx,y+25,c.loop,'center secondary',12); y+=62;
  // The local boundary encloses page/extension and optional server/agent, not a cloud provider.
  out.unshift('<rect x="'+pad+'" y="'+(flowStart-8)+'" width="'+inner+'" height="'+(y-flowStart+5)+'" rx="16" class="boundary"/>');
  y+=20;
  text(pad,y,c.storageTitle,'node-title',16); y+=26;
  const storage=c.storage.flatMap(s=>wrap(s,inner));
  text(pad,y,storage,'secondary'); y+=storage.length*line+10;
  const privacy=c.privacy.flatMap(s=>wrap(s,inner,12));
  text(pad,y,privacy,'accent',12); y+=privacy.length*line+32;
  section(y,c.strengthsTitle); y+=27;
  if (mobile) {
    for (const [title,body] of c.strengths) {
      text(pad,y,title,'node-title',14); y+=20;
      const lines=wrap(body,inner,13); text(pad,y,lines,'secondary',13); y+=lines.length*line+16;
    }
  } else {
    const col=(inner-32)/3;
    for(let i=0;i<c.strengths.length;i++){
      const x=pad+i*(col+16);
      text(x,y,c.strengths[i][0],'node-title',14);
      text(x,y+24,wrap(c.strengths[i][1],col),'secondary');
    }
    y+=78;
  }
  section(y,c.risksTitle); y+=18;
  for (const [title,body] of c.risks) {
    const b=wrap(body,inner-32);
    const h=45+b.length*line;
    rect(pad,y,inner,h,'risk',8);
    text(pad+14,y+23,title,'risk-title',14);
    text(pad+14,y+45,b,'secondary');
    y+=h+8;
  }
  y+=24; section(y,c.nextTitle); y+=27;
  for(const s of c.next) { const ls=wrap(s,inner); text(pad,y,ls); y+=ls.length*line+9; }
  y+=10;
  const plan=c.planned.flatMap(s=>wrap(s,inner-28,12));
  rect(pad,y,inner,plan.length*line+24,'planned',10);
  text(pad+14,y+23,plan,'secondary',12); y+=plan.length*line+50;
  const proof=c.proof.flatMap(s=>wrap(s,inner,12));
  text(pad,y,proof,'secondary',12); y+=proof.length*line+18;
  text(pad,y,wrap(c.footer,inner,11),'secondary',11);
  y+=wrap(c.footer,inner,11).length*line+20;
  const css = 'svg{--bg:#f7faf8;--card:#fff;--fg:#172e28;--muted:#52665d;--line:#cfddd5;--accent:#087254;--wash:#e7f3eb;--risk:#fff4e6;--risk-fg:#865020;--edge:#668375;background:var(--bg);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}'+
    '@media(prefers-color-scheme:dark){svg{--bg:#101c17;--card:#192a22;--fg:#edf5ee;--muted:#bbcec0;--line:#3e5749;--accent:#80ddb0;--wash:#1d3829;--risk:#34291e;--risk-fg:#f0c691;--edge:#98b8a5}}'+
    'text{fill:var(--fg)}.secondary{fill:var(--muted)}.accent,.kicker{fill:var(--accent)}.headline,.node-title,.section,.risk-title{font-weight:650}.kicker{letter-spacing:1.8px}.node{fill:var(--card);stroke:var(--line)}.source,.state{fill:var(--wash);stroke:var(--line)}.boundary{fill:none;stroke:var(--line)}.edge{fill:none;stroke:var(--edge);stroke-width:1.5;stroke-linejoin:round}.arrow{fill:var(--edge)}.label-bg{fill:var(--bg)}.edge-label,.center{text-anchor:middle}.edge-label{fill:var(--muted)}.risk{fill:var(--risk)}.risk-title{fill:var(--risk-fg)}.planned{fill:none;stroke:var(--edge);stroke-dasharray:5 5}';
  return '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+y+'" viewBox="0 0 '+W+' '+y+'" role="img" aria-labelledby="'+prefix+'-title '+prefix+'-desc" xml:lang="'+lang+'">\n'+
    '<title id="'+prefix+'-title">'+xml(c.title)+'</title>\n<desc id="'+prefix+'-desc">'+xml(c.analogy.join(' ')+' '+c.declaration+'. '+c.proof.join('. ')+' '+c.risks.map(v=>v.join(': ')).join('; '))+'</desc>\n'+
    '<style>'+css+'</style>\n<defs><marker id="'+prefix+'-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto-start-reverse"><path d="M0 1 L7 4 L0 7" class="arrow"/></marker></defs>\n'+
    '<rect width="'+W+'" height="'+y+'" fill="var(--bg)"/>\n'+out.join('\n')+'\n</svg>\n';
}

const files={};
for(const lang of ['ko','en']) for(const mobile of [false,true]) files['bamti-'+lang+(mobile?'-mobile':'')+'.svg']=make(lang,mobile);
if(process.argv.includes('--write')) {
  for(const [name,svg] of Object.entries(files)) fs.writeFileSync(path.join(dir,name),svg);
} else if(process.argv.includes('--check')) {
  for(const [name,svg] of Object.entries(files)) if(fs.readFileSync(path.join(dir,name),'utf8')!==svg) throw Error('Regenerate '+name);
  console.log('PASS: four SVGs match the source generator');
} else console.log(JSON.stringify(files));
