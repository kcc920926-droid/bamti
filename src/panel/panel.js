const tr = BAMTI.I18N.t;
const proseFindings = r => [...(r.prose?.signals || []), ...(r.prose?.fragments?.signals || [])];
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
  b.textContent = focusedSignal ? tr('선택 위치 표시') : overlayOn ? tr('위치 표시 켬') : tr('위치 표시 끔');
  b.setAttribute('aria-pressed', String(overlayOn || !!focusedSignal));
  b.dataset.on = overlayOn ? '1' : '0';
}
function overlayItems(r) {
  return [...r.signals, ...proseFindings(r)].filter(x => x.count > 0).map(x => ({ id: x.id, label: x.label, cat: x.cat, weight: x.weight }));
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

/* ── 리포트 JSON 복사 — 요소 셀렉터·HTML 조각까지 포함한 기계용. 사람용은 #copyreport ── */
$('copy').onclick = () => {
  if (!lastReport || reportStale) return;
  copyText(JSON.stringify(lastReport, null, 2), $('copy'));
};

/* ── 에이전트 브리지: bamti-mcp(WS 서버) ↔ 패널(클라이언트) ──────────────
   확장은 항상 클라이언트다. WebSocket 은 CORS·host permission 이 없어 권한 추가가 필요 없다.
   프로토콜: hello{token} → welcome | error ; 패널→ report{report} ;
             서버→ request{id,action,params} → 패널→ result{id,ok,data|error} */
let bridgeCfg = { port: 8765, token: '', enabled: false };
let ws = null, wsTimer = null, wsTries = 0;
const scanWaiters = [];   // 에이전트의 scan 요청 — 다음 render()/fail*()/showIdle() 에서 정산

function setBridgeState(text, state) { const el = $('bridgestate'); if (!el) return; el.textContent = tr`에이전트: ${text}`; el.dataset.state = state; }
function saveBridge() { chrome.storage.local.set({ bamtiBridge: bridgeCfg }).catch(() => {}); }
function wsSend(o) { if (ws && ws.readyState === 1) { try { ws.send(JSON.stringify(o)); } catch {} } }
function settleScan(ok, payload) { for (const w of scanWaiters.splice(0)) ok ? w.res(payload) : w.rej(new Error(payload)); }

function bridgeConnect() {
  clearTimeout(wsTimer);
  if (ws) { const old = ws; ws = null; try { old.close(); } catch {} }
  if (!bridgeCfg.enabled) { setBridgeState(tr('꺼짐'), 'off'); $('bconnect').textContent = tr('연결'); return; }
  $('bconnect').textContent = tr('끊기');
  setBridgeState(tr`연결 중… :${bridgeCfg.port}`, 'wait');
  let sock;
  try { sock = new WebSocket(`ws://127.0.0.1:${bridgeCfg.port}`); } catch { setBridgeState(tr('주소 오류'), 'err'); return; }
  ws = sock;
  sock.onopen = () => {
    wsTries = 0;
    sock.send(JSON.stringify({ type: 'hello', token: bridgeCfg.token, client: 'bamti-panel', version: chrome.runtime.getManifest?.()?.version || '' }));
  };
  sock.onmessage = ev => {
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    if (m.type === 'welcome') {
      setBridgeState(tr`연결됨 :${bridgeCfg.port}`, 'on'); diag(tr('에이전트 연결')); announce(tr('로컬 에이전트와 연결되었습니다.'));
      if (lastReport && !reportStale) wsSend({ type: 'report', report: lastReport });
    }
    else if (m.type === 'error') { setBridgeState(m.reason === 'bad-token' ? tr('토큰 불일치') : tr`오류: ${m.reason}`, 'err'); bridgeCfg.enabled = false; saveBridge(); $('bconnect').textContent = tr('연결'); }
    else if (m.type === 'request') handleAgentRequest(m);
    else if (m.type === 'ping') wsSend({ type: 'pong' });
  };
  sock.onclose = () => {
    if (ws !== sock) return;
    ws = null;
    if (!bridgeCfg.enabled) { setBridgeState(tr('꺼짐'), 'off'); return; }
    const delay = Math.min(30000, 1000 * 2 ** Math.min(wsTries++, 5));
    setBridgeState(tr`끊김 — ${delay / 1000}s 후 재시도`, 'wait');
    wsTimer = setTimeout(bridgeConnect, delay);
  };
  sock.onerror = () => {};
}

async function handleAgentRequest(m) {
  const reply = (ok, data, error) => wsSend({ type: 'result', id: m.id, ok, data, error });
  diag(tr`에이전트 요청 ${m.action}`);
  try {
    if (m.action === 'get_report') return reply(true, lastReport && !reportStale ? lastReport : null);
    if (m.action === 'scan') {
      const done = new Promise((res, rej) => scanWaiters.push({ res, rej }));
      let id = currentTab;
      if (!id) {
        const [t] = await chrome.tabs.query(panelWindowId == null ? { active: true, currentWindow: true } : { active: true, windowId: panelWindowId });
        id = t?.id;
      }
      if (!id) throw new Error(tr('스캔할 탭이 없습니다'));
      scan(id);
      return reply(true, await done);
    }
    if (m.action === 'highlight') {
      if (!currentTab || !lastReport || reportStale) throw new Error(tr('표시할 리포트가 없습니다 — 먼저 scan 하세요'));
      const sid = m.params?.signal_id;
      const sg = [...(lastReport.signals || []), ...(lastReport.taste || []), ...proseFindings(lastReport)].find(x => x.id === sid);
      if (!sg) throw new Error(tr`리포트에 없는 시그널: ${sid}`);
      focusedSignal = sid; paintOverlayBtn();
      await sendHighlight({ type: 'bamti:highlight', signalId: sid, meta: { id: sg.id, label: sg.label, cat: sg.kind === 'taste' ? 'taste' : sg.cat, weight: sg.weight } });
      $('showall').hidden = false; $('showall').textContent = overlayOn ? tr('전체 표시') : tr('선택 해제');
      return reply(true, { highlighted: sg.count });
    }
    if (m.action === 'show_all') { pushOverlay(); return reply(true, { ok: true }); }
    if (m.action === 'clear') { if (currentTab) await chrome.tabs.sendMessage(currentTab, { type: 'bamti:clear' }).catch(() => {}); return reply(true, { ok: true }); }
    throw new Error(tr`알 수 없는 action: ${m.action}`);
  } catch (e) { reply(false, null, String(e?.message || e)); }
}

$('bconnect').onclick = () => {
  bridgeCfg.port = Math.max(1, Math.min(65535, +$('bport').value || 8765));
  bridgeCfg.token = $('btoken').value.trim();
  bridgeCfg.enabled = !bridgeCfg.enabled;
  saveBridge();
  bridgeConnect();
};
chrome.storage.local.get('bamtiBridge').then(({ bamtiBridge }) => {
  if (bamtiBridge) bridgeCfg = { ...bridgeCfg, ...bamtiBridge };
  $('bport').value = bridgeCfg.port; $('btoken').value = bridgeCfg.token || '';
  bridgeConnect();
}).catch(() => {});
let currentTab = null;      // 이 패널이 따라가는 탭
let panelWindowId = null;   // 이 패널이 속한 창 — 실제 스캔한 탭에서 학습한다
let scanning = false;       // 스캔 중복 방지
let pending  = null;        // 스캔 중에 들어온 재요청
let lastError = '';

function syncControls() {
  const ready = !!lastReport && !reportStale && !$('report').hidden && !scanning;
  for (const id of ['overlay', 'showall', 'copyreport', 'copy', 'allow']) $(id).disabled = !ready;
  document.querySelectorAll('#list button, #tastelist button, #proselist button').forEach(b => b.disabled = !ready);
  $('rescan').disabled = scanning;
  $('rescan').textContent = scanning ? tr('스캔 중…') : tr('↻ 다시 스캔');
  $('retry').disabled = scanning;
  $('main').setAttribute('aria-busy', String(scanning));
}
function announce(text) { $('status').textContent = text; }
async function sendHighlight(msg) {
  const ticket = revision;
  try {
    const result = await chrome.tabs.sendMessage(currentTab, msg);
    if (!result?.ok) throw new Error(tr('응답 없음'));
    if (ticket !== revision) return;
    if (msg.type === 'bamti:highlight') announce(result.n === 0 ? tr('표시할 요소가 사라졌습니다. 다시 스캔해주세요.') : tr('선택한 항목의 위치를 페이지에 표시했습니다.'));
  } catch {
    if (ticket === revision) announce(tr('페이지 표시를 갱신하지 못했어요. 다시 스캔해주세요.'));
  }
}

/* 도움말에서 펼쳐 볼 수 있는 진단 정보 */
function diag(ev) {
  const d = $('diag'); if (!d) return;
  d.textContent = tr`탭 ${currentTab ?? '-'} · 창 ${panelWindowId ?? '?'} · ${ev}` + (lastError ? tr` · 에러: ${lastError}` : '');
}

const DEFAULT_EMPTY = $('emptymsg').innerHTML;
function showIdle(text) {
  lastReport = null;
  focusedSignal = null;
  $('showall').hidden = true;
  $('emptymsg').innerHTML = text || DEFAULT_EMPTY;
  announce(tr('스캔할 웹페이지를 열어주세요.'));
  show('empty');
  settleScan(false, tr('스캔할 수 없는 페이지입니다 (크롬 내부 페이지 또는 닫힌 탭)'));
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
let allowRevision = 0;
const siteAccess = BAMTI.SITES.mount({
  onChange: () => refreshAllow(lastUrl),
  onGranted: () => { if (currentTab) scan(currentTab, { auto: true }); },
});
async function refreshAllow(url) {
  const ticket = ++allowRevision;
  const b = $('allow');
  const pat = originPattern(url);
  if (!pat) { b.hidden = true; return; }
  b.hidden = true;
  const has = await chrome.permissions.contains({ origins: [pat] }).catch(() => false);
  if (url !== lastUrl || ticket !== allowRevision) return;
  b.hidden = false;
  b.dataset.pattern = pat;
  b.dataset.granted = has ? '1' : '0';
  b.textContent = has ? tr('자동 스캔 허용됨') : tr('이 사이트 항상 허용');
  b.title = has
    ? tr('허용 목록에서 권한을 관리합니다. 와일드카드는 여러 사이트에 적용됩니다.')
    : tr`${pat} 를 아이콘 클릭 없이 계속 스캔하려면 누르세요. 크롬 확인창이 한 번 뜹니다.`;
}

$('allow').onclick = async () => {
  const b = $('allow');
  const pat = b.dataset.pattern;
  if (!pat) return;
  const tabId = currentTab;
  if (b.dataset.granted === '1') {
    // An exact origin can be covered by a wildcard grant; it cannot be
    // subtracted from that wildcard. Manage the actual granted scope instead.
    siteAccess.open();
    return;
  } else {
    const ok = await chrome.permissions.request({ origins: [pat] }).catch(() => false);
    if (ok && currentTab === tabId) scan(tabId, { auto: true });
    else if (!ok) announce(tr('권한을 변경하지 않았습니다. 아이콘으로 계속 스캔할 수 있어요.'));
  }
  refreshAllow(lastUrl);
  siteAccess.refresh();
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
  announce(tr('현재 페이지를 스캔하고 있습니다.'));
  diag(tr`scan(${tabId}${auto ? ', auto' : ''}) 시작`);
  if (!auto || switched || !lastReport || $('report').hidden) show('busy');
  else markStale();
  syncControls();
  try {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (ticket !== revision) return;
    if (!tab) return showIdle(tr('탭이 닫혔습니다. 다른 웹페이지를 열고 스캔해주세요.'));
    if (tab?.windowId != null) panelWindowId = tab.windowId;   // 이 패널의 창 = 실제 스캔한 탭의 창
    const url = tab?.url || '';
    if (url) lastUrl = url;
    if (blockedUrl(url)) {
      diag(tr`내부 페이지 대기 (${url.slice(0, 30)})`);
      return showIdle(tr('크롬 내부 페이지는 스캔하지 않습니다.<br>페이지를 열면 자동으로 스캔합니다.'));
    }

    // file:// 는 사용자가 확장 설정에서 "파일 URL 액세스"를 켜야만 주입 가능
    if (url.startsWith('file:')) {
      const allowed = await new Promise(r => chrome.extension.isAllowedFileSchemeAccess(r));
      if (ticket !== revision) return;
      if (!allowed) return failFileAccess();
    }

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['src/i18n/messages.js', 'src/i18n/i18n.js', 'src/core/context.js', 'src/core/signals.js', 'src/prose/english-rules.js', 'src/prose/prose.js', 'src/core/score.js', 'src/scan/scan.js'],
    });
    if (ticket !== revision) return;
    await chrome.tabs.sendMessage(tabId, { type: 'bamti:clear' }).catch(() => {});
    if (ticket !== revision) return;
    const res = await chrome.tabs.sendMessage(tabId, { type: 'bamti:scan', locale: BAMTI.I18N.locale });
    if (!res?.ok) throw new Error(tr('스캐너가 응답하지 않았습니다.'));
    if (ticket !== revision) { diag(tr`scan(${tabId}) 결과 폐기 — 대상 갱신`); return; }
    render(res.report);
    diag(tr`scan(${tabId}) 완료 ${res.report.score}점`);
  } catch (e) {
    if (ticket !== revision) return;
    const m = String(e?.message || e);
    lastError = m.slice(0, 80);
    // 크롬 내부 페이지(새 탭 페이지 등)는 url 을 못 읽어 위 분기를 지나온다 — 에러 문구로 판별해 조용히 대기
    if (/chrome:\/\/|chrome-extension:|about:|edge:\/\//i.test(m)) {
      lastError = '';
      diag(tr('내부 페이지 대기 (에러 문구로 판별)'));
      return showIdle(tr('크롬 내부 페이지는 스캔하지 않습니다.<br>페이지를 열면 자동으로 스캔합니다.'));
    }
    if (/Cannot access|file URL|file scheme/i.test(m)) {
      // file:// 이면 접근 토글 문제, 아니면 이 출처에 권한이 없는 것
      const tab = await chrome.tabs.get(tabId).catch(() => null);
      if (ticket !== revision) return;
      if ((tab?.url || '').startsWith('file:') || /file:/i.test(m)) { diag(tr('file 접근 토글 필요')); return failFileAccess(); }
      diag(tr('권한 없음'));
      return failNeedsClick(tab?.url || lastUrl);
    }
    diag(tr('실패'));
    fail(tr('페이지와 연결하지 못했어요. 페이지를 새로고침한 뒤 다시 시도해주세요.'));
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
    tr('툴바의 밤티 아이콘을 누르면 이 탭을 한 번 스캔합니다.') +
    (pat ? tr` 자주 쓰는 페이지라면 ${pat}에 대한 접근을 허용해 자동으로 다시 스캔할 수 있어요.` : tr(' 아이콘을 고정해두면 다음에도 쉽게 찾을 수 있어요.'));
  const b = $('erraction');
  b.textContent = tr('이 사이트 항상 허용');
  b.hidden = !pat;
  b.onclick = async () => {
    const target = currentTab;
    const ok = await chrome.permissions.request({ origins: [pat] }).catch(() => false);
    if (ok && currentTab === target) scan(target);
    else if (!ok) announce(tr('권한을 변경하지 않았습니다. 툴바의 밤티 아이콘으로 스캔할 수 있어요.'));
  };
  announce(tr('스캔하려면 이 탭에 접근 권한이 필요합니다.'));
  show('error');
  settleScan(false, tr('이 탭에 접근 권한이 없습니다. 패널에서 "이 사이트 항상 허용"을 누르거나 툴바 아이콘으로 한 번 스캔하세요'));
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
  announce(tr('스캔하지 못했습니다. 아래 안내를 확인해주세요.'));
  show('error');
  settleScan(false, msg);
}

function failFileAccess() {
  lastReport = null;
  $('errmsg').textContent =
    tr('로컬 HTML 파일을 스캔하려면 크롬에서 이 확장 프로그램의 "파일 URL에 대한 액세스 허용"을 켜야 합니다. ') +
    tr('한 번만 켜두면 됩니다.');
  const b = $('erraction');
  b.textContent = tr('파일 접근 설정 열기');
  b.hidden = false;
  b.onclick = () => chrome.tabs.create({ url: 'chrome://extensions/?id=' + chrome.runtime.id });
  announce(tr('로컬 파일 접근 설정이 필요합니다.'));
  show('error');
  settleScan(false, tr('파일 URL 액세스 허용이 꺼져 있습니다 (chrome://extensions → 밤티 → 세부정보)'));
}

/* ── 렌더 ─────────────────────────────────────────────────────── */
function render(r) {
  document.getElementById('copyfallback')?.remove();
  lastReport = r;
  reportStale = false;
  $('report').classList.remove('is-stale');
  $('stale').hidden = true;
  const when = new Date(r.scannedAt).toLocaleTimeString(BAMTI.I18N.numberLocale, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  $('pagetext').textContent = `${r.title || tr('(제목 없음)')} · ${r.host || tr('로컬 파일')} · ${when}`;
  $('pagetext').title = r.url || '';
  $('pageurl').textContent = r.url || lastUrl;
  $('enginescope').textContent = r.pageType ? `${r.pageType.label} · ${r.scopeNote}` : tr('로컬 UI 규칙 검사 · AI 제작 여부는 판정하지 않습니다.');
  refreshAllow(lastUrl);   // 권한의 기준은 리포트의 url 이 아니라 scan() 이 기록한 탭 URL
  document.body.dataset.band = r.band;
  $('score').textContent = r.score;
  $('band').textContent  = r.bandLabel;
  $('bandline').textContent = r.bandLine;
  $('meta').textContent =
    tr`지문 ${r.firedCount}/${r.totalSignals} · 요소 ${r.domSize.toLocaleString(BAMTI.I18N.numberLocale)}개 · ${r.ms}ms` +
    (r.truncated ? tr(' · 표본 검사') : '');
  const caveats = [];
  if (r.truncated) caveats.push(tr('페이지가 커서 일부 요소만 검사했습니다.'));
  if (r.errors?.length) caveats.push(tr`${r.errors.length}개 규칙을 검사하지 못했습니다.`);
  $('coverage').textContent = caveats.join(' ') + (caveats.length ? tr(' 결과에 누락이 있을 수 있습니다.') : '');
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
      <span class="n">${tr`${c.count}개`}</span>`;
    row.title = `${c.name} — ${c.desc}`;
    row.onclick = () => {
      category = category === k ? 'all' : k;
      renderList();
    };
    return row;
  }));

  renderList();
  show('report');
  announce(tr`스캔 완료 · 개선 검토 항목 ${r.firedCount}개${caveats.length ? tr(' · 일부 검사 누락') : ''}`);
  pushOverlay();
  settleScan(true, r);
  wsSend({ type: 'report', report: r });
}

function renderList() {
  const r = lastReport;
  if (!r) return;
  const query = $('search').value.trim().toLocaleLowerCase();
  const matches = s => `${s.label} ${s.evidence} ${s.hint}`.toLocaleLowerCase().includes(query);
  const tells = r.signals.filter(s => (category === 'all' || s.cat === category) && matches(s));
  const inlineReview = s => ['eyebrow-microlabel', 'headline-terminal-period'].includes(s.id);
  const labelReviews = (r.taste || []).filter(s => inlineReview(s) && (category === 'all' || category === s.cat) && matches(s));
  const tastes = (r.taste || []).filter(s => !inlineReview(s) && category === 'all' && matches(s));
  const prose = proseFindings(r).filter(s => category === 'all' && matches(s));
  $('prosesummary').textContent = tr`문체 검사 · ${proseFindings(r).length}개 항목`;
  $('jumpprose').textContent = $('prosesummary').textContent + ' ↓';
  $('prosenote').textContent = r.prose?.note || '';
  $('prosestatus').textContent = !r.prose || r.prose.status === 'error'
    ? tr('문체 검사를 완료하지 못했습니다. 다시 스캔해주세요.')
    : r.prose.status === 'insufficient' && r.prose.fragments?.status !== 'checked'
      ? tr('검사할 한·영 텍스트가 없습니다. 숨겨진 내용·메뉴·입력창·인용은 제외합니다.')
      : tr`텍스트 영역 ${r.prose.fragments?.inspectedBlocks ?? r.prose.inspectedBlocks}개 검사 · ${prose.length}개 항목 표시` +
        (prose.length ? '' : ' · ' + tr('현재 조건에서 발견한 문체 패턴이 없습니다. AI 작성 여부는 알 수 없습니다.'));
  if (r.prose?.limited) $('prosestatus').textContent += ' ' + tr('본문 일부만 검사했습니다. 결과에 누락이 있을 수 있습니다.');
  $('proselist').replaceChildren(...prose.map(s => row(s, false)));
  document.querySelectorAll('[data-category]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.category === category)));
  $('resetfilter').setAttribute('aria-pressed', String(category === 'all'));
  $('resultcount').textContent = tr`UI ${tells.length} / ${r.firedCount}개 항목`;
  $('expandall').disabled = !tells.length && !prose.length && !labelReviews.length;
  $('expandall').textContent = expanded ? tr('모두 접기') : tr('모두 펼치기');
  $('expandall').setAttribute('aria-expanded', String(expanded));
  const frag = document.createDocumentFragment();
  for (const k of CAT_ORDER) {
    const items = tells.filter(s => s.cat === k).sort((a, b) => b.weight - a.weight);
    if (!items.length) continue;
    frag.append(group(`${r.byCat[k].icon} ${r.byCat[k].name} — ${r.byCat[k].desc}`));
    for (const s of items) frag.append(row(s, k === 'unfinished'));
  }

  if (labelReviews.length) {
    frag.append(group(tr('표현·구조 검토 · 점수 제외')));
    for (const s of labelReviews) frag.append(row(s, false));
  }
  $('list').replaceChildren(frag);
  $('tastegroup').hidden = !tastes.length;
  $('tastesummary').textContent = tr`참고 패턴 ${tastes.length}개 · 점수 제외`;
  $('tastelist').replaceChildren(...tastes.map(s => row(s, false)));
  $('noresults').hidden = !!tells.length || !!prose.length || !!labelReviews.length;
  const filtering = !!query || category !== 'all';
  $('noresultsmsg').textContent = filtering ? tr('이 조건에 맞는 개선 항목이 없습니다.') : tr('현재 규칙에서 발견한 지문이 없습니다. 실제 동작과 화면도 함께 확인해주세요.');
  $('clearsearch').hidden = !filtering;
  syncControls();
}

$('search').oninput = renderList;
$('jumpprose').onclick = () => {
  $('prosegroup').open = true;
  $('prosesummary').focus();
  $('prosegroup').scrollIntoView({ block: 'start' });
};
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
    button.textContent = tr('복사됨 ✓');
    announce(tr('개선 제안을 복사했습니다. 편집기나 AI 채팅에 붙여넣으세요.'));
    setTimeout(() => { button.textContent = label; }, 1800);
  } catch {
    if (ticket !== revision || !button.isConnected) return;
    announce(tr('자동 복사가 차단됐어요. 아래 텍스트를 선택해 복사해주세요.'));
    let fallback = document.getElementById('copyfallback');
    if (!fallback) {
      fallback = document.createElement('textarea');
      fallback.id = 'copyfallback';
      fallback.readOnly = true;
      fallback.setAttribute('aria-label', tr('수동으로 복사할 개선 제안'));
    }
    button.parentElement.append(fallback);
    fallback.value = text;
    fallback.focus();
    fallback.select();
  }
}
function suggestionText(s) {
  return tr`${s.label}\n근거: ${s.evidence}\n개선 방향: ${s.hint}`;
}
$('copyreport').onclick = () => {
  if (!lastReport || reportStale) return;
  const r = lastReport;
  const text = [tr`밤티 UI 검토: ${r.title}`, r.url, tr`검사 시각: ${r.scannedAt}`, tr`패턴 점수 ${r.score}/100 · AI 생성 확률이 아닙니다.`,
    ...r.signals.map(suggestionText),
    ...(r.prose ? [tr('문체 검사 · UI 점수 제외'), r.prose.note || '',
      ...proseFindings(r).map(suggestionText),
      ...(r.prose.status === 'insufficient' && r.prose.fragments?.status !== 'checked' ? [tr('검사할 한·영 텍스트가 없습니다. 숨겨진 내용·메뉴·입력창·인용은 제외합니다.')] : []),
      ...(r.prose.status === 'error' ? [tr('문체 검사를 완료하지 못했습니다. 다시 스캔해주세요.')] : []),
      ...(r.prose.limited ? [tr('본문 일부만 검사했습니다. 결과에 누락이 있을 수 있습니다.')] : [])] : []),
    ...(r.pageType ? [tr`검사 범위: ${r.pageType.label} · ${r.scopeNote}`] : []),
    ...(r.taste?.length ? [tr('참고 패턴 (점수 제외)'), ...r.taste.map(suggestionText)] : []),
    ...(r.truncated || r.errors?.length ? [tr('일부 요소 또는 규칙은 검사하지 못했습니다.')] : [])].join('\n\n');
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
  d.dataset.signalId = s.id;

  const sum = document.createElement('summary');
  sum.innerHTML = `<span class="w" title="${s.kind === 'prose' ? tr('문체 검사 · UI 점수 제외') : s.kind === 'taste' ? tr('점수에 포함되지 않는 참고 패턴') : tr('규칙 가중치 (심각도 아님)')}">${s.kind === 'prose' ? esc(s.language.toUpperCase()) : s.kind === 'taste' ? tr('참고') : s.weight}</span>
    <span class="t">${esc(s.label)}<span class="ev">${esc(s.evidence)}</span></span>`;
  d.append(sum);

  const body = document.createElement('div');
  body.className = 'body';
  const p = document.createElement('p');
  p.textContent = s.hint;
  body.append(p);
  if (s.kind === 'prose') {
    const examples = document.createElement('ul');
    examples.className = 'prose-examples';
    for (const hit of (s.examples || []).slice(0, 4)) {
      const li = document.createElement('li');
      li.textContent = hit.excerpt;
      examples.append(li);
    }
    body.append(examples);
    const source = document.createElement('a');
    // Fixed upstream links only; report/page content never supplies a navigation URL.
    source.href = s.language === 'ko' ? 'https://github.com/epoko77-ai/im-not-ai' : 'https://github.com/hwajongpark/slop-gate';
    source.target = '_blank'; source.rel = 'noopener noreferrer';
    source.className = 'prose-source';
    source.textContent = tr`규칙 출처: ${s.language === 'ko' ? 'im-not-ai' : 'slop-gate'} · MIT`;
    body.append(source);
  }
  const copy = document.createElement('button');
  copy.textContent = tr('개선 제안 복사');
  copy.onclick = () => copyText(suggestionText(s), copy);
  body.append(copy);

  if (s.scope === 'page') {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = tr('페이지 전체 속성 — <head>·전역 스타일');
    body.append(chip);
  } else if (s.count) {
    const btn = document.createElement('button');
    btn.textContent = tr`이 항목만 ${s.count}곳 표시`;
    btn.onclick = () => {
      if (reportStale || scanning) return;
      focusedSignal = s.id;
      paintOverlayBtn();
      sendHighlight({ type: 'bamti:highlight', signalId: s.id,
        meta: { id: s.id, label: s.label, cat: s.kind === 'taste' ? 'taste' : s.cat, weight: s.weight } });
      $('showall').hidden = false;
      $('showall').textContent = overlayOn ? tr('전체 표시') : tr('선택 해제');
    };
    body.append(btn);
  } else {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = tr('표시할 요소를 찾지 못함');
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
    if (ticket === revision) fail(tr('현재 탭을 확인하지 못했어요. 툴바의 밤티 아이콘을 다시 눌러주세요.'));
    return;
  }
  if (ticket !== revision) return;
  if (!tab?.id) return showIdle(tr('스캔할 웹페이지를 열어주세요.'));
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
    announce(tr('페이지가 바뀌었습니다. 로드가 끝나면 다시 스캔합니다.'));
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
  if (panelWindowId != null && windowId !== panelWindowId) { diag(tr`activated(${tabId}) 무시 — 다른 창 ${windowId}`); return; }
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
})().catch(() => fail(tr('현재 탭을 확인하지 못했어요. 툴바의 밤티 아이콘을 다시 눌러주세요.')));
