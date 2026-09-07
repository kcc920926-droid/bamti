import assert from 'node:assert/strict';
import { summarize } from './report.mjs';
const item = { id: 'prose-fragment-en-cutting-edge', label: 'Wording suggestion: cutting-edge',
  language: 'en', reviewLevel: 'suggestion', analysisScopes: ['fragment'], weight: 0, count: 4, occurrences: 4,
  hint: 'Describe what is new.', evidence: 'One expression is enough.',
  targets: Array.from({ length: 4 }, (_, i) => ({ selector: '#h' + i, html: '<h2>Cutting-edge</h2>' })),
  examples: Array.from({ length: 4 }, (_, i) => ({ text: 'cutting-edge', excerpt: 'Our cutting-edge tool', ruleId: 'cutting-edge', block: i + 1, start: 4, end: 16 })) };
const report = { score: 0, firedCount: 0, totalSignals: 24, signals: [], prose: {
  status: 'insufficient', signals: [], languages: [], inspectedBlocks: 0,
  fragments: { status: 'checked', inspectedBlocks: 4, languages: ['en'], limited: true,
    signals: [item, { ...item, id: 'prose-fragment-en-robust', reviewLevel: 'context' }] } } };
const before = JSON.stringify(report), r = summarize(report);
assert.equal(r.score, 0);
assert.deepEqual(r.signals, []);
assert.equal(r.prose.status, 'checked');
assert.equal(r.prose.paragraphStatus, 'insufficient');
assert.deepEqual(r.prose.languages, ['en']);
assert.deepEqual(r.prose.counts, { repeatedPatterns: 0, wordingSuggestions: 1, contextChecks: 1 });
assert.equal(r.prose.limited, true);
assert.equal(r.prose.fragments.signals[0].fix, item.hint);
assert.deepEqual(r.prose.fragments.signals[0].targets, ['#h0', '#h1', '#h2']);
assert.equal(r.prose.fragments.signals[0].examples.length, 2);
assert.equal(r.prose.fragments.signals[0].occurrences, 4);
assert.equal(r.prose.fragments.signals[1].reviewLevel, 'context');
assert(!JSON.stringify(r).includes('<h2>'));
assert.equal(JSON.stringify(report), before);
assert.equal(summarize(null), null);
assert.equal(summarize({}).prose, null);
assert.equal(summarize({ prose: { status: 'error' } }).prose.status, 'error');
const legacy = summarize({ prose: { status: 'checked', signals: [{ ...item, analysisScopes: ['paragraph'] }] } });
assert.equal(legacy.prose.counts.repeatedPatterns, 1);
assert.equal(legacy.prose.fragments, null);
assert.match(r.note, /weight=0/);
console.log('PASS: 20 summary assertions: single expressions, context, scope, bounds, missing/error/legacy data, unchanged report');
