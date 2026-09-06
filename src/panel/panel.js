/* 밤티 — 사이드패널 컨트롤러 */

const $ = id => document.getElementById(id);
const show = k => {
  for (const s of ['empty','busy','error','report']) $(s).hidden = (s !== k);
  syncControls();
};

const CAT_ORDER = ['unfinished','visual','structure','toolchain'];

/* 페이지 오버레이 — 기본 켬. 리포트가 그려지면 지문 위치를 페이지에 바로 표시한다. */
let overlayOn = true;
let lastReport = null;
let reportStale = false;
let focusedSignal = null;
let category = 'all';
let expanded = false;
let revision = 0;
let preferenceChanged = false;
chrome.storage.local.get('bamtiOverlay').then(({ bamtiOverlay }) => {
  if (!preferenceChanged && bamtiOverlay === false) overlayOn = false;
  paintOverlayBtn();
  pushOverlay();
}).catch(() => {});
function paintOverlayBtn() {
  const b = $('overlay');
  b.textContent = focusedSignal ? '선택 위치 표시' : overlayOn ? '위치 표시 켬' : '위치 표시 끔';
  b.setAttribute('aria-pressed', String(overlayOn || !!focusedSignal));
  b.dataset.on = overlayOn ? '1' : '0';
}
function overlayItems(r) {
  return r.signals.filter(x => x.count > 0).map(x => ({ id: x.id, label: x.label, cat: x.cat, weight: x.weight }));
}
function pushOverlay() {
  if (!currentTab || !lastReport || reportStale || $('report').hidden) return;
  focusedSignal = null;
  paintOverlayBtn();
  $('showall').hidden = true;
  const msg = overlayOn ? { type: 'bamti:highlight-all', items: overlayItems(lastReport) } : { type: 'bamti:clear' };
  sendHighlight(msg);
}
$('overlay').onclick = () => {
  preferenceChanged = true;
  overlayOn = focusedSignal ? false : !overlayOn;
  focusedSignal = null;
  chrome.storage.local.set({ bamtiOverlay: overlayOn }).catch(() => {});
  paintOverlayBtn();
  pushOverlay();
};
$('showall').onclick = pushOverlay;
let currentTab = null;      // 이 패널이 따라가는 탭
let panelWindowId = null;   // 이 패널이 속한 창 — 실제 스캔한 탭에서 학습한다
let scanning = false;       // 스캔 중복 방지
let pending  = null;        // 스캔 중에 들어온 재요청
let lastError = '';

function syncControls() {
  const ready = !!lastReport && !reportStale && !$('report').hidden && !scanning;
  for (const id of ['overlay', 'showall', 'copyreport', 'allow']) $(id).disabled = !ready;
  document.querySelectorAll('#list button, #tastelist button').forEach(b => b.disabled = !ready);
  $('rescan').disabled = scanning;
  $('rescan').textContent = scanning ? '스캔 중…' : '↻ 다시 스캔';
  $('retry').disabled = scanning;
  $('main').setAttribute('aria-busy', String(scanning));
}
function announce(text) { $('status').textContent = text; }
async function sendHighlight(msg) {
  const ticket = revision;
  try {
    const result = await chrome.tabs.sendMessage(currentTab, msg);
    if (!result?.ok) throw new Error('응답 없음');
    if (ticket !== revision) return;
    if (msg.type === 'bamti:highlight') announce(result.n === 0 ? '표시할 요소가 사라졌습니다. 다시 스캔해주세요.' : '선택한 항목의 위치를 페이지에 표시했습니다.');
  } catch {
    if (ticket === revision) announce('페이지 표시를 갱신하지 못했어요. 다시 스캔해주세요.');
  }
}

/* 도움말에서 펼쳐 볼 수 있는 진단 정보 */
function diag(ev) {
  const d = $('diag'); if (!d) return;
  d.textContent = `탭 ${currentTab ?? '-'} · 창 ${panelWindowId ?? '?'} · ${ev}` + (lastError ? ` · 에러: ${lastError}` : '');
}

