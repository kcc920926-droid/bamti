/* 밤티 — 서비스 워커
 * 사용자 제스처(아이콘 클릭 / 단축키) → 사이드패널 열기 → 스캔 트리거
 *
 * ⚠ 함정: chrome.sidePanel.open()은 사용자 제스처 컨텍스트 안에서만 허용된다.
 *   그 앞에서 다른 chrome.* API를 await 하면 컨텍스트가 사라져 조용히 실패한다.
 *   → 아무것도 기다리지 말고 가장 먼저, 동기적으로 호출한다.
 *   나머지(타깃 저장, 패널 알림)는 그 뒤에 비동기로 흘려보낸다.
 */
function trigger(tab) {
  // 1) 무조건 먼저, 창 단위로 연다. tabId 로 열면 그 탭 전용 패널이 되어 새 탭에서 사라진다.
  //    창 단위 패널은 탭을 바꿔도 남고, 패널이 활성 탭을 따라가며 스캔한다 (panel.js).
  const windowId = tab?.windowId ?? chrome.windows.WINDOW_ID_CURRENT;
  chrome.sidePanel.open({ windowId })
    .catch(e => console.error('[밤티] sidePanel.open 실패:', e?.message || e));

  if (!tab?.id) return;   // 패널이 스스로 활성 탭을 찾는다 (panel.js 폴백)

  // 2) 타깃 기록 → 패널에 알림. 패널이 아직 안 떠 있으면 수신자가 없어 reject — 정상.
  // http/https/file 은 스캔 대상. url을 못 읽었으면(권한 지연) 일단 시도한다 — 실패 이유는 panel.js가 보여준다.
  // chrome:// · 웹스토어 · about: 같은 내부 페이지만 명시적으로 막는다.
  const url = tab.url || '';
  const scannable = !url || /^(https?|file):/.test(url);
  chrome.storage.session.set(scannable
      ? { bamtiTarget: tab.id, bamtiError: null }
      : { bamtiTarget: null, bamtiError: '이 페이지는 스캔할 수 없습니다. 크롬 내부 페이지(chrome://, 웹스토어 등)는 확장 프로그램이 접근하지 못합니다.' })
    .then(() => chrome.runtime.sendMessage({ type: 'bamti:trigger', tabId: scannable ? tab.id : null }))
    .catch(() => {});
}

chrome.action.onClicked.addListener(trigger);
chrome.commands.onCommand.addListener((cmd, tab) => { if (cmd === 'scan-page') trigger(tab); });
