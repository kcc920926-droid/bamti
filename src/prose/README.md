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
  bundled pack; the UI uses bilingual cluster and individual-expression advice.
- This is a style linter. Neither engine can establish who wrote a text.
  No LLM rewriting, genre inference, probability score, proxy z-score, Korean
  nominalizer heuristic or punctuation-only verdict has been transplanted.
- `blader/humanizer` is primarily a prompt/skill, not a standalone browser
  detector. `judetelan/ai-humanizer` has executable detectors, but its default
  author verdict was not adopted. No repository skill was installed or run.

Pinned source revisions and required MIT notices: [THIRD_PARTY_NOTICES](../../THIRD_PARTY_NOTICES.md).

## Default editing review: single expressions

The panel now shows individual expression suggestions **by default**, without
minimum character counts, language counts, repeated occurrences or density gates.
Headings, short descriptions, buttons and visible link text are eligible. Inline
markup inside one text area is reconstructed; independent blocks and excluded
content are not spliced into artificial phrases. Input values, placeholders,
hidden text, quotations, code, navigation and feeds remain excluded.

The same pinned Korean/English regexes produce two kinds of editing advice:

- `suggestion`: wording worth reviewing, such as hype, wordy constructions or
  stock openings. One occurrence is enough to show its location and advice.
- `context`: ordinary constructions and technical terms (for example, “~를 통해”
  or “robust”). They remain visible but explicitly allow keeping appropriate wording.

These labels describe editing priority, not empirical AI confidence. Korean
advice and English grouping are Bamti adaptations, not upstream authorship scores.
Identical rule matches at multiple locations share one card with actual counts.
Overlapping vocabulary matches are deduplicated; a repeated-pattern finding in
the same element suppresses its duplicate single-expression card.

`report.prose.version` is 3. `prose.fragments` contains its own `status`,
`inspectedBlocks`, `characters`, `languages`, `limited` and `signals`. Each signal
has `reviewLevel`, `analysisScopes: ["fragment"]`, source rule ID, examples and
element targets. Example offsets refer to the extracted contiguous text fragment,
not an artificial document-wide string. The panel includes these findings in
search, copy, JSON, highlights and optional agent highlight lookup.

The existing `prose.status` and `prose.signals` still describe the paragraph-based
pass below; `prose.status: "insufficient"` does not mean fragments were unchecked.
The panel reads both passes and no longer hides short-copy results behind that status.

Default MCP scan/get/wait summaries include both `prose.signals` and
`prose.fragments.signals`, with separate counts, review levels, two examples and
three selectors per item. Summary `prose.status` combines both passes while
`paragraphStatus` preserves the original paragraph status. `full: true` remains
available for all stored examples and detailed element targets.

## Additional paragraph and cross-paragraph evidence

The original single-paragraph pass needs at least 80 characters after masking quotes and URLs.
Korean requires 30 Hangul syllables; English requires 12 Latin-alphabet words.
Both may run on a mixed-language paragraph, independent of the panel language.
In addition, semantic prose (`p`, `li`, `dd`, `figcaption`, `role=paragraph`) can
join a nearby-paragraph pass with >=24 masked characters and >=10 Hangul syllables
or >=5 Latin-alphabet words. Bare layout text keeps the original minimums.
Matches are collected within original blocks; text is **not concatenated**.

Korean repetition thresholds apply to each block and eligible nearby groups:
A-1/A-2/A-4/A-19/D-4/H-1 >=3; A-3/A-8/C-8/G-2 >=2;
A-10/D-1 >=4; C-11 >=6. A-3, A-8, A-19 and G-2 have extra repetition gates
compared with the upstream taxonomy. Korean syntax is approximated with regex,
not morphological parsing. C-8 covers only the not-A-but-B subset. Possibility
and hedging advice explicitly preserves uncertainty rather than inventing facts.

English needs >=4 nonoverlapping hits, >=3 different rule IDs and >=2.5% hits
per word in the block or group. At least two distinct rule IDs must come from
outside the ambiguous-word set (leverage, robust, unlock, harness, proactive,
crucial, pivotal, vibrant, meticulous, realm, delve). Thus several technical
words alone are insufficient. “in the realm of” and “realm” count only once.
One em dash or one “delve” does not produce a repeated-pattern finding; “delve”
can still appear as a single-expression context check. These are engineering
gates, **not calibrated accuracy thresholds**.

Nearby groups are contiguous windows of at most 5 eligible blocks and 2,400 raw
characters, confined to the same nearest article/ARIA article/main region or DOM
root. Separate articles and shadow roots never pool matches. A window needs hits
in >=2 distinct blocks and >=60% of its language-eligible blocks. Korean additionally
requires >=0.006 occurrences per Hangul syllable to avoid accumulating sparse,
ordinary constructions solely because a document is long.

The aggregate pass only fills gaps: if a block already qualifies for that same
rule locally, that window is skipped for the rule, so strong paragraphs cannot
pull normal neighbors into their finding. Identical paragraph text is counted
once per window; overlapping windows deduplicate each original match by block,
rule ID and offsets. None of these gates is a measured recall/precision estimate.

## Scope and limits of the two passes

- Rendered body prose only, including offscreen prose and open shadow roots.
- The paragraph pass excludes headings, bare link labels, navigation, headers/footers/asides, controls, editing fields, feeds,
  code, blockquotes/inline quote elements, math and hidden content. Quoted text
  and URLs inside ordinary prose are masked while preserving match offsets.
- The paragraph pass includes real paragraphs inside linked cards but excludes
  bare linked titles and labels. Semantic article cards are independent aggregation
  regions. The fragment pass includes headings, link labels and button copy,
  including hero headers, and does not aggregate across elements.
- Whole paragraphs get the existing page highlight; cards show source excerpts,
  suggestions and upstream links. JSON contains original match offsets, rule IDs,
  counts and element selectors. `analysisScopes` distinguishes `paragraph` and
  `nearby-paragraphs`. `crossParagraphWindows`
  records the number of candidate windows evaluated (not the number of findings).
  No automatic edits are made.
- Each pass: max 300 text blocks / 60,000 characters / 6,000 per block / 30,000 visits.
  Shared DOM limits also apply. Partial coverage and insufficient text are
  displayed explicitly; 0 findings never means human-authored or high quality.
- Closed shadow roots, iframe contents, canvas text and unrendered pages are not
  covered. Unknown vocabulary, phrases split across independent block wrappers,
  quotations, excluded containers and posts in feeds may still be missed.
- This is not a benchmarked human-vs-AI classifier. A human can use every
  pattern, and AI can write without any of them. Tests establish implementation
  behavior, not real-world detection accuracy.

## Verification

With Playwright available and `python3 -m http.server 8777` running at repo root:

```
node test/prose.cjs
node test/prose-fragments.cjs
node test/engine-precision.cjs
node test/panel-ux.cjs
node test/i18n.cjs
```

Open `/test/fixtures/prose-bilingual.html`, then scan with the extension to try
both languages and normal/quoted controls on one page.
Use `/test/fixtures/prose-distributed.html` for examples where each individual
paragraph is below the original threshold but the neighboring group qualifies.
Use `/test/fixtures/prose-fragments.html` to verify that individual headings,
buttons and short phrases are shown without first meeting a repetition threshold.
