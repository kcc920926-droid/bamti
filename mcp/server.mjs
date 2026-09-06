#!/usr/bin/env node
/* bamti-mcp — 밤티 확장과 로컬 AI 에이전트를 잇는 다리.
 *
 *   Claude Code ──stdio(MCP)──▶ 이 프로세스 ◀──ws://127.0.0.1:PORT── 밤티 사이드패널
 *
 * stdout 은 MCP 프로토콜 전용이다. 모든 로그는 stderr 로 간다.
 * 확장은 항상 WS 클라이언트. 이 서버는 127.0.0.1 에만 바인드하고 토큰으로 첫 메시지를 검사한다 —
 * localhost 포트는 브라우저의 어떤 탭이든 두드릴 수 있기 때문이다.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { WebSocketServer } from 'ws';
import { z } from 'zod';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const PORT = Number(process.env.BAMTI_PORT || 8765);
const log = (...a) => console.error('[bamti-mcp]', ...a);

/* ── 토큰: 환경변수 > ~/.bamti/token > 새로 생성 ─────────────────── */
const dir = path.join(os.homedir(), '.bamti');
const tokenFile = path.join(dir, 'token');
let TOKEN = (process.env.BAMTI_TOKEN || '').trim();
if (!TOKEN) {
  try { TOKEN = fs.readFileSync(tokenFile, 'utf8').trim(); } catch {}
  if (!TOKEN) {
    TOKEN = crypto.randomBytes(3).toString('hex').toUpperCase();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(tokenFile, TOKEN, { mode: 0o600 });
  }
}

/* ── 패널 연결 상태 ───────────────────────────────────────────────── */
let panel = null;            // 인증된 패널 소켓 (하나만)
let panelInfo = null;
let lastReport = null;
let lastReportAt = 0;
const pending = new Map();   // request id → {resolve, reject}
const waiters = [];          // wait_for_report 대기자

const wss = new WebSocketServer({ host: '127.0.0.1', port: PORT });
wss.on('listening', () => {
  log(`ws://127.0.0.1:${PORT} 대기 중`);
  log(`토큰: ${TOKEN}   ← 밤티 패널 하단 "에이전트" → 토큰에 입력 (파일: ${tokenFile})`);
});
wss.on('error', e => { log('WS 서버 오류:', e.message); if (e.code === 'EADDRINUSE') { log(`포트 ${PORT} 사용 중 — BAMTI_PORT 로 바꾸세요`); process.exit(1); } });
wss.on('connection', ws => {
  let authed = false;
  ws.on('message', buf => {
    let m; try { m = JSON.parse(String(buf)); } catch { return; }
    if (!authed) {
      if (m.type === 'hello' && typeof m.token === 'string' && m.token === TOKEN) {
        authed = true;
        if (panel && panel !== ws) { try { panel.close(); } catch {} }
        panel = ws; panelInfo = { client: m.client, version: m.version, at: Date.now() };
        ws.send(JSON.stringify({ type: 'welcome' }));
        log('패널 연결됨', m.client || '', m.version || '');
      } else {
        ws.send(JSON.stringify({ type: 'error', reason: 'bad-token' }));
        ws.close();
        log('토큰 불일치 연결 거절');
      }
      return;
    }
    if (m.type === 'report' && m.report) {
      lastReport = m.report; lastReportAt = Date.now();
      log(`리포트 수신 ${m.report.score}점 · ${m.report.firedCount}/${m.report.totalSignals} · ${String(m.report.url || '').slice(0, 60)}`);
      for (const w of waiters.splice(0)) w.resolve(m.report);
      return;
    }
    if (m.type === 'result' && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.ok ? p.resolve(m.data) : p.reject(new Error(m.error || '패널 오류'));
    }
  });
  ws.on('close', () => { if (panel === ws) { panel = null; panelInfo = null; log('패널 연결 끊김'); } });
});

const NO_PANEL = '밤티 패널이 연결되어 있지 않습니다. 크롬에서 밤티 사이드패널을 열고, 하단 "에이전트" → 포트·토큰 입력 → "연결"을 누르세요.';
function request(action, params = {}, timeoutMs = 30000) {
  if (!panel) return Promise.reject(new Error(NO_PANEL));
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { pending.delete(id); reject(new Error(`패널 응답 없음 (${action}, ${timeoutMs / 1000}s)`)); }, timeoutMs);
    pending.set(id, { resolve: v => { clearTimeout(t); resolve(v); }, reject: e => { clearTimeout(t); reject(e); } });
    panel.send(JSON.stringify({ type: 'request', id, action, params }));
  });
}

