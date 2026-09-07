// Pure projection shared by scan/get/wait. Full reports remain untouched.
const summarizeSignal = s => ({
  id: s.id, weight: s.weight, cat: s.cat, scope: s.scope, label: s.label,
  evidence: s.evidence, count: s.count, fix: s.hint,
  targets: (s.targets || []).slice(0, 3).map(t => t.selector),
});
const summarizeWriting = s => ({
  ...summarizeSignal(s), language: s.language, reviewLevel: s.reviewLevel,
  analysisScopes: s.analysisScopes, occurrences: s.occurrences,
  examples: (s.examples || []).slice(0, 2).map(({ text, excerpt, ruleId, block, start, end }) => ({ text, excerpt, ruleId, block, start, end })),
});
function summarizeProse(p) {
  if (!p) return null;
  const patterns = p.signals || [], fragments = p.fragments?.signals || [];
  return {
    status: p.status === 'error' ? 'error' : p.status === 'checked' || p.fragments?.status === 'checked' ? 'checked' : p.status,
    paragraphStatus: p.status,
    languages: [...new Set([...(p.languages || []), ...(p.fragments?.languages || [])])],
    inspectedBlocks: p.inspectedBlocks, limited: !!(p.limited || p.fragments?.limited),
    counts: {
      repeatedPatterns: patterns.length,
      wordingSuggestions: fragments.filter(s => s.reviewLevel === 'suggestion').length,
      contextChecks: fragments.filter(s => s.reviewLevel === 'context').length,
    },
    signals: patterns.map(summarizeWriting),
    fragments: p.fragments ? {
      status: p.fragments.status, inspectedBlocks: p.fragments.inspectedBlocks,
      limited: !!p.fragments.limited, signals: fragments.map(summarizeWriting),
    } : null,
    note: p.note,
  };
}
export function summarize(r) {
  if (!r) return null;
  return {
    url: r.url, title: r.title, scannedAt: r.scannedAt,
    score: r.score, band: r.bandLabel, verdict: r.bandLine,
    fired: `${r.firedCount}/${r.totalSignals}`,
    byCat: Object.fromEntries(Object.entries(r.byCat || {}).map(([k, v]) => [k, `${v.name} ${v.count}`])),
    signals: (r.signals || []).map(summarizeSignal),
    taste: (r.taste || []).map(s => ({ id: s.id, label: s.label, evidence: s.evidence, fix: s.hint })),
    prose: summarizeProse(r.prose),
    note: 'UI 점수와 문체를 구분하세요. 문체의 weight=0은 개선할 표현이 없다는 뜻이 아닙니다. prose.signals는 반복 근거, prose.fragments.signals는 단일 표현 제안입니다. reviewLevel=context는 일반·기술 표현일 수 있으므로 무조건 고치지 마세요. full=true로 전체 예문과 요소 상세를 받을 수 있습니다.',
  };
}