const DEFAULT_EMPTY = $('emptymsg').innerHTML;
function showIdle(text) {
  lastReport = null;
  focusedSignal = null;
  $('showall').hidden = true;
  $('emptymsg').innerHTML = text || DEFAULT_EMPTY;
  announce('스캔할 웹페이지를 열어주세요.');
  show('empty');
}

/* ── 스캔 ─────────────────────────────────────────────────────── */
const SCANNABLE = /^(https?|file):/;

/* 탭 URL → 영구 허용을 요청할 출처 패턴.
   포트는 빼서 localhost:3000 / :5173 / :8777 을 한 번에 커버한다. file:// 은 전체. */
function originPattern(url) {
  try {
    const u = new URL(url);
    if (u.protocol === 'file:') return 'file:///*';
    if (!/^https?:$/.test(u.protocol)) return null;
    return `${u.protocol}//${u.hostname}/*`;
  } catch { return null; }
}

let lastUrl = '';
async function refreshAllow(url) {
  const b = $('allow');
  const pat = originPattern(url);
  if (!pat) { b.hidden = true; return; }
  b.hidden = true;
  const has = await chrome.permissions.contains({ origins: [pat] }).catch(() => false);
  if (url !== lastUrl) return;
  b.hidden = false;
  b.dataset.pattern = pat;
  b.dataset.granted = has ? '1' : '0';
  b.textContent = has ? '자동 스캔 허용됨' : '이 사이트 항상 허용';
  b.title = has
    ? `${pat} 는 클릭 없이 계속 스캔됩니다. 눌러서 해제.`
    : `${pat} 를 아이콘 클릭 없이 계속 스캔하려면 누르세요. 크롬 확인창이 한 번 뜹니다.`;
}

$('allow').onclick = async () => {
  const b = $('allow');
  const pat = b.dataset.pattern;
  if (!pat) return;
  const tabId = currentTab;
  if (b.dataset.granted === '1') {
    await chrome.permissions.remove({ origins: [pat] }).catch(() => {});
  } else {
    const ok = await chrome.permissions.request({ origins: [pat] }).catch(() => false);
    if (ok && currentTab === tabId) scan(tabId, { auto: true });
    else if (!ok) announce('권한을 변경하지 않았습니다. 아이콘으로 계속 스캔할 수 있어요.');
  }
  refreshAllow(lastUrl);
};

const blockedUrl = url => !!url && (!SCANNABLE.test(url) || /^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore)(\/|$)/i.test(url));

