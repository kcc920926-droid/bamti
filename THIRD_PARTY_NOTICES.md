# Writing-style rule provenance

Bamti includes adaptations of two MIT-licensed projects. Both copyright and
permission notices are distributed in `third_party/`.

## im-not-ai

- Repository: https://github.com/epoko77-ai/im-not-ai
- Pinned revision: `31a66d165a9cc6c26c4c1246553f95d0468d27fb`
- Copyright (c) 2026 epoko77-ai
- License: [MIT](third_party/im-not-ai-LICENSE.txt)
- Adapted source: `skills/humanize-korean/references/quick-rules.md`
  (A-1, A-2, A-3, A-4, A-8, A-10, A-19, C-8, C-11, D-1, D-4, G-2, H-1).
- Ported source: `skills/humanize-korean/references/metrics.py`
  (`_split_sentences`, comma_inclusion_rate, comma_usage_rate, ending_comma_rate).
- Destination: `src/prose/prose.js`. Korean pattern matching is a Bamti regex
  implementation of the source taxonomy, not the source's full LLM pipeline.
  Threshold changes, exclusions and unsupported features are documented below.

## slop-gate

- Repository: https://github.com/hwajongpark/slop-gate
- Pinned revision: `cae0ef32cdf2de03cd636642bfa5deb30a5051dd`
- Copyright (c) 2026 Hwajong (Howard) Park
- License: [MIT](third_party/slop-gate-LICENSE.txt)
- `rules/vocabulary.json`: all 39 original rules, IDs, regexes and upstream hints
  preserved in `src/prose/english-rules.js`, with a browser namespace wrapper.
- `bin/slop-gate.js`: rule compilation and reset-lastIndex/matchAll matching
  adapted to rendered prose blocks in `src/prose/prose.js`.
- The CLI, filesystem walker, remote execution, punctuation pack and upstream
  single-match failure policy are not included. Bamti adds overlap suppression,
  paragraph-level gates and its own bilingual review wording.

See [integration notes](src/prose/README.md). Upstream claims about authorship
or model-specific signatures are not Bamti accuracy claims.
