// Optional Chrome host grants are the source of truth; no parallel allow list.
(() => {
  const B = (globalThis.BAMTI ||= {});
  const invalid = () => { throw new Error('example.com, *.example.com 또는 *.* 형식으로 입력하세요. 경로·포트는 지원하지 않습니다.'); };
  function parse(input) {
    let value = input.trim().toLowerCase();
    if (!value) invalid();
    let schemes = ['http', 'https'];
    const scheme = value.match(/^(https?|\*):\/\//);
    if (scheme) { if (scheme[1] !== '*') schemes = [scheme[1]]; value = value.slice(scheme[0].length); }
    value = value.replace(/\/(?:\*)?$/, '');
    if (value === '*.*') value = '*';
    if (value !== '*') {
      const wildcard = value.startsWith('*.');
      let host = wildcard ? value.slice(2) : value;
      if (/[\s/:?#@*\\%]/.test(host)) invalid();
      try { host = new URL(`https://${host}`).hostname; } catch { invalid(); }
      if (host.length > 253 || !host.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) invalid();
      if (wildcard && (host.split('.').length < 2 || /^\d+(?:\.\d+){3}$/.test(host))) invalid();
      value = (wildcard ? '*.' : '') + host;
    }
    return schemes.map(s => `${s}://${value}/*`);
  }
  function rows(origins) {
    const remaining = new Set(origins), result = [];
    for (const origin of origins) {
      if (!remaining.has(origin)) continue;
      const match = origin.match(/^(https?):\/\/(.+)\/\*$/);
      if (match && remaining.has(`http://${match[2]}/*`) && remaining.has(`https://${match[2]}/*`)) {
        const pair = [`http://${match[2]}/*`, `https://${match[2]}/*`];
        pair.forEach(o => remaining.delete(o));
        result.push({ label: match[2] === '*' ? '*.*' : match[2], origins: pair });
      } else {
        remaining.delete(origin);
        result.push({ label: origin, origins: [origin] });
      }
    }
    return result;
  }
  function mount({ onChange = () => {}, onGranted = () => {} } = {}) {
    const tr = B.I18N.t, $ = id => document.getElementById(id);
    let revision = 0, busy = false;
    const say = message => { $('siteaccess-status').textContent = message; };
    function lock(value) {
      busy = value;
      $('siteaccess').querySelectorAll('input, button').forEach(el => { el.disabled = value; });
    }
    async function refresh() {
      const ticket = ++revision;
      try {
        const { origins = [] } = await chrome.permissions.getAll();
        if (ticket !== revision) return;
        const list = $('siteaccess-list');
        list.replaceChildren();
        for (const row of rows(origins)) {
          const li = document.createElement('li'), scope = document.createElement('div');
          const label = document.createElement('strong'), detail = document.createElement('small');
          label.textContent = row.label;
          detail.textContent = row.origins.join(' · ');
          scope.append(label, detail);
          const remove = document.createElement('button');
          remove.type = 'button'; remove.className = 'pill'; remove.textContent = tr('삭제');
          remove.setAttribute('aria-label', tr`허용 범위 삭제: ${row.label}`);
          remove.disabled = busy;
          remove.onclick = async () => {
            if (busy) return;
            lock(true);
            try {
              const ok = await chrome.permissions.remove({ origins: row.origins });
              say(ok ? tr('선택한 허용 범위를 삭제했습니다. 겹치는 다른 범위가 있으면 계속 허용됩니다.') : tr('권한을 삭제하지 못했습니다. 다시 시도해주세요.'));
            } catch { say(tr('권한을 삭제하지 못했습니다. 다시 시도해주세요.')); }
            await refresh(); lock(false);
          };
          li.append(scope, remove); list.append(li);
        }
        $('siteaccess-empty').hidden = origins.length !== 0;
        $('siteaccess-count').textContent = String(rows(origins).length);
        $('siteaccess-list').hidden = false;
        onChange();
      } catch {
        if (ticket !== revision) return;
        $('siteaccess-count').textContent = '?';
        $('siteaccess-list').hidden = true;
        $('siteaccess-empty').hidden = true;
        say(tr('허용 목록을 읽지 못했습니다. 목록 새로고침을 눌러주세요.'));
      }
    }
    $('siteaccess-input').oninput = () => {
      try { $('siteaccess-preview').textContent = tr`요청할 범위: ${parse($('siteaccess-input').value).join(' · ')}`; }
      catch { $('siteaccess-preview').textContent = tr('example.com, *.example.com 또는 *.* 형식으로 입력하세요. 경로·포트는 지원하지 않습니다.'); }
    };
    $('siteaccess-form').onsubmit = async event => {
      event.preventDefault();
      if (busy) return;
      let origins;
      try { origins = parse($('siteaccess-input').value); }
      catch (error) { say(tr(error.message)); $('siteaccess-input').focus(); return; }
      lock(true);
      let granted = false;
      try {
        // Must be called synchronously from the submit gesture, before any await.
        granted = await chrome.permissions.request({ origins });
        say(granted ? tr('자동 스캔 권한을 허용했습니다.') : tr('허용하지 않았습니다. 기존 목록은 유지됩니다.'));
        if (granted) { $('siteaccess-input').value = ''; $('siteaccess-preview').textContent = ''; }
      } catch { say(tr('권한을 요청하지 못했습니다. 입력한 범위를 확인해주세요.')); }
      await refresh(); lock(false);
      if (granted) onGranted();
    };
    $('siteaccess-refresh').onclick = () => { say(''); refresh(); };
    chrome.permissions.onAdded?.addListener(refresh);
    chrome.permissions.onRemoved?.addListener(refresh);
    refresh();
    return {
      refresh,
      open() { $('siteaccess').open = true; $('siteaccess-input').focus(); refresh(); },
    };
  }
  B.SITES = { parse, rows, mount };
})();
