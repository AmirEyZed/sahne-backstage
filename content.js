// Stream Wall — runs inside pages, but only does anything when the page is framed by the wall.
//  1. Cookie bridge for cookie-shim.js (panel frames and same-site frames nested in them).
//  2. The panel's font / transparency / "chat look" skin / custom CSS (direct panel frames only).
//  3. Telling the wall when a new item (donation, tip) shows up, so it can flash that panel.
(() => {
  if (window === window.top) return;

  let wallOrigin;
  try {
    wallOrigin = new URL(chrome.runtime.getURL('/')).origin;
  } catch {
    return;
  }
  const ancestors = location.ancestorOrigins;
  if (!ancestors || !ancestors.length || ancestors[ancestors.length - 1] !== wallOrigin) return;

  const isPanelFrame = window.parent === window.top;

  // Rough registrable domain: enough to tell kick.com/dashboard.kick.com apart from an ad frame.
  function siteOf(hostname) {
    const labels = hostname.split('.');
    const n = labels.length;
    const twoPartTld = n >= 3 && labels[n - 1].length === 2 && labels[n - 2].length <= 3;
    return labels.slice(twoPartTld ? -3 : -2).join('.');
  }
  if (!isPanelFrame) {
    let panelHost = '';
    try {
      panelHost = new URL(ancestors[ancestors.length - 2]).hostname;
    } catch {}
    // Third-party frames inside a panel keep Chrome's normal cross-site cookie view.
    if (!panelHost || siteOf(panelHost) !== siteOf(location.hostname)) return;
  }

  // ---------- cookie bridge ----------
  const pushJar = (cookies) => document.dispatchEvent(new CustomEvent('__sw_cookie_jar', { detail: JSON.stringify(cookies) }));
  document.addEventListener('__sw_cookie_set', (e) => {
    chrome.runtime.sendMessage({ type: 'sw-cookies-set', cookie: e.detail }).catch(() => {});
  });
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'sw-cookies-update' && Array.isArray(msg.cookies)) pushJar(msg.cookies);
  });
  // `cookies: null` = this panel has not opted in: the shim drops whatever jar it had.
  chrome.runtime.sendMessage({ type: 'sw-cookies-get' })
    .then((r) => r && 'cookies' in r && pushJar(r.cookies))
    .catch(() => {});

  if (!isPanelFrame) return;

  // ---------- panel styling ----------
  // StreamWall comes from shared.js, loaded just before this file.
  const named = /^sw-panel-([\w-]+)/.exec(window.name || '');
  const panelId = named && named[1];
  const siteKey = StreamWall.siteKeyFor(location.hostname);
  let styleEl = null;
  let skins = {};
  let lastCfg = null;

  function findPanel(cfg) {
    const panels = (cfg && cfg.panels) || [];
    return (
      panels.find((p) => p.id === panelId) ||
      panels.find((p) => {
        try {
          return new URL(p.url).hostname === location.hostname;
        } catch {
          return false;
        }
      })
    );
  }

  function apply(cfg) {
    lastCfg = cfg;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.setAttribute('data-stream-wall', '');
    }
    styleEl.textContent = StreamWall.panelCss({ panel: findPanel(cfg), cfg: cfg || {}, skin: skins[siteKey] || '' });
    const parent = document.head || document.documentElement;
    if (parent && styleEl.parentNode !== parent) parent.appendChild(styleEl);
  }

  chrome.storage.local.get(['cfg', 'skins']).then((r) => {
    skins = r.skins || {};
    apply(r.cfg);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.skins) skins = changes.skins.newValue || {};
    if (changes.cfg || changes.skins) apply(changes.cfg ? changes.cfg.newValue : lastCfg);
  });
  // Re-attach last so the panel's CSS wins over the page's own stylesheets.
  document.addEventListener('DOMContentLoaded', () => styleEl && (document.head || document.documentElement).appendChild(styleEl));

  // ---------- page fixes + new-item signal ----------
  const site = StreamWall.SITES[siteKey];
  if (!site) return;
  // Some sites clear window.name while loading (KickBot does), so fall back to the panel for this site.
  const currentPanelId = () => panelId || (lastCfg && (findPanel(lastCfg) || {}).id) || null;
  let lastSig = null;
  let timer = 0;
  const onChange = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      StreamWall.tidy(document, siteKey); // Persian times, hide empty messages (used by the skin)
      if (!site.newest) return;
      const id = currentPanelId();
      const sig = StreamWall.newestSignature(document, siteKey);
      if (!id || !sig || sig === lastSig) return;
      lastSig = sig;
      chrome.runtime.sendMessage({ type: 'sw-activity', panelId: id, sig, kind: StreamWall.newestKind(document, siteKey) }).catch(() => {});
    }, 400);
  };
  new MutationObserver(onChange).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  onChange();
})();
