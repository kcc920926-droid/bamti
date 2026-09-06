#!/usr/bin/env node
/* bamti-mcp 끝단 검증 — 크롬 없이.
 *   node mcp/e2e.mjs            : 가짜 패널을 붙여 도구 왕복 전체 검증
 *   node mcp/e2e.mjs --wait     : 진짜 패널(프리뷰/확장)이 붙을 때까지 기다린 뒤 bamti_scan 호출
 * MCP 클라이언트가 서버를 stdio 로 띄우므로, 서버는 이 스크립트가 살아 있는 동안만 산다.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import WebSocket from 'ws';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');   // 레포 루트
const WAIT = process.argv.includes('--wait');
const PORT = process.env.BAMTI_PORT || '8766';
const TOKEN = process.env.BAMTI_TOKEN || 'TEST01';
const out = (k, v) => console.log(`${k.padEnd(22)} ${typeof v === 'string' ? v : JSON.stringify(v)}`);
const parse = res => { const t = res.content?.[0]?.text || ''; try { return JSON.parse(t); } catch { return t; } };

const client = new Client({ name: 'bamti-e2e', version: '0' });
await client.connect(new StdioClientTransport({
  command: 'node', args: [path.join(here, 'server.mjs')],
  env: { ...process.env, BAMTI_PORT: PORT, BAMTI_TOKEN: TOKEN }, stderr: 'pipe',
}));
out('connected', 'mcp stdio');
const tools = (await client.listTools()).tools.map(t => t.name);
out('tools', tools);

if (!WAIT) {
  // 1) 잘못된 토큰은 거절되어야 한다
  await new Promise(r => setTimeout(r, 300));
  const badMsg = await new Promise(res => {
    const w = new WebSocket(`ws://127.0.0.1:${PORT}`);
    w.on('open', () => w.send(JSON.stringify({ type: 'hello', token: 'WRONG' })));
    w.on('message', b => res(JSON.parse(String(b)).type));
    w.on('error', e => res('error:' + e.message));
  });
  out('bad token →', badMsg);

  // 2) 패널 없이 scan 은 안내 메시지와 함께 실패해야 한다
  const noPanel = await client.callTool({ name: 'bamti_scan', arguments: {} });
  out('scan w/o panel', { isError: !!noPanel.isError, text: parse(noPanel).slice(0, 40) });

  // 3) 가짜 패널: hello → scan 요청에 가짜 리포트로 응답
  const fake = {
    url: 'http://localhost:5173/', title: 'Vite + React', scannedAt: new Date().toISOString(),
    score: 79, bandLabel: '많이 티남', bandLine: 'AI 생성 기본값이 거의 그대로 남아있습니다.', firedCount: 23, totalSignals: 30,
    byCat: { unfinished: { name: '미완성 흔적', count: 5 } },
    signals: [{ id: 'dead-links', cat: 'unfinished', weight: 12, label: '죽은 링크', evidence: '링크 26개 중 26개가 href="#"', count: 26, hint: '최우선 수정',
                targets: [{ selector: 'footer .cols > div:nth-of-type(2) > a:nth-of-type(3)', text: 'Careers', html: '<a href="#">Careers</a>' }] }],
    taste: [],
  };
  const panel = new WebSocket(`ws://127.0.0.1:${PORT}`);
  await new Promise(res => {
    panel.on('open', () => panel.send(JSON.stringify({ type: 'hello', token: TOKEN, client: 'fake-panel', version: 'e2e' })));
    panel.on('message', b => {
      const m = JSON.parse(String(b));
      if (m.type === 'welcome') res();
      if (m.type === 'request') {
        if (m.action === 'scan') { panel.send(JSON.stringify({ type: 'result', id: m.id, ok: true, data: fake })); panel.send(JSON.stringify({ type: 'report', report: fake })); }
        else if (m.action === 'highlight') panel.send(JSON.stringify({ type: 'result', id: m.id, ok: true, data: { highlighted: 26, signal: m.params.signal_id } }));
        else panel.send(JSON.stringify({ type: 'result', id: m.id, ok: false, error: 'unsupported in fake' }));
      }
    });
  });
  out('fake panel', 'welcome 받음');

  const st = parse(await client.callTool({ name: 'bamti_status', arguments: {} }));
  out('status', { panelConnected: st.panelConnected, client: st.panel?.client });

  const sum = parse(await client.callTool({ name: 'bamti_scan', arguments: {} }));
  out('scan summary', { score: sum.score, fired: sum.fired, firstSignal: sum.signals?.[0]?.id, targets: sum.signals?.[0]?.targets });

  const full = parse(await client.callTool({ name: 'bamti_scan', arguments: { full: true } }));
  out('scan full', { hasHtml: !!full.signals?.[0]?.targets?.[0]?.html, title: full.title });

  const hl = parse(await client.callTool({ name: 'bamti_highlight', arguments: { signal_id: 'dead-links' } }));
  out('highlight', hl);

  const got = parse(await client.callTool({ name: 'bamti_get_report', arguments: {} }));
  out('get_report', { score: got.score });

  // 4) wait_for_report: 1.5초 뒤 패널이 새 리포트를 푸시하면 깨어나야 한다
  setTimeout(() => panel.send(JSON.stringify({ type: 'report', report: { ...fake, score: 12, bandLabel: '깨끗함', firedCount: 2 } })), 1500);
  const t0 = Date.now();
  const waited = parse(await client.callTool({ name: 'bamti_wait_for_report', arguments: { timeout_s: 10 } }));
  out('wait_for_report', { score: waited.score, ms: Date.now() - t0 });

  panel.close();
  await new Promise(r => setTimeout(r, 200));
  const st2 = parse(await client.callTool({ name: 'bamti_status', arguments: {} }));
  out('status after close', { panelConnected: st2.panelConnected });
} else {
  out('waiting', `진짜 패널이 ws://127.0.0.1:${PORT} 에 토큰 ${TOKEN} 으로 붙을 때까지 (최대 120s)`);
  let connected = false;
  for (let i = 0; i < 240 && !connected; i++) {
    await new Promise(r => setTimeout(r, 500));
    connected = parse(await client.callTool({ name: 'bamti_status', arguments: {} })).panelConnected;
  }
  out('panel', connected ? '연결됨' : '시간 초과');
  if (connected) {
    const sum = parse(await client.callTool({ name: 'bamti_scan', arguments: {} }));
    out('real scan', { score: sum.score, fired: sum.fired, url: sum.url, signals: sum.signals?.length, firstTargets: sum.signals?.[0]?.targets });
    const full = parse(await client.callTool({ name: 'bamti_scan', arguments: { full: true } }));
    const t = full.signals?.find(s => s.targets?.length)?.targets?.[0];
    out('real target sample', t ? { selector: t.selector, unique: t.unique, text: t.text, html: (t.html || '').slice(0, 80) } : '(없음)');
    const hl = parse(await client.callTool({ name: 'bamti_highlight', arguments: { signal_id: sum.signals?.[0]?.id } }));
    out('real highlight', hl);
  }
}
await client.close();
process.exit(0);