/* ── 리포트 요약: 에이전트가 처음 받아 볼 형태. full 은 요소 12개까지 전부 ── */
function summarize(r) {
  if (!r) return null;
  return {
    url: r.url, title: r.title, scannedAt: r.scannedAt,
    score: r.score, band: r.bandLabel, verdict: r.bandLine,
    fired: `${r.firedCount}/${r.totalSignals}`,
    byCat: Object.fromEntries(Object.entries(r.byCat || {}).map(([k, v]) => [k, `${v.name} ${v.count}`])),
    signals: (r.signals || []).map(s => ({
      id: s.id, weight: s.weight, cat: s.cat, scope: s.scope, label: s.label,
      evidence: s.evidence, count: s.count, fix: s.hint,
      targets: (s.targets || []).slice(0, 3).map(t => t.selector),
    })),
    taste: (r.taste || []).map(s => ({ id: s.id, label: s.label, evidence: s.evidence, fix: s.hint })),
    note: '가중치(weight)가 높은 것부터 고치세요. unfinished 카테고리는 취향이 아니라 결함입니다. full=true 로 요소별 selector·text·outerHTML 을 받을 수 있습니다.',
  };
}
const text = obj => ({ content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2) }] });
const fail = e => ({ content: [{ type: 'text', text: `오류: ${e.message}` }], isError: true });

/* ── MCP 도구 ─────────────────────────────────────────────────────── */
const server = new McpServer({ name: 'bamti', version: '0.2.0' });

server.tool('bamti_status',
  '밤티 확장과의 연결 상태, 마지막 리포트 요약(점수·시각·URL)을 반환한다. 다른 도구가 실패하면 먼저 이걸 호출해 원인을 본다.',
  {},
  async () => text({
    panelConnected: !!panel, panel: panelInfo, port: PORT,
    lastReport: lastReport ? { url: lastReport.url, score: lastReport.score, band: lastReport.bandLabel, at: new Date(lastReportAt).toISOString() } : null,
    howToConnect: panel ? undefined : NO_PANEL,
  }));

server.tool('bamti_scan',
  '크롬의 현재 탭을 밤티로 스캔해 AI slop 지문 리포트를 반환한다. 각 signal 에 label(무엇), evidence(근거), fix(어떻게 고칠지), targets(요소 CSS 셀렉터)가 있다. ' +
  'full=true 면 요소별 selector·text·outerHTML·좌표를 12개까지 포함한다 — 소스에서 해당 요소를 찾아 고칠 때 쓴다. ' +
  '수정 후 개발 서버가 리로드되면 패널이 자동 재스캔하니 bamti_wait_for_report 로 새 점수를 받아 확인하라.',
  { full: z.boolean().optional().describe('true: 요소 상세 포함 전체 리포트. 기본 false: 요약') },
  async ({ full }) => { try { const r = await request('scan'); lastReport = r; lastReportAt = Date.now(); return text(full ? r : summarize(r)); } catch (e) { return fail(e); } });

server.tool('bamti_get_report',
  '다시 스캔하지 않고 마지막 리포트를 반환한다. 패널이 자동 재스캔한 최신 결과가 여기 있다.',
  { full: z.boolean().optional().describe('true: 요소 상세 포함 전체') },
  async ({ full }) => lastReport ? text(full ? lastReport : summarize(lastReport)) : fail(new Error('아직 리포트가 없습니다. bamti_scan 을 먼저 호출하세요.')));

server.tool('bamti_wait_for_report',
  '패널이 다음 리포트를 보낼 때까지 기다린다(페이지 새로고침/이동 → 자동 재스캔). 코드를 고친 뒤 결과 확인용. 시간 안에 오지 않으면 오류.',
  { timeout_s: z.number().min(1).max(300).optional().describe('대기 시간(초), 기본 60'), full: z.boolean().optional() },
  async ({ timeout_s = 60, full }) => {
    try {
      const r = await new Promise((resolve, reject) => {
        const t = setTimeout(() => { const i = waiters.findIndex(w => w.resolve === resolve); if (i >= 0) waiters.splice(i, 1); reject(new Error(`${timeout_s}s 안에 새 리포트가 오지 않았습니다`)); }, timeout_s * 1000);
        waiters.push({ resolve: v => { clearTimeout(t); resolve(v); } });
      });
      return text(full ? r : summarize(r));
    } catch (e) { return fail(e); }
  });

server.tool('bamti_highlight',
  '특정 시그널의 요소들만 페이지 위에 강조 표시한다. signal_id 는 리포트의 signals[].id.',
  { signal_id: z.string().describe('예: dead-links, value-sprawl') },
  async ({ signal_id }) => { try { return text(await request('highlight', { signal_id })); } catch (e) { return fail(e); } });

server.tool('bamti_show_all',
  '모든 지문 표시(기본 오버레이)로 되돌린다.',
  {},
  async () => { try { return text(await request('show_all')); } catch (e) { return fail(e); } });

server.tool('bamti_clear_highlight',
  '페이지 위 강조 표시를 모두 지운다.',
  {},
  async () => { try { return text(await request('clear')); } catch (e) { return fail(e); } });

await server.connect(new StdioServerTransport());
log('MCP 준비됨 (stdio)');
