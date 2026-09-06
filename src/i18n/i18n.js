(() => {
  const B = (globalThis.BAMTI ||= {});
  let locale = 'ko';
  const normalize = value => /^ko(?:-|_|$)/i.test(value || '') ? 'ko' : 'en';
  const I = B.I18N = {
    normalize,
    get locale() { return locale; },
    get numberLocale() { return locale === 'ko' ? 'ko-KR' : 'en-US'; },
    setLocale(value) { locale = normalize(value); },
    browserLocale() { return normalize(globalThis.chrome?.i18n?.getUILanguage?.() || globalThis.navigator?.language || 'en'); },
    t(source, ...values) {
      const key = Array.isArray(source) ? source.reduce((s, part, i) => s + (i ? `{${i - 1}}` : '') + part, '') : source;
      const message = locale === 'en' ? (B.EN[key] ?? key) : key;
      return String(message).replace(/\{(\d+)\}/g, (match, i) => Number(i) < values.length ? String(values[i]) : match);
    },
    localizeDocument(doc) {
      doc.documentElement.lang = locale;
      const walker = doc.createTreeWalker(doc, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (node.parentElement?.closest('script,style,select')) continue;
        const key = node.textContent.trim().replace(/\s+/g, ' ');
        if (Object.hasOwn(B.EN, key)) node.textContent = node.textContent.replace(/\S[\s\S]*\S|\S/, I.t(key));
      }
      for (const el of doc.querySelectorAll('*')) {
        for (const attr of ['title', 'placeholder', 'aria-label']) {
          const value = el.getAttribute(attr);
          if (value && Object.hasOwn(B.EN, value)) el.setAttribute(attr, I.t(value));
        }
      }
      doc.querySelector('option[value="auto"]')?.replaceChildren(I.t('브라우저 언어'));
    },
  };
})();