async function scan(tabId, { auto = false } = {}) {
  if (!tabId) return;
  const ticket = ++revision;
  const switched = currentTab !== tabId;
  if (switched) {
    if (currentTab) chrome.tabs.sendMessage(currentTab, { type: 'bamti:clear' }).catch(() => {});
    lastReport = null;
    lastUrl = '';
    category = 'all';
    expanded = false;
    $('search').value = '';
    $('tastegroup').open = false;
  }
  currentTab = tabId;
  if (scanning) {
    pending = { tabId, auto };
    if (switched) show('busy'); else markStale();
    return;
  }
  scanning = true;
  lastError = '';
  focusedSignal = null;
  $('showall').hidden = true;
  announce('현재 페이지를 스캔하고 있습니다.');
  diag(`scan(${tabId}${auto ? ', auto' : ''}) 시작`);
  if (!auto || switched || !lastReport || $('report').hidden) show('busy');
  else markStale();
  syncControls();
  try {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (ticket !== revision) return;
    if (!tab) return showIdle('탭이 닫혔습니다. 다른 웹페이지를 열고 스캔해주세요.');
    if (tab?.windowId != null) panelWindowId = tab.windowId;   // 이 패널의 창 = 실제 스캔한 탭의 창
    const url = tab?.url || '';
    if (url) lastUrl = url;
    if (blockedUrl(url)) {
      diag(`내부 페이지 대기 (${url.slice(0, 30)})`);
      return showIdle('크롬 내부 페이지는 스캔하지 않습니다.<br>페이지를 열면 자동으로 스캔합니다.');
    }

    // file:// 는 사용자가 확장 설정에서 "파일 URL 액세스"를 켜야만 주입 가능
    if (url.startsWith('file:')) {
      const allowed = await new Promise(r => chrome.extension.isAllowedFileSchemeAccess(r));
      if (ticket !== revision) return;
      if (!allowed) return failFileAccess();
    }

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['src/core/context.js', 'src/core/signals.js', 'src/core/score.js', 'src/scan/scan.js'],
    });
    if (ticket !== revision) return;
    await chrome.tabs.sendMessage(tabId, { type: 'bamti:clear' }).catch(() => {});
    if (ticket !== revision) return;
    const res = await chrome.tabs.sendMessage(tabId, { type: 'bamti:scan' });
    if (!res?.ok) throw new Error('스캐너가 응답하지 않았습니다.');
    if (ticket !== revision) { diag(`scan(${tabId}) 결과 폐기 — 대상 갱신`); return; }
    render(res.report);
    diag(`scan(${tabId}) 완료 ${res.report.score}점`);
  } catch (e) {
    if (ticket !== revision) return;
    const m = String(e?.message || e);
    lastError = m.slice(0, 80);
    // 크롬 내부 페이지(새 탭 페이지 등)는 url 을 못 읽어 위 분기를 지나온다 — 에러 문구로 판별해 조용히 대기
    if (/chrome:\/\/|chrome-extension:|about:|edge:\/\//i.test(m)) {
      lastError = '';
      diag('내부 페이지 대기 (에러 문구로 판별)');
      return showIdle('크롬 내부 페이지는 스캔하지 않습니다.<br>페이지를 열면 자동으로 스캔합니다.');
    }
    if (/Cannot access|file URL|file scheme/i.test(m)) {
      // file:// 이면 접근 토글 문제, 아니면 이 출처에 권한이 없는 것
      const tab = await chrome.tabs.get(tabId).catch(() => null);
      if (ticket !== revision) return;
      if ((tab?.url || '').startsWith('file:') || /file:/i.test(m)) { diag('file 접근 토글 필요'); return failFileAccess(); }
      diag('권한 없음');
      return failNeedsClick(tab?.url || lastUrl);
    }
    diag('실패');
    fail('페이지와 연결하지 못했어요. 페이지를 새로고침한 뒤 다시 시도해주세요.');
  } finally {
    scanning = false;
    syncControls();
    if (pending) { const next = pending; pending = null; scan(next.tabId, { auto: next.auto }); }
  }
}

function failNeedsClick(url) {
  const pat = originPattern(url);
  lastReport = null;
  $('errmsg').textContent =
    '툴바의 밤티 아이콘을 누르면 이 탭을 한 번 스캔합니다.' +
    (pat ? ` 자주 쓰는 페이지라면 ${pat}에 대한 접근을 허용해 자동으로 다시 스캔할 수 있어요.` : ' 아이콘을 고정해두면 다음에도 쉽게 찾을 수 있어요.');
  const b = $('erraction');
  b.textContent = '이 사이트 항상 허용';
  b.hidden = !pat;
  b.onclick = async () => {
    const target = currentTab;
    const ok = await chrome.permissions.request({ origins: [pat] }).catch(() => false);
    if (ok && currentTab === target) scan(target);
    else if (!ok) announce('권한을 변경하지 않았습니다. 툴바의 밤티 아이콘으로 스캔할 수 있어요.');
  };
  announce('스캔하려면 이 탭에 접근 권한이 필요합니다.');
  show('error');
}

function markStale() {
  reportStale = true;
  syncControls();
  if ($('report').hidden) return;
  $('report').classList.add('is-stale');
  $('stale').hidden = false;
}

function fail(msg) {
  lastReport = null;
  $('errmsg').textContent = msg;
  $('erraction').hidden = true;
  announce('스캔하지 못했습니다. 아래 안내를 확인해주세요.');
  show('error');
}

