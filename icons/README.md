# 밤티 확장 프로그램 아이콘

`manifest.json`의 `icons`와 `action.default_icon`은 `bamti-*.png`를 사용합니다.
기존 `16.png`, `48.png`, `128.png`는 단색 임시 이미지이며 더 이상 참조하지 않습니다.

- 원본: `asset/illustrations/bamti-icon.png`
- 크기: 16, 24, 32, 48, 128px. 툴바의 배율과 확장 관리 화면에 대응합니다.
- 생성: 내장 imagegen, 2026-09-06. 기존 `bamti-inspector.png` 캐릭터를 참고했습니다.
- 변환: macOS `sips -z SIZE SIZE asset/illustrations/bamti-icon.png --out icons/bamti-SIZE.png`
- 검사: Playwright 설치 환경에서 `node test/icons.cjs`

최종 생성 프롬프트:

> Use case: logo-brand. Asset type: production Chrome extension toolbar icon for Bamti, needs to be recognizable at 16 and 32 pixels. Input image 1 is a character identity reference, not a layout to preserve. Create one square, tightly framed simplified chestnut inspector icon derived from this friendly brown chestnut with a magnifying glass. Preserve the pointed chestnut silhouette, warm reddish brown body, cream base, dark eyes, friendly character and dark magnifying glass. Remove the webpage prop, hands, detailed pencil texture, tiny accents and blush; simplify to chunky clean flat filled shapes with a thick dark brown outline and a thin cream outer keyline that is visible against both dark and light browser toolbars. One large magnifying-glass circle over one eye, short handle. The chestnut fills approximately 90% of the square with modest consistent padding. Genuine transparent background/alpha outside silhouette, no white canvas, no shadows, no text, no watermark, no mockup, no extra objects. Deliver a single high resolution square PNG icon master.

투명 배경 보정 프롬프트:

> Use case: background-extraction. Edit target: the supplied chestnut inspector icon. Remove the entire gray-and-white checkerboard background outside the chestnut silhouette. Output a genuine RGBA PNG with transparent alpha pixels outside the cream outline. DO NOT paint or render a checkerboard, white background, or any background pixels. Preserve the complete chestnut icon, cream outer border, colors, composition, magnifying glass, eyes and smile exactly. Change only the background to actual transparency.

업데이트 후 `chrome://extensions`에서 밤티를 새로고침하세요. 주소창 옆에 계속 표시하려면
크롬의 확장 프로그램(퍼즐) 메뉴에서 밤티를 고정해야 합니다.
설정 근거: https://developer.chrome.com/docs/extensions/reference/api/action
