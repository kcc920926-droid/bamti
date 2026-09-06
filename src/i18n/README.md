# 한국어 / English

확장 프로그램은 한 코드베이스로 한국어와 영어를 제공합니다. 별도 빌드나 설치 파일은 필요하지 않습니다.

- **기본:** Chrome UI 언어가 한국어이면 한국어, 영어(미국·영국 포함) 또는 다른 언어이면 영어.
- **수동 선택:** 패널 상단 `언어 / Language`에서 `한국어`, `English`, `브라우저 언어 / Browser language` 선택.
- 선택은 `chrome.storage.local.bamtiLanguage`에 저장됩니다. 변경 시 패널을 다시 로드하고 현재 페이지를 선택 언어로 재검사합니다.
- 패널, 빈 화면, 접근 권한·오류 안내, 도움말, 에이전트 연결 설정, 33개 규칙의 이름·근거·개선 방향,
  페이지 위 하이라이트, 전체 제안·개별 제안·JSON 복사까지 같은 언어를 사용합니다.
- 한·영 문체 검사 결과의 이름·개선 방향·범위 안내도 선택 언어로 표시합니다. 검사할 본문 언어는 별도로 결정하며 원문 근거는 번역하지 않습니다.
- 확장 관리 화면의 이름·설명, 툴바 툴팁, 단축키 설명은 Chrome의 네이티브 언어 설정을 따릅니다.
  패널에서 고른 언어는 Chrome 자체 UI나 권한 확인창의 언어를 바꾸지 않습니다.
- 탐지 대상 페이지의 제목·URL·인용 문구·HTML은 번역하지 않습니다. UI 언어와 관계없이 한/영 패턴을 함께 탐지합니다.
  언어 변경으로 점수·가중치·검출 조건은 달라지지 않습니다.

## Files

| File | Purpose |
|---|---|
| `_locales/en/messages.json`, `_locales/ko/messages.json` | Chrome manifest metadata and browser-level messages |
| `src/i18n/messages.js` | Shared English translations keyed by Korean source messages |
| `src/i18n/i18n.js` | Locale selection, safe placeholder formatting and static panel text localization |
| `src/panel/bootstrap.js` | Restore the preference before starting the panel and scan |

UI messages use `tr('한국어 원문')` or a tagged template such as ``tr`입력 ${count}개` ``.
Add an English entry with matching numbered placeholders (`입력 {0}개`) to `B.EN`.
Never translate detection dictionaries, CSS selectors, URLs or page-provided evidence.
Placeholders are interpolated once; their contents are not recursively translated or treated as HTML.
Static panel HTML remains Korean and is localized before the panel controller starts.
Shared rule metadata uses getters so a reused scanner cannot retain labels from a previous language.

The runtime does not call a translation service or send page content anywhere. Both languages are bundled.
Developer fixtures, promotional images and the separate MCP server are not extension pages.

## Verification

With a local server on port 8777 and Playwright/Chromium installed:

```sh
node test/i18n.cjs
node test/panel-ux.cjs
node test/engine-precision.cjs
node test/icons.cjs
node test/prose.cjs
```

The localization suite checks Korean, US English, UK English, unsupported-language fallback,
saved overrides, native extension loading, all 33 rule labels/hints, score parity, highlights,
copied reports, error states and English layouts at 280/360/480px.

Native locale behavior follows [Chrome’s i18n API](https://developer.chrome.com/docs/extensions/reference/api/i18n).
