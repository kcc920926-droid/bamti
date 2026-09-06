type Theme = 'dark' | 'light';
type NoticeTone = 'info' | 'success' | 'warn';

type ToastRecord = {
  id: number;
  tone: NoticeTone;
  message: string;
};

const $ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T | null =>
  root.querySelector<T>(selector);

const $$ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T[] =>
  Array.from(root.querySelectorAll<T>(selector));

const state: {
  theme: Theme;
  modalOpen: boolean;
  drawerOpen: boolean;
  paletteOpen: boolean;
  toasts: ToastRecord[];
} = {
  theme: document.documentElement.dataset.theme === 'light' ? 'light' : 'dark',
  modalOpen: false,
  drawerOpen: false,
  paletteOpen: false,
  toasts: []
};

const escapeHtml = (value: string): string => value.replace(/[&<>'"]/g, (character) => {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  };
  return entities[character] ?? character;
});

const syncBodyLock = (): void => {
  document.body.classList.toggle('is-locked', state.modalOpen || state.drawerOpen || state.paletteOpen);
};

const setAriaHidden = (selector: string, hidden: boolean): void => {
  const element = $(selector);
  element?.setAttribute('aria-hidden', String(hidden));
};

const toggleTheme = (): void => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = state.theme;
  try {
    localStorage.setItem('luna-theme', state.theme);
  } catch {
    // localStorage can be unavailable when a file is opened with a strict file:// policy.
  }
};

const notify = (message: string, tone: NoticeTone = 'success'): void => {
  const viewport = $('[data-toast-viewport]');
  if (!viewport) return;

  const id = Date.now() + Math.floor(Math.random() * 1000);
  state.toasts.push({ id, tone, message });

  const toast = document.createElement('div');
  toast.className = 'live-toast';
  toast.dataset.toastId = String(id);
  const symbol = tone === 'success' ? '✓' : tone === 'warn' ? '!' : 'i';
  const safeMessage = escapeHtml(message);
  toast.innerHTML = `
    <span class="toast-icon">${symbol}</span>
    <div><b>${safeMessage}</b><small>Just now · Luna system</small></div>
    <button type="button" class="dismiss-btn" aria-label="Dismiss notification">×</button>
  `;
  viewport.appendChild(toast);

  const remove = (): void => {
    if (!toast.isConnected) return;
    toast.classList.add('is-leaving');
    window.setTimeout(() => {
      toast.remove();
      state.toasts = state.toasts.filter((item) => item.id !== id);
    }, 260);
  };

  $('.dismiss-btn', toast)?.addEventListener('click', remove);
  window.setTimeout(remove, 4200);
};

const setActiveNav = (id: string): void => {
  $$('.nav-item').forEach((item) => {
    const isActive = item.getAttribute('href') === `#${id}`;
    item.classList.toggle('is-active', isActive);
  });
};

const scrollToSection = (selector: string): void => {
  const target = $(selector);
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const openModal = (): void => {
  state.modalOpen = true;
  $('.modal-backdrop')?.classList.add('is-open');
  setAriaHidden('[data-modal]', false);
  syncBodyLock();
  window.setTimeout(() => $('.modal-close')?.focus(), 40);
};

const closeModal = (): void => {
  state.modalOpen = false;
  $('.modal-backdrop')?.classList.remove('is-open');
  setAriaHidden('[data-modal]', true);
  syncBodyLock();
};

const openDrawer = (): void => {
  state.drawerOpen = true;
  $('.drawer')?.classList.add('is-open');
  setAriaHidden('[data-drawer]', false);
  syncBodyLock();
  window.setTimeout(() => $('[data-drawer-close]')?.focus(), 40);
};

const closeDrawer = (): void => {
  state.drawerOpen = false;
  $('.drawer')?.classList.remove('is-open');
  setAriaHidden('[data-drawer]', true);
  syncBodyLock();
};

const openPalette = (): void => {
  state.paletteOpen = true;
  $('.command-palette')?.classList.add('is-open');
  setAriaHidden('[data-command-palette]', false);
  syncBodyLock();
  window.setTimeout(() => $('[data-command-input]')?.focus(), 70);
};

const closePalette = (): void => {
  state.paletteOpen = false;
  $('.command-palette')?.classList.remove('is-open');
  setAriaHidden('[data-command-palette]', true);
  syncBodyLock();
};

const closeAllOverlays = (): void => {
  closeModal();
  closeDrawer();
  closePalette();
};

const applyFilter = (filter: string): void => {
  $$('.filter-chip').forEach((chip) => chip.classList.toggle('is-selected', chip.dataset.filter === filter));
  $$<HTMLElement>('[data-category]').forEach((section) => {
    section.classList.toggle('is-filtered-out', filter !== 'all' && section.dataset.category !== filter);
  });
  const label = filter === 'all' ? 'Showing all surfaces' : `Showing ${filter} surfaces`;
  const toolbar = $('.toolbar-intro span:last-child');
  if (toolbar) toolbar.textContent = label;
};

const setupTabs = (): void => {
  $$<HTMLButtonElement>('[data-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      const tabId = button.dataset.tab;
      if (!tabId) return;
      $$<HTMLButtonElement>('[data-tab]').forEach((tab) => {
        const active = tab === button;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', String(active));
      });
      $$('.tab-panel').forEach((panel) => panel.classList.toggle('is-active', panel.id === tabId));
    });
  });
};

const setupAccordion = (): void => {
  $$<HTMLButtonElement>('[data-accordion]').forEach((button) => {
    button.addEventListener('click', () => {
      const item = button.closest<HTMLElement>('.accordion-item');
      if (!item) return;
      const open = !item.classList.contains('is-open');
      item.classList.toggle('is-open', open);
      button.setAttribute('aria-expanded', String(open));
    });
  });
};

