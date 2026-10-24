// Stream Wall — what every part of the extension needs to agree on, in one place:
//  • SITES: the sites the wall knows (badge, "chat look" skin, how to spot a new item);
//  • themeVars(): the design tokens, shared by the wall itself and the skins inside pages;
//  • panelCss(): the CSS a panel's page gets.
// Loaded by dashboard.html, by content.js (as a content script) and by the dev preview, so all
// three always render the same thing.
// eslint-disable-next-line no-unused-vars
const StreamWall = (() => {
  const SITES = {
    donofa: {
      label: 'Donofa',
      hosts: ['donofa.ir', 'donofa.com'],
      icon: 'bell',
      skin: 'skins/donofa.css',
      // cards sit in the feed directly, or (since 2026-10-23) each in a motion wrapper <div style>
      newest: '.feedList > .eventCard:not([aria-hidden="true"]), .feedList > div:not([aria-hidden="true"]) > .eventCard:not([aria-hidden="true"])',
      // a donation whose message is empty or just "." shows no message line at all
      emptyText: ['.eventCard .descFull, .eventCard .descPreview', '.cardDescSection'],
    },
    kickbot: {
      label: 'KickBot',
      hosts: ['kickbot.com'],
      icon: 'coins',
      skin: 'skins/kickbot.css',
      // KickBot's tip list (2026-10-23 layout): section#tip-history > .kb-grp > .group per tip
      newest: '#tip-history .kb-grp > .group',
      // left out of the fingerprint: the time ("1 minute ago" ticks on) and the status (Pending → Approved)
      sigSkip: ':scope > span.tabular-nums, :scope > span.col-start-2',
      ago: '#tip-history .kb-grp > .group > span.tabular-nums',
    },
    kick: {
      label: 'KICK',
      hosts: ['kick.com'],
      icon: 'gift',
      skin: 'skins/kick.css',
      // "All reward requests · N requests": flash only when N goes up (approving one lowers it)
      newest: 'button.rounded-md.p-2:has(> div.flex-col)',
      countUp: true,
      ago: 'div:has(> div.flex.w-full.gap-3 > button[role="checkbox"]) div.justify-between:first-child > span:last-child',
    },
    meld: { label: 'Chat', hosts: ['meldstudio.co'], icon: 'chat' },
    // other donation pages a streamer may use instead of Donofa: recognised (badge), shown as they are
    reymit: { label: 'Reymit', hosts: ['reymit.ir'], icon: 'bell' },
    streamelements: { label: 'StreamElements', hosts: ['streamelements.com'], icon: 'bell' },
  };

  // Looks ("سبک"): how panels and the cards inside pages are drawn, whatever the colours. The skins
  // multiply their own sizes by r / bw / bb (pages are laid out at different scales): r = corner
  // radius, bw = border, bb = bottom border (the chat bubble's thick lip in neon, none elsewhere).
  const STYLES = {
    neon: {
      name: 'نئون', hint: 'برچسب و لبهٔ پررنگ مثل چت، با درخشش',
      r: 1, bw: 1, bb: 1, shadow: 'none', blur: 'none',
      card: 'linear-gradient(100deg, var(--sw-tint) 0%, var(--sw-card) 60%)', line: 'var(--sw-line)',
      tagBg: 'var(--sw-tag)', tagInk: 'var(--sw-accent)', tagShadow: 'none',
      badgeBg: 'var(--sw-accent)', badgeInk: 'var(--sw-ink)', badgeRing: 'none',
    },
    glass: {
      name: 'شیشه‌ای', hint: 'مات و شفاف، لبه‌های نازک، عمق نرم',
      r: 1.2, bw: 0.5, bb: 0.22, shadow: '0 12px 30px -14px rgb(0 0 0 / 0.7)', blur: 'blur(14px) saturate(1.3)',
      card: 'color-mix(in srgb, var(--sw-card) 52%, transparent)', line: 'color-mix(in srgb, var(--sw-text) 20%, transparent)',
      tagBg: 'color-mix(in srgb, var(--sw-tag) 62%, transparent)', tagInk: 'var(--sw-text)', tagShadow: '0 8px 20px -10px rgb(0 0 0 / 0.7)',
      badgeBg: 'var(--sw-accent)', badgeInk: 'var(--sw-ink)', badgeRing: 'none',
    },
    minimal: {
      name: 'مینیمال', hint: 'تخت و آرام، خط نازک و یک نوار رنگی',
      r: 0.4, bw: 0.5, bb: 0.22, shadow: 'inset -5px 0 0 0 var(--sw-accent)', blur: 'none',
      card: 'var(--sw-card)', line: 'var(--sw-line)',
      tagBg: 'var(--sw-tag)', tagInk: 'var(--sw-text)', tagShadow: 'none',
      badgeBg: 'transparent', badgeInk: 'var(--sw-accent)', badgeRing: 'inset 0 0 0 2px var(--sw-accent)',
    },
    bold: {
      name: 'پررنگ', hint: 'خط دور ضخیم و سایهٔ تیز، مثل کمیک',
      r: 0.55, bw: 1, bb: 0.43, shadow: '5px 5px 0 0 rgb(0 0 0 / 0.85)', blur: 'none',
      card: 'var(--sw-card)', line: 'color-mix(in srgb, var(--sw-panel) 25%, #000)',
      tagBg: 'var(--sw-tag)', tagInk: 'var(--sw-accent)', tagShadow: '3px 3px 0 0 rgb(0 0 0 / 0.85)',
      badgeBg: 'var(--sw-accent)', badgeInk: 'var(--sw-ink)', badgeRing: 'none',
    },
  };

  function siteKeyFor(urlOrHost) {
    let host = String(urlOrHost || '');
    try {
      if (host.includes('/')) host = new URL(host).hostname;
    } catch {
      return null;
    }
    for (const [key, site] of Object.entries(SITES)) {
      if (site.hosts.some((h) => host === h || host.endsWith('.' + h))) return key;
    }
    return null;
  }

  const hex = (v, fallback) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : fallback);

  // Dark or light ink, whichever has the higher WCAG contrast on the accent (badges, buttons).
  function inkOn(color) {
    const n = parseInt(color.slice(1), 16);
    const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const l = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
    const dark = '#07100a';
    const lDark = 0.0045; // relative luminance of `dark`
    return (l + 0.05) / (lDark + 0.05) >= 1.05 / (l + 0.05) ? dark : '#ffffff';
  }

  // The design tokens. The wall and the skins both read these, so a panel's name tag and the
  // cards inside a skinned page are exactly the same colours.
  function themeVars(cfg) {
    const colors = (cfg && cfg.colors) || {};
    const accent = hex(colors.accent, '#53fc18');
    const font = (cfg && cfg.font && cfg.font.stack) || '"Vazirmatn Variable", Vazirmatn, Tahoma, sans-serif';
    const st = STYLES[cfg && cfg.style] || STYLES.neon;
    return (
      ':root{' +
      `--sw-accent:${accent};` +
      `--sw-ink:${inkOn(accent)};` +
      `--sw-text:${hex(colors.text, '#f2f5f3')};` +
      `--sw-panel:${hex(colors.panel, '#0e1512')};` +
      `--sw-font:${font};` +
      '--sw-line:color-mix(in srgb, var(--sw-text) 15%, #1f222a);' +
      '--sw-card:color-mix(in srgb, var(--sw-panel) 30%, #1c1f27);' +
      '--sw-tag:color-mix(in srgb, var(--sw-panel) 25%, #14161c);' +
      '--sw-tint:color-mix(in srgb, var(--sw-accent) 17%, var(--sw-card));' +
      '--sw-muted:color-mix(in srgb, var(--sw-text) 62%, transparent);' +
      `--sw-k-r:${st.r};--sw-k-bw:${st.bw};--sw-k-bb:${st.bb};` +
      `--sw-card-bg:${st.card};--sw-card-line:${st.line};--sw-card-shadow:${st.shadow};--sw-card-blur:${st.blur};` +
      `--sw-tag-bg:${st.tagBg};--sw-tag-ink:${st.tagInk};--sw-tag-shadow:${st.tagShadow};` +
      `--sw-badge-bg:${st.badgeBg};--sw-badge-ink:${st.badgeInk};--sw-badge-ring:${st.badgeRing};` +
      '}\n'
    );
  }

  /**
   * The CSS a panel's page gets.
   * @param {object} o
   * @param {object} o.panel  the panel's settings
   * @param {object} o.cfg    the whole wall config (theme, font)
   * @param {string} [o.skin] the "chat look" stylesheet for this page's site, if it has one
   */
  function panelCss({ panel, cfg, skin }) {
    if (!panel || !cfg) return '';
    const useSkin = !!(panel.skin && skin);
    let imports = '';
    let css = '';
    if ((panel.injectFont || useSkin) && cfg.font) {
      for (const href of cfg.font.hrefs || []) imports += `@import url("${href}");\n`;
    }
    if (panel.injectFont && cfg.font && cfg.font.stack) {
      css +=
        'html body, html body *:not(i):not(svg):not(svg *):not([class*="icon" i]):not([class*="fa-"])' +
        ':not(.material-icons):not(.material-symbols-outlined)' +
        `{font-family:${cfg.font.stack} !important}\n`;
    }
    if (panel.transparent || useSkin) {
      // A see-through page shows no scrollbars (wheel scrolling still works) — they'd be the
      // only opaque, system-styled thing on the wall.
      css += '*{scrollbar-width:none !important}*::-webkit-scrollbar{display:none !important}\n';
    }
    if (panel.transparent) {
      css +=
        ':root{color-scheme:dark !important}' +
        'html,body,#app,#root,#__next,#__nuxt{background:transparent !important;background-color:transparent !important}\n';
    }
    if (useSkin) css += themeVars(cfg) + skin + '\n';
    if (panel.css) css += panel.css;
    return imports + css;
  }

  // A short fingerprint of the newest item on a page (newest donation, newest tip), so the wall
  // can tell when something new arrived — also across the page's own reloads.
  function newestSignature(doc, siteKey) {
    const site = SITES[siteKey];
    if (!site || !site.newest) return null;
    const el = doc.querySelector(site.newest);
    if (!el || el.querySelector('.skeleton')) return null;
    let node = el;
    if (site.sigSkip) {
      node = el.cloneNode(true);
      for (const skip of node.querySelectorAll(site.sigSkip)) skip.remove();
    }
    const text = node.textContent.replace(/\s+/g, ' ').trim();
    return text ? text.slice(0, 200) : null;
  }

  // What kind of item is newest, when the page says so (subs/gifts added by kickbot-sahne.js):
  // the wall rings that kind's own sound.
  function newestKind(doc, siteKey) {
    const site = SITES[siteKey];
    const el = site && site.newest && doc.querySelector(site.newest);
    return (el && el.dataset && el.dataset.kind) || null;
  }

  // "1 month ago" → "۱ ماه پیش".
  const UNITS = { second: 'ثانیه', minute: 'دقیقه', hour: 'ساعت', day: 'روز', week: 'هفته', month: 'ماه', year: 'سال' };
  const faDigits = new Intl.NumberFormat('fa-IR');
  function faAgo(text) {
    const t = String(text).trim();
    if (/^just now$|^now$/i.test(t)) return 'همین الان';
    const m = /^(an?|\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/i.exec(t);
    if (!m) return null;
    return faDigits.format(/^an?$/i.test(m[1]) ? 1 : Number(m[1])) + ' ' + UNITS[m[2].toLowerCase()] + ' پیش';
  }

  // Small fixes on a skinned page. The site's own scripts own its text, so nothing is rewritten:
  // a Persian label goes into data-sw-text (the skin shows it via ::after) and an empty message
  // gets data-sw-empty (the skin hides it). Run again whenever the page changes.
  function tidy(doc, siteKey) {
    const site = SITES[siteKey];
    if (!site) return;
    if (site.ago) {
      for (const el of doc.querySelectorAll(site.ago)) {
        const label = faAgo(el.textContent);
        if (label && el.getAttribute('data-sw-text') !== label) el.setAttribute('data-sw-text', label);
        else if (!label && el.hasAttribute('data-sw-text')) el.removeAttribute('data-sw-text');
      }
    }
    if (site.emptyText) {
      const [textSel, boxSel] = site.emptyText;
      for (const el of doc.querySelectorAll(textSel)) {
        const box = el.closest(boxSel);
        if (box) box.toggleAttribute('data-sw-empty', /^[\s.\-_,،…!?؟·]*$/.test(el.textContent));
      }
    }
  }

  return { SITES, STYLES, siteKeyFor, inkOn, themeVars, panelCss, newestSignature, newestKind, faAgo, tidy };
})();
