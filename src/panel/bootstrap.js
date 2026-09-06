// Load the saved language before panel text, scans or diagnostics are produced.
(async () => {
  const I = BAMTI.I18N;
  const { bamtiLanguage = 'auto' } = await chrome.storage.local.get('bamtiLanguage').catch(() => ({}));
  const preference = ['auto', 'ko', 'en'].includes(bamtiLanguage) ? bamtiLanguage : 'auto';
  I.setLocale(preference === 'auto' ? I.browserLocale() : preference);
  I.localizeDocument(document);
  const language = document.getElementById('language');
  language.value = preference;
  language.onchange = async () => {
    language.disabled = true;
    try {
      await chrome.storage.local.set({ bamtiLanguage: language.value });
      location.reload();
    } catch {
      language.value = preference;
      language.disabled = false;
    }
  };
  const script = document.createElement('script');
  script.src = globalThis.chrome.runtime.getURL ? chrome.runtime.getURL('src/panel/panel.js') : '/src/panel/panel.js';
  document.body.append(script);
})();
