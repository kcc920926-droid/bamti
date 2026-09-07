# 밤티 설치·사용 가이드

[한눈에 보는 구조](../README.md) · [구조의 코드 근거](architecture-evidence.md) · [English quick start](#english-quick-start)

밤티는 배포 전 UI 패턴과 한국어·영어 문체를 점검하는 Chrome 확장입니다.
AI 작성 여부를 판정하지 않으며, 페이지나 프로젝트 소스를 직접 고치지 않습니다.
검사 자체에는 계정·LLM·외부 추론 서버가 필요하지 않습니다.

## 설치와 첫 스캔

1. 이 저장소를 내려받거나 복제합니다.
2. Chrome에서 `chrome://extensions`를 엽니다.
3. **개발자 모드 → 압축해제된 확장 프로그램을 로드**에서 저장소 루트를 선택합니다. 확장 자체는 빌드나 `npm install`이 필요 없습니다.
4. 검사할 웹페이지를 열고 밤티 아이콘을 누릅니다.
5. 단축키는 Mac **Control+Shift+B**, Windows/Linux **Alt+Shift+B**입니다. 충돌하면 `chrome://extensions/shortcuts`에서 변경하세요.

`http://`, `https://`, localhost를 검사합니다. `file://` HTML은 확장 세부정보에서
**파일 URL에 대한 액세스 허용**을 먼저 켜야 합니다.
Chrome 내부 페이지와 웹스토어 같은 제한된 페이지는 검사할 수 없습니다.

## 결과 읽기

| 결과 | 읽는 방법 |
|---|---|
| UI 패턴 | 24개 가중치 규칙으로 계산. 0–100은 AI 생성 확률이나 디자인 품질 점수가 아님 |
| 참고 패턴 | 폰트·팔레트·라이브러리 등 정상적인 선택도 포함. 10종, 점수 제외 |
| 한·영 문체 | 한국어 13패턴과 영어 어휘 39규칙. 반복·밀집을 검토하며 UI 점수와 분리 |
| 근거와 위치 | 원문·개선 방향을 읽고 **이 항목만 표시**로 요소나 문단 확인 |
| 복사 | 개별 제안, 전체 제안, JSON 리포트 복사. JSON에는 요소 셀렉터·HTML 일부 포함 |

**레이블·제목 구조 검토**는 기본 결과 목록에서 바로 표시하며 점수에는 넣지 않습니다.
`brand-tagline`, `service-name` 같은 클래스명을 검색하는 대신, 작은 레이블과 그 아래
제목의 위치·글자 크기·주변 구조를 검사합니다. 중간의 작은 화살표와 제목 래퍼도 처리합니다.
한 곳부터 검토하며, 서로 다른 제목 3곳 이상에 반복되면 반복 사용으로 표시합니다.
서비스명·대상 구분처럼 필요한 정보일 수 있는 항목은 문맥 확인으로 안내합니다.

현재 범위는 레이블 64자·15px 이하, 제목 크기 비율 1.4배 이상, 세로 간격 100px 이하입니다.
가로 위치가 겹쳐야 하며 탐색 깊이는 제한됩니다. 다른 카드의 제목, 숨긴 내용,
내비게이션·폼·표·날짜·상태 정보와 서비스형 화면은 제외합니다. 클래스명이나 사용 횟수만으로
AI 작성 여부 또는 불필요한 장식이라고 확정하지 않습니다. JSON에서는 기존 호환성을 위해
`taste`의 `eyebrow-microlabel` 항목을 사용하며, 전체 제안 복사와 개별 위치 표시를 지원합니다.

**0점은 현재 규칙이 놓친 패턴이 없다는 보장이 아닙니다.** 엔진은 정해진 시그니처를
검사하며, 화면 인상을 평가하는 LLM은 아직 연결되지 않았습니다. 분모가 전체 규칙의
가중치 합이므로 새 규칙을 추가하면 같은 페이지의 점수도 달라질 수 있습니다.

`glass-panel-overuse`는 5개 이상의 독립적인 큰 반투명 콘텐츠 패널에 블러 ≥8px와
모서리 ≥16px가 반복되고, 콘텐츠 제목의 70% 이상이 그 안에 있을 때 제안합니다.
단일 블러 헤더·작은 카드·중첩 컨테이너·피드·서비스 화면은 이 규칙에서 제외합니다.
임계값은 휴리스틱이며, AI 작성 여부를 검증한 통계적 분류기가 아닙니다.

문체 검사는 한국어 **im-not-ai**의 규칙 일부와 영어 **slop-gate**의 어휘 매칭을
브라우저용으로 적용한 것입니다. 전체 LLM 윤문 엔진이나 학습된 작성자 판별 모델이 아닙니다.
[원본 출처와 MIT 고지](../THIRD_PARTY_NOTICES.md), [임계값·검사 제외 영역](../src/prose/README.md)을 참고하세요.

문체의 기본 결과에는 **한 번만 나온 단어나 어구도 표시**합니다. 제목·짧은 설명·버튼·링크
문구를 글자 수나 반복 횟수 제한 없이 검사해 **표현 제안** 또는 **문맥 확인**으로 나눕니다.
`~를 통해`, `robust`처럼 자연스러울 수도 있는 표현은 문맥 확인이며, 고쳐야 한다거나
AI가 썼다는 뜻이 아닙니다. 메뉴·피드·인용·입력값·숨겨진 텍스트는 제외합니다.

추가 근거로 문단별 검사와 **최대 5개 인접 문단·2,400자 묶음 검사**를 함께 수행합니다.
짧더라도 실제 설명 문단이면 묶음에 포함하며, 링크 카드 안의 본문도 검사합니다.
문단 간 반복은 근거에 따로 표시하고 원래 문단 위치를 강조합니다. 메뉴·피드·인용·서로
다른 기사는 합산하지 않으며, 겹치는 묶음에서 발견한 같은 표현은 중복 집계하지 않습니다.

패널 상단 **언어 / Language**에서 한국어·English·브라우저 언어를 선택할 수 있습니다.
본문 검사 언어는 표시 언어와 별개이며, 페이지의 원문은 번역하지 않습니다.

## 권한과 자동 재검사

기본 권한은 `activeTab`, `scripting`, `sidePanel`, `storage`입니다.
선택형 호스트 권한으로 **이 사이트 항상 허용**을 제공합니다.
자동 재검사는 **패널이 열려 있고, 해당 페이지에 접근 권한이 있을 때만** 동작합니다.

- 클릭으로 받은 권한이 끊긴 출처에서는 아이콘을 다시 누르거나 출처를 허용합니다.
- 허용된 출처의 이동·새로고침이 감지되면 패널이 다시 검사합니다.
- 페이지 변경 중인 패널에서는 낡은 결과의 복사·위치 표시를 막습니다.
- 임의의 DOM 변경을 항상 감시하는 기능은 아닙니다. HMR만 일어난 경우 **다시 스캔**이 필요할 수 있습니다.
- 로컬 파일 접근과 선택형 호스트 권한은 서로 다른 설정입니다.

패널 상단 **자동 스캔 허용 사이트**에서 목록을 추가·삭제할 수 있습니다.

| 입력 | 허용 범위 |
|---|---|
| `*.*` 또는 `*` | 모든 HTTP·HTTPS 사이트 |
| `example.com` | 해당 도메인만, HTTP·HTTPS |
| `*.example.com` | 해당 도메인과 모든 하위 도메인, HTTP·HTTPS |
| `https://*.example.com/*` | 위 범위를 HTTPS로 한정 |
| `localhost` | 로컬 개발 서버의 모든 포트, HTTP·HTTPS |

추가 시 Chrome에 선택 권한을 요청합니다. 거절하면 목록은 변경하지 않습니다.
목록은 저장된 문자열이 아니라 **Chrome이 실제로 허용한 범위**이며, 재시작 후에도 유지됩니다.
호스트 단위 기능이므로 입력에 경로·포트를 넣을 수 없고, 모든 포트에 적용됩니다.
`*.*`는 로컬 파일이나 브라우저 내부 페이지를 포함하지 않습니다.
범위를 삭제해도 다른 와일드카드가 같은 사이트를 포함하면 계속 허용됩니다.
현재 사이트의 **자동 스캔 허용됨** 버튼은 이 목록을 엽니다.
권한의 원리는 Chrome 공식 [매치 패턴](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns)과
[선택 권한 API](https://developer.chrome.com/docs/extensions/reference/api/permissions)를 따릅니다.

## 로컬 MCP 연결

선택 기능입니다. 밤티만 쓰려면 이 단계를 건너뛰세요.
MCP 서버는 에이전트와 **stdio**로, 패널과 **로컬 WebSocket**으로 연결됩니다.
확장에 내장된 AI나 자동 코드 수정기가 아닙니다.

### 1. 서버 의존성 설치

Node.js 18 이상이 필요합니다. 저장소 루트에서:

```sh
npm ci --prefix mcp
```

### 2. 에이전트에 서버 등록

사용하는 MCP 클라이언트에서 **로컬 stdio 서버**로 등록합니다.

- 실행 명령: `node`
- 인수: 내려받은 저장소 안의 `mcp/server.mjs` **절대 경로**
- 선택 환경변수: `BAMTI_PORT` (기본 8765), `BAMTI_TOKEN`

`mcpServers` 형식을 쓰는 클라이언트의 설정 예시입니다.
실제 설정 파일 위치와 등록 방식은 클라이언트마다 다릅니다.

```json
{
  "mcpServers": {
    "bamti": {
      "command": "node",
      "args": ["/absolute/path/to/bamti/mcp/server.mjs"]
    }
  }
}
```

`/absolute/path/to/bamti`를 **본인의 실제 저장소 경로**로 바꿉니다.
에이전트가 서버 프로세스를 실행하게 하세요.
별도 터미널에서 같은 포트의 서버를 동시에 띄우면 `EADDRINUSE`가 발생합니다.
에이전트의 환경에서 `node`를 찾지 못하면 Node 실행 파일도 절대 경로로 지정하세요.

### 3. 밤티 패널 연결

서버 로그의 토큰을 확인합니다. 기본 토큰은 첫 실행에 만들어지며
사용자 홈의 `.bamti/token` 파일에 저장됩니다.
그 후 확장 패널 하단 **에이전트 → 포트·토큰 입력 → 연결**을 누릅니다.

서버는 `127.0.0.1`에만 바인드하며, 기본 생성 토큰은 6자리 HEX입니다.
공개 배포용으로 충분히 강화된 인증이라고 보지는 않습니다.
가능하면 `BAMTI_TOKEN`에 충분히 긴 임의 문자열을 지정하고 패널에도 같은 값을 넣으세요.
토큰은 README·스크린샷·커밋에 넣지 마세요.

### 4. 연결 확인과 사용

| 도구 | 역할 |
|---|---|
| `bamti_status` | 패널 연결 여부, 마지막 리포트 시각·URL 확인 |
| `bamti_scan` | 현재 탭 검사. 기본값은 요약, `full: true`는 전체 |
| `bamti_get_report` | 재검사 없이 서버에 남아 있는 마지막 리포트 조회 |
| `bamti_wait_for_report` | 호출 후 도착하는 다음 리포트 기다리기. 기본 60초, 최대 300초 |
| `bamti_highlight` | `signal_id`에 해당하는 요소·문단 표시 |
| `bamti_show_all` | 전체 표시 복원 |
| `bamti_clear_highlight` | 페이지 표시 지우기 |

**MCP 기본 요약에도 문체 결과가 포함됩니다.**
`bamti_scan`, `bamti_get_report`, `bamti_wait_for_report`에서
반복 근거는 `prose.signals`, 단일 표현 제안·문맥 확인은 `prose.fragments.signals`를
확인하세요. UI 결과는 `signals`, 참고 결과는 `taste`입니다.
요약은 항목당 예문 2개·셀렉터 3개를 포함하며 실제 발견 횟수는 유지합니다.
`prose.counts`는 반복 패턴·표현 제안·문맥 확인을 따로 셉니다. 문체의 가중치 0은
개선할 표현이 없다는 뜻이 아닙니다. `{"full": true}`는 전체 예문과 요소 HTML·좌표가 필요할 때 사용하세요.
요약의 `prose.status`는 두 검사 경로를 합친 상태이며, 원래 문단 검사 상태는 `paragraphStatus`입니다.

에이전트에게 보낼 요청 예시:

> 밤티 연결 상태를 확인하고 현재 탭을 full: true로 검사해줘.
> UI, prose.signals, prose.fragments.signals를 구분해 설명하고, 수정 전에 어떤 파일을 바꿀지 알려줘.

리포트에는 페이지의 URL·원문·요소 HTML 일부가 포함됩니다.
MCP를 연결하면 이 정보가 로컬 에이전트로 전달되며, 에이전트가 원격 모델에
보내는지는 그 에이전트의 설정·정책에 달려 있습니다.

**수정 → 새로고침 → 재검사** 흐름은 에이전트가 실제 소스 파일에 접근할 수 있고,
개발 페이지가 갱신되며, 확장 패널에 권한이 있을 때만 이어집니다.
다음 리포트 대기는 과거 이벤트를 재생하지 않습니다. 이미 검사가 끝났다면
`bamti_get_report`로 가져오고 URL·시각을 확인하거나 새로 스캔하세요.

## 보존되는 데이터와 남은 한계

- 언어·오버레이·브리지 설정은 `chrome.storage.local`에 저장합니다. 브리지 토큰도 이 설정에 포함됩니다.
- 서버 토큰 파일은 기본 생성 시 파일 권한 `0600`으로 저장합니다.
- 검사 결과는 패널과 서버의 메모리에만 있습니다. 영구 리포트 DB나 이벤트 큐는 없습니다.
- 서버가 재시작되면 마지막 결과가 사라집니다. 패널이 끊겨도 기존 서버 결과는 남을 수 있으므로 시각과 연결 상태를 확인하세요.
- 서버는 인증된 패널 하나만 관리합니다. 여러 에이전트 프로세스는 서로 다른 포트가 필요하며 결과를 공유하지 않습니다.
- 문체는 메뉴·제목·코드·인용·편집창·일부 피드 등을 제외합니다. 짧거나 가려진 내용은 놓칠 수 있습니다.
- UI는 렌더 요소 6,000개 / 방문 30,000개, 문체는 300블록 / 60,000자로 제한합니다. 일부 검사임을 표시합니다.
- 낮은 점수나 0개 결과는 사람 작성, AI 미사용, 높은 품질을 보장하지 않습니다.
- 비전 LLM 분석과 OAuth 연동은 현재 코드에 구현되어 있지 않습니다. 특정 구독으로 추론을 사용할 수 있다고 안내하지 않습니다.

## 개발·검증

확장 코드를 바꾼 뒤에는 `chrome://extensions`에서 밤티를 새로고침하고
이미 열린 사이드패널도 닫았다 다시 여세요.

루트에서 로컬 테스트 서버를 실행합니다:

```sh
python3 -m http.server 8777 --bind 127.0.0.1
```

별도 터미널에서 최초 1회 Playwright와 Chromium을 준비합니다:

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
```

| 명령 | 범위 |
|---|---|
| `node test/engine-precision.cjs` | UI 오탐·누락 31검사, `--live`로 공개 URL 추가 확인 |
| `node test/label-review.cjs` | 레이블·제목 연결·장식 반복·한영 패널 25검사 |
| `node test/prose.cjs` | 한영 문체·문단 간 반복·제외 영역·패널 75검사 |
| `node test/prose-fragments.cjs` | 단일 표현·분절된 DOM·제안 구분·패널 46검사 |
| `node mcp/report.test.mjs` | 문체 요약·단일 표현·문맥 구분·제한·호환성 20검사 |
| `node test/panel-ux.cjs` | 사용성·권한 오류·화면 크기·14개 UI 코퍼스 |
| `node test/site-access.cjs` | 와일드카드 입력·권한 승인/거절·삭제·동기화·한영 UI |
| `node test/i18n.cjs` | 한영 전환, 네이티브 확장 메타데이터·저장 |
| `node test/icons.cjs` | 아이콘·서비스 워커 로드 |
| `BAMTI_PORT=18766 node mcp/e2e.mjs` | 별도 테스트 포트에서 모의 패널과 MCP 왕복 로그 |
| `node test/readme.cjs` | README 링크·SVG XML·라이트/다크·모바일·글자 경계 |

테스트 페이지:
[패널 프리뷰](../test/panel-preview.html), [한영 예문](../test/fixtures/prose-bilingual.html), [문단 간 반복 예문](../test/fixtures/prose-distributed.html),
[레이블 구조 예문](../test/fixtures/label-review.html),
[짧은 표현 예문](../test/fixtures/prose-fragments.html),
[UI 회귀](../test/regression.html), [홍보용 재현 데모](../asset/viral/README.md).
프리뷰·MCP 모의 테스트는 실제 사용자 프로필의 연결 성공을 증명하지 않습니다.

### 구조도 수정

SVG의 원본은 [build.mjs](architecture/build.mjs)입니다. 한국어/영어, 데스크톱/모바일을 같은 데이터 구조로 생성합니다.

```sh
node docs/architecture/build.mjs --write
node docs/architecture/build.mjs --check
node test/readme.cjs
```

실행 가능한 외부 코드·폰트·이미지 없이 SVG 자체로 렌더링됩니다.
기본 팔레트와 `prefers-color-scheme` 기반 다크 팔레트가 들어 있습니다.

## English quick start

Bamti reviews UI patterns and Korean/English writing style. It does **not** determine
AI authorship, and it does not edit the page or project files.

1. Download this repository. Open `chrome://extensions`, enable Developer mode,
   and load the repository root as an unpacked extension. No extension build is required.
2. Open a web page and click Bamti. Shortcut: **Control+Shift+B on Mac**,
   **Alt+Shift+B on Windows/Linux**. Local HTML requires “Allow access to file URLs.”
3. Choose **English** or **Browser language** in the panel. Inspect evidence,
   suggestions and highlighted locations. Writing findings do not affect UI scores.
4. Optional MCP: run `npm ci --prefix mcp`, then configure your agent to launch
   `node` with the absolute path to `mcp/server.mjs` as a stdio server.
   Do not start a second server on the same port.
5. Copy the server token into the panel’s **Agent** section and connect to its
   port (default 8765). Prefer a long random `BAMTI_TOKEN`; authentication still
   needs hardening. Do not expose the server publicly.
6. Use `bamti_status` to check the connection. Default scan/get/wait summaries
   include repeated writing findings in `prose.signals` and single-expression
   advice in `prose.fragments.signals`, with separate counts and review levels.
   Summaries keep two examples and three selectors per item; `{"full": true}`
   returns all stored examples and element details. A writing weight of zero
   means excluded from the UI score, not that no editing suggestions exist.

Reports may include page text and HTML excerpts. The optional agent receives
those reports; any subsequent model sharing depends on the agent configuration.
Reports are in-memory snapshots, not durable history. Verify their URL and time.
LLM visual review and OAuth are not implemented.

A zero score only means the current rules found no scored patterns. The new
glass-panel rule checks repeated large translucent, blurred, rounded content
surfaces, not AI authorship. Thresholds are heuristic, and scores are not
calibrated probabilities or directly comparable across different rule versions.

Single expressions are shown by default, even once, with no length or repetition
gate. Headings, short descriptions, buttons and link text are included. Wording
suggestions are distinguished from context checks for ordinary or technical terms;
neither determines AI authorship. Navigation, input values, code and quotations
remain excluded.

Small labels above headings also appear directly in the results, without affecting
the UI score. Matching uses rendered structure, not class names; small arrows and
heading wrappers are supported. Even a single label is reviewable, and three or
more distinct heading locations are marked as repeated use. Service identifiers
and audience labels are contextual information, not automatic deletion advice.
Navigation, forms, tables, dates, status indicators and application screens are
excluded. JSON keeps this review under `taste` with ID `eyebrow-microlabel`.

Additional writing evidence covers individual paragraphs and nearby groups (up to 5 blocks /
2,400 characters). Real prose inside linked cards is included. Cross-paragraph
findings retain their original locations and deduplicate overlapping matches;
navigation, feeds, quotations and separate articles are not pooled.

Open **Auto-scan allowed sites** to manage persistent Chrome host access.
Use `*.*` for all HTTP/HTTPS sites, `*.example.com` for a domain and its subdomains,
or `https://*.example.com/*` for HTTPS only. Bare domains cover both schemes.
All ports are included; explicit ports and paths are not accepted. Access requires
Chrome permission approval and remains unchanged if declined. The list reflects
actual grants, including changes made outside the panel. Removing one scope does
not override other overlapping grants. Auto-scan still requires an open panel;
`*.*` does not include local files or internal browser pages.

[English diagram](architecture/bamti-en.svg) · [Detailed writing limits](../src/prose/README.md) · [MIT notices](../THIRD_PARTY_NOTICES.md)