function failFileAccess() {
  lastReport = null;
  $('errmsg').textContent =
    '로컬 HTML 파일을 스캔하려면 크롬에서 이 확장 프로그램의 "파일 URL에 대한 액세스 허용"을 켜야 합니다. ' +
    '한 번만 켜두면 됩니다.';
  const b = $('erraction');
  b.textContent = '파일 접근 설정 열기';
  b.hidden = false;
  b.onclick = () => chrome.tabs.create({ url: 'chrome://extensions/?id=' + chrome.runtime.id });
  announce('로컬 파일 접근 설정이 필요합니다.');
  show('error');
}

/* ── 렌더 ─────────────────────────────────────────────────────── */
function render(r) {
  document.getElementById('copyfallback')?.remove();
  lastReport = r;
  reportStale = false;
  $('report').classList.remove('is-stale');
  $('stale').hidden = true;
  const when = new Date(r.scannedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  $('pagetext').textContent = `${r.title || '(제목 없음)'} · ${r.host || '로컬 파일'} · ${when}`;
  $('pagetext').title = r.url || '';
  $('pageurl').textContent = r.url || lastUrl;
  $('enginescope').textContent = r.pageType ? `${r.pageType.label} · ${r.scopeNote}` : '로컬 UI 규칙 검사 · AI 제작 여부는 판정하지 않습니다.';
  refreshAllow(lastUrl);   // 권한의 기준은 리포트의 url 이 아니라 scan() 이 기록한 탭 URL
  document.body.dataset.band = r.band;
  $('score').textContent = r.score;
  $('band').textContent  = r.bandLabel;
  $('bandline').textContent = r.bandLine;
  $('meta').textContent =
    `지문 ${r.firedCount}/${r.totalSignals} · 요소 ${r.domSize.toLocaleString()}개 · ${r.ms}ms` +
    (r.truncated ? ' · 표본 검사' : '');
  const caveats = [];
  if (r.truncated) caveats.push('페이지가 커서 일부 요소만 검사했습니다.');
  if (r.errors?.length) caveats.push(`${r.errors.length}개 규칙을 검사하지 못했습니다.`);
  $('coverage').textContent = caveats.join(' ') + (caveats.length ? ' 결과에 누락이 있을 수 있습니다.' : '');
  $('coverage').hidden = !caveats.length;

  // 카테고리 바
  $('cats').replaceChildren(...CAT_ORDER.map(k => {
    const c = r.byCat[k];
    const row = document.createElement('button');
    row.type = 'button';
    row.dataset.category = k;
    row.className = 'cat' + (k === 'unfinished' && c.count ? ' hot' : '');
    row.innerHTML = `<span aria-hidden="true">${c.icon}</span><span class="catname">${esc(c.name)}</span>
      <span class="bar"><i style="width:${c.pct}%"></i></span>
      <span class="n">${c.count}개</span>`;
    row.title = `${c.name} — ${c.desc}`;
    row.onclick = () => {
      category = category === k ? 'all' : k;
      renderList();
    };
    return row;
  }));

  renderList();
  show('report');
  announce(`스캔 완료 · 개선 검토 항목 ${r.firedCount}개${caveats.length ? ' · 일부 검사 누락' : ''}`);
  pushOverlay();
}

function renderList() {
  const r = lastReport;
  if (!r) return;
  const query = $('search').value.trim().toLocaleLowerCase();
  const matches = s => `${s.label} ${s.evidence} ${s.hint}`.toLocaleLowerCase().includes(query);
  const tells = r.signals.filter(s => (category === 'all' || s.cat === category) && matches(s));
  const tastes = (r.taste || []).filter(s => category === 'all' && matches(s));
  document.querySelectorAll('[data-category]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.category === category)));
  $('resetfilter').setAttribute('aria-pressed', String(category === 'all'));
  $('resultcount').textContent = `${tells.length} / ${r.firedCount}개 항목`;
  $('expandall').disabled = !tells.length;
  $('expandall').textContent = expanded ? '모두 접기' : '모두 펼치기';
  $('expandall').setAttribute('aria-expanded', String(expanded));
  const frag = document.createDocumentFragment();
  for (const k of CAT_ORDER) {
    const items = tells.filter(s => s.cat === k).sort((a, b) => b.weight - a.weight);
    if (!items.length) continue;
    frag.append(group(`${r.byCat[k].icon} ${r.byCat[k].name} — ${r.byCat[k].desc}`));
    for (const s of items) frag.append(row(s, k === 'unfinished'));
  }

  $('list').replaceChildren(frag);
  $('tastegroup').hidden = !tastes.length;
  $('tastesummary').textContent = `참고 패턴 ${tastes.length}개 · 점수 제외`;
  $('tastelist').replaceChildren(...tastes.map(s => row(s, false)));
  $('noresults').hidden = !!tells.length;
  const filtering = !!query || category !== 'all';
  $('noresultsmsg').textContent = filtering ? '이 조건에 맞는 개선 항목이 없습니다.' : '현재 규칙에서 발견한 지문이 없습니다. 실제 동작과 화면도 함께 확인해주세요.';
  $('clearsearch').hidden = !filtering;
  syncControls();
}

$('search').oninput = renderList;
$('resetfilter').onclick = () => { category = 'all'; renderList(); };
$('clearsearch').onclick = () => { category = 'all'; $('search').value = ''; renderList(); $('search').focus(); };
$('expandall').onclick = () => { expanded = !expanded; renderList(); };

async function copyText(text, button) {
  const label = button.dataset.copyLabel || button.textContent;
  button.dataset.copyLabel = label;
  const ticket = revision;
  try {
    await navigator.clipboard.writeText(text);
    if (ticket !== revision || !button.isConnected) return;
    button.textContent = '복사됨 ✓';
    announce('개선 제안을 복사했습니다. 편집기나 AI 채팅에 붙여넣으세요.');
    setTimeout(() => { button.textContent = label; }, 1800);
  } catch {
    if (ticket !== revision || !button.isConnected) return;
    announce('자동 복사가 차단됐어요. 아래 텍스트를 선택해 복사해주세요.');
    let fallback = document.getElementById('copyfallback');
    if (!fallback) {
      fallback = document.createElement('textarea');
      fallback.id = 'copyfallback';
      fallback.readOnly = true;
      fallback.setAttribute('aria-label', '수동으로 복사할 개선 제안');
    }
    button.parentElement.append(fallback);
    fallback.value = text;
    fallback.focus();
    fallback.select();
  }
}
function suggestionText(s) {
  return `${s.label}\n근거: ${s.evidence}\n개선 방향: ${s.hint}`;
}
$('copyreport').onclick = () => {
  if (!lastReport || reportStale) return;
  const r = lastReport;
  const text = [`밤티 UI 검토: ${r.title}`, r.url, `검사 시각: ${r.scannedAt}`, `패턴 점수 ${r.score}/100 · AI 생성 확률이 아닙니다.`,
    ...r.signals.map(suggestionText),
    ...(r.pageType ? [`검사 범위: ${r.pageType.label} · ${r.scopeNote}`] : []),
    ...(r.taste?.length ? ['참고 패턴 (점수 제외)', ...r.taste.map(suggestionText)] : []),
    ...(r.truncated || r.errors?.length ? ['일부 요소 또는 규칙은 검사하지 못했습니다.'] : [])].join('\n\n');
  copyText(text, $('copyreport'));
};

function group(text) {
  const h = document.createElement('div');
  h.className = 'grp';
  h.textContent = text;
  return h;
}

function row(s, crit) {
  const d = document.createElement('details');
  d.open = expanded;
  d.className = 'sig' + (crit ? ' crit' : '') + (s.kind === 'taste' ? ' taste' : '');

  const sum = document.createElement('summary');
  sum.innerHTML = `<span class="w" title="${s.kind === 'taste' ? '점수에 포함되지 않는 참고 패턴' : '규칙 가중치 (심각도 아님)'}">${s.kind === 'taste' ? '참고' : s.weight}</span>
    <span class="t">${esc(s.label)}<span class="ev">${esc(s.evidence)}</span></span>`;
  d.append(sum);

  const body = document.createElement('div');
  body.className = 'body';
  const p = document.createElement('p');
  p.textContent = s.hint;
  body.append(p);
  const copy = document.createElement('button');
  copy.textContent = '개선 제안 복사';
  copy.onclick = () => copyText(suggestionText(s), copy);
  body.append(copy);

  if (s.scope === 'page') {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = '페이지 전체 속성 — <head>·전역 스타일';
    body.append(chip);
  } else if (s.count) {
    const btn = document.createElement('button');
    btn.textContent = `이 항목만 ${s.count}곳 표시`;
    btn.onclick = () => {
      if (reportStale || scanning) return;
      focusedSignal = s.id;
      paintOverlayBtn();
      sendHighlight({ type: 'bamti:highlight', signalId: s.id,
        meta: { id: s.id, label: s.label, cat: s.kind === 'taste' ? 'taste' : s.cat, weight: s.weight } });
      $('showall').hidden = false;
      $('showall').textContent = overlayOn ? '전체 표시' : '선택 해제';
    };
    body.append(btn);
  } else {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = '표시할 요소를 찾지 못함';
    body.append(chip);
  }
  d.append(body);
  return d;
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

/* ── 진입점 ───────────────────────────────────────────────────── */
async function rescanActive() {
  const ticket = revision;
  let tab;
  try {
    [tab] = await chrome.tabs.query(panelWindowId == null ? { active: true, currentWindow: true } : { active: true, windowId: panelWindowId });
  } catch {
    if (ticket === revision) fail('현재 탭을 확인하지 못했어요. 툴바의 밤티 아이콘을 다시 눌러주세요.');
    return;
  }
  if (ticket !== revision) return;
  if (!tab?.id) return showIdle('스캔할 웹페이지를 열어주세요.');
  scan(tab.id);
}
$('rescan').onclick = rescanActive;
$('retry').onclick = rescanActive;
$('shortcuts').onclick = () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });

// 붙어 있는 탭이 이동/새로고침하면: 즉시 낡음 표시 → 로드 완료 시 자동 재스캔.
// 권한이 끊긴 경우는 scan()이 failNeedsClick()으로 옛 결과를 치우고 안내한다.
let rescanTimer = null;
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (tabId !== currentTab) return;
  if (info.status) diag(`updated(${tabId}) ${info.status}`);
  if (info.status === 'loading' || info.url) {
    ++revision;
    pending = null;
    clearTimeout(rescanTimer);
    markStale();
    announce('페이지가 바뀌었습니다. 로드가 끝나면 다시 스캔합니다.');
  }
  if (info.status === 'complete' || (info.url && info.status !== 'loading')) {
    clearTimeout(rescanTimer);
    const ticket = revision;
    rescanTimer = setTimeout(() => { if (ticket === revision && tabId === currentTab) scan(tabId, { auto: true }); }, 250);
  }
});
chrome.tabs.onRemoved.addListener(tabId => {
  if (tabId === currentTab) { ++revision; pending = null; currentTab = null; lastReport = null; showIdle(); }
});

// 전역 패널이라 탭을 바꿔도 남는다 → 활성 탭을 따라가며 스캔한다.
// 창 필터는 실제 스캔한 탭의 창(panelWindowId)으로만 건다. 모르면 걸지 않는다 —
// 잘못된 필터는 모든 이벤트를 삼켜 "아이콘을 눌러야만 됨"으로 보인다.
chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  if (panelWindowId != null && windowId !== panelWindowId) { diag(`activated(${tabId}) 무시 — 다른 창 ${windowId}`); return; }
  if (tabId === currentTab) return;
  diag(`activated(${tabId})`);
  clearTimeout(rescanTimer);
  scan(tabId, { auto: true });
});

chrome.runtime.onMessage.addListener(msg => {
  if (msg?.type !== 'bamti:trigger') return;
  rescanActive();
});

// 패널이 속한 창의 현재 탭에서 시작한다. 지난 세션의 타깃은 사용하지 않는다.
(async () => {
  const initialRevision = revision;
  const win = await chrome.windows.getCurrent();
  panelWindowId = win.id;
  if (revision !== initialRevision) return;
  await rescanActive();
})().catch(() => fail('현재 탭을 확인하지 못했어요. 툴바의 밤티 아이콘을 다시 눌러주세요.'));