const setupMenu = (): void => {
  const trigger = $('[data-menu-toggle]');
  const menu = $('[data-menu]');
  if (!trigger || !menu) return;

  trigger.addEventListener('click', () => {
    const open = !menu.classList.contains('is-open');
    menu.classList.toggle('is-open', open);
    trigger.setAttribute('aria-expanded', String(open));
  });

  document.addEventListener('click', (event) => {
    const target = event.target as Node;
    if (!menu.contains(target) && !trigger.contains(target)) {
      menu.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
    }
  });
};

const setupCommandPalette = (): void => {
  $$('[data-command-open]').forEach((button) => button.addEventListener('click', openPalette));
  $$('[data-command-close]').forEach((button) => button.addEventListener('click', closePalette));

  const input = $<HTMLInputElement>('[data-command-input]');
  const items = $$<HTMLButtonElement>('[data-palette-action]');
  input?.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();
    items.forEach((item) => {
      item.hidden = query.length > 0 && !item.textContent?.toLowerCase().includes(query);
    });
  });

  input?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const firstVisible = items.find((item) => !item.hidden);
    firstVisible?.click();
  });

  items.forEach((item) => {
    item.addEventListener('click', () => {
      const action = item.dataset.paletteAction;
      closePalette();
      if (action === 'theme') {
        toggleTheme();
        notify(`Appearance set to ${state.theme}.`, 'info');
      } else if (action === 'audit') {
        notify('Audit complete. No blocking issues found.', 'success');
      } else if (action) {
        scrollToSection(`#${action}`);
        setActiveNav(action);
      }
    });
  });
};

const setupRange = (): void => {
  $$<HTMLInputElement>('[data-range]').forEach((input) => {
    const output = $('[data-range-output]');
    const update = (): void => {
      if (output) output.textContent = `${input.value}%`;
    };
    input.addEventListener('input', update);
    update();
  });
};

const setupDismiss = (): void => {
  $$<HTMLButtonElement>('[data-dismiss]').forEach((button) => {
    button.addEventListener('click', () => {
      const parent = button.closest<HTMLElement>('.alert, .toast-message');
      if (parent) parent.hidden = true;
    });
  });
};

const setupDemoControls = (): void => {
  $$<HTMLButtonElement>('[data-toast]').forEach((button) => {
    button.addEventListener('click', () => {
      const message = button.dataset.toast;
      if (message) notify(message, 'success');
    });
  });

  $$('[data-scroll-to]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.getAttribute('data-scroll-to');
      if (target) scrollToSection(target);
    });
  });

  $$('[data-modal-open]').forEach((button) => button.addEventListener('click', openModal));
  $$('[data-modal-close]').forEach((button) => button.addEventListener('click', closeModal));
  $$('[data-drawer-open]').forEach((button) => button.addEventListener('click', openDrawer));
  $$('[data-drawer-close]').forEach((button) => button.addEventListener('click', closeDrawer));
  $$('[data-show-toast]').forEach((button) => button.addEventListener('click', () => notify('Changes saved to the demo state.', 'success')));
  $$('[data-skeleton-toggle]').forEach((button) => button.addEventListener('click', () => {
    $('[data-skeleton]')?.classList.toggle('is-animating');
  }));

  $$<HTMLButtonElement>('.segment-control button').forEach((button) => {
    button.addEventListener('click', () => {
      const group = button.parentElement;
      if (!group) return;
      $$('button', group).forEach((candidate) => candidate.classList.remove('is-active'));
      button.classList.add('is-active');
    });
  });

  $$<HTMLButtonElement>('.tag button').forEach((button) => {
    button.addEventListener('click', () => button.closest('.tag')?.remove());
  });

  $$<HTMLInputElement>('[data-command-inline]').forEach((input) => {
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && input.value.trim()) {
        notify(`Searching for “${input.value.trim()}”.`, 'info');
        input.value = '';
      }
    });
  });

  $('.modal-backdrop')?.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeModal();
  });
};

const setupFiltersAndNavigation = (): void => {
  $$<HTMLButtonElement>('[data-filter]').forEach((button) => {
    button.addEventListener('click', () => applyFilter(button.dataset.filter ?? 'all'));
  });

  $$('.nav-item').forEach((item) => {
    item.addEventListener('click', () => {
      const href = item.getAttribute('href');
      if (href?.startsWith('#')) setActiveNav(href.slice(1));
    });
  });

  const sections = $$<HTMLElement>('[data-section], [data-category]');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      const id = visible?.target.id;
      if (id) setActiveNav(id);
    }, { rootMargin: '-18% 0px -68% 0px', threshold: [0.1, 0.35, 0.7] });
    sections.forEach((section) => observer.observe(section));
  }
};

const setupKeyboard = (): void => {
  document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if ((event.metaKey || event.ctrlKey) && key === 'k') {
      event.preventDefault();
      state.paletteOpen ? closePalette() : openPalette();
    }
    if (event.key === 'Escape') closeAllOverlays();
  });
};

const init = (): void => {
  try {
    const savedTheme = localStorage.getItem('luna-theme');
    if (savedTheme === 'dark' || savedTheme === 'light') {
      state.theme = savedTheme;
      document.documentElement.dataset.theme = savedTheme;
    }
  } catch {
    // Keep the authored dark default when storage is unavailable.
  }

  setupTabs();
  setupAccordion();
  setupMenu();
  setupCommandPalette();
  setupRange();
  setupDismiss();
  setupDemoControls();
  setupFiltersAndNavigation();
  setupKeyboard();

  $$('[data-theme-toggle]').forEach((button) => button.addEventListener('click', toggleTheme));
  $$('[data-skeleton]').forEach((element) => element.classList.add('is-animating'));
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
