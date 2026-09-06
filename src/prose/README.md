# Korean / English writing-style inspection

Runs locally during the existing click/shortcut scan, with no new permissions,
network requests, model downloads or paid inference. Output is `report.prose`;
existing UI `score`, `signals`, `firedCount` and denominators are unchanged.
The optional, user-enabled local MCP bridge also receives the prose report.

## What was applied

- Korean: 13 pattern families adapted from **im-not-ai**, plus three directly
  ported comma metrics exposed as `BAMTI.PROSE.koreanMetrics(text)`. Metrics are
  diagnostic helpers, not a second authorship score. Taxonomy IDs are retained.
- English: **slop-gate**'s 39 vocabulary regexes and matching loop, converted
  from a file CLI to browser prose blocks. All original hints remain in the
  bundled pack; the UI uses a bilingual cluster-level recommendation.
- This is a style linter. Neither engine can establish who wrote a text.
  No LLM rewriting, genre inference, probability score, proxy z-score, Korean
  nominalizer heuristic or punctuation-only verdict has been transplanted.
- `blader/humanizer` is primarily a prompt/skill, not a standalone browser
  detector. `judetelan/ai-humanizer` has executable detectors, but its default
  author verdict was not adopted. No repository skill was installed or run.

Pinned source revisions and required MIT notices: [THIRD_PARTY_NOTICES](../../THIRD_PARTY_NOTICES.md).

## Deliberately conservative adaptations

Each paragraph/block needs at least 80 characters after masking quotes and URLs.
Korean requires 30 Hangul syllables; English requires 12 Latin-alphabet words.
Both may run on a mixed-language paragraph, independent of the panel language.
Small menu labels and separate cards are never concatenated to satisfy a gate.

Korean thresholds apply **per block**, even for upstream document-level rules:
A-1/A-2/A-4/A-19/D-4/H-1 >=3; A-3/A-8/C-8/G-2 >=2;
A-10/D-1 >=4; C-11 >=6. A-3, A-8, A-19 and G-2 have extra repetition gates
compared with the upstream taxonomy. Korean syntax is approximated with regex,
not morphological parsing. C-8 covers only the not-A-but-B subset. Possibility
and hedging advice explicitly preserves uncertainty rather than inventing facts.

English needs >=4 nonoverlapping hits, >=3 different rule IDs and >=2.5% hits
per word in the same block. At least two distinct rule IDs must come from
outside the ambiguous-word set (leverage, robust, unlock, harness, proactive,
crucial, pivotal, vibrant, meticulous, realm, delve). Thus several technical
words alone are insufficient. “in the realm of” and “realm” count only once.
One em dash or one “delve” does not produce a finding. These are engineering
gates, **not calibrated accuracy thresholds**.

## Scope and limits

- Rendered body prose only, including offscreen prose and open shadow roots.
- Excludes headings, standalone links, navigation, headers/footers/asides, controls, editing fields, feeds,
  code, blockquotes/inline quote elements, math and hidden content. Quoted text
  and URLs inside ordinary prose are masked while preserving match offsets.
- Whole paragraphs get the existing page highlight; cards show source excerpts,
  suggestions and upstream links. JSON contains original match offsets, rule IDs,
  counts and element selectors. No automatic edits are made.
- Max 300 text blocks / 60,000 characters total / 6,000 per block / 30,000 visits.
  Shared DOM limits also apply. Partial coverage and insufficient text are
  displayed explicitly; 0 findings never means human-authored or high quality.
- Closed shadow roots, iframe contents, canvas text and unrendered pages are not
  covered. Short slogans, text split across nested block wrappers, quotations,
  excluded containers and posts in feeds may be missed deliberately.
- This is not a benchmarked human-vs-AI classifier. A human can use every
  pattern, and AI can write without any of them. Tests establish implementation
  behavior, not real-world detection accuracy.

## Verification

With Playwright available and `python3 -m http.server 8777` running at repo root:

```
node test/prose.cjs
node test/engine-precision.cjs
node test/panel-ux.cjs
node test/i18n.cjs
```

Open `/test/fixtures/prose-bilingual.html`, then scan with the extension to try
both languages and normal/quoted controls on one page.
