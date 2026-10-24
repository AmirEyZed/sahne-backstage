// Stream Wall — subs and gift subs from Sahne Plus (sahne-feed.js keeps them in
// chrome.storage.local.sahneEvents) shown in the KickBot tips panel, between the tips by time.
// The cards copy KickBot's own row structure (div > span amount + button name, p, span time) so
// skins/kickbot.css dresses them like the tips; data-kind picks the SUB / GIFT badge.
// Runs only in a wall panel frame, and only while that panel has "ساب و گیفت از صحنه پلاس" on.
(() => {
  if (window === window.top || window.parent !== window.top) return;
  let wallOrigin;
  try {
    wallOrigin = new URL(chrome.runtime.getURL('/')).origin;
  } catch {
    return;
  }
  const ancestors = location.ancestorOrigins;
  if (!ancestors || !ancestors.length || ancestors[ancestors.length - 1] !== wallOrigin) return;

  const SHOW = 100;
  const UNIT_S = { year: 31536000, month: 2592000, week: 604800, day: 86400, hour: 3600, minute: 60, second: 1 };
  const fa = new Intl.NumberFormat('fa-IR');
  let cfg = null;
  let events = [];

  const enabled = () => {
    const p = ((cfg && cfg.panels) || []).find((q) => {
      try {
        return new URL(q.url).hostname === location.hostname;
      } catch {
        return false;
      }
    });
    return !!(p && p.sahne);
  };

  // KickBot's "3 days ago" → a rough time, for rows Sahne Plus never saw
  const parseAgo = (text) => {
    const t = String(text).trim();
    if (/^(just )?now$/i.test(t)) return Date.now();
    const m = /^(an?|\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/i.exec(t);
    return m ? Date.now() - (/^an?$/i.test(m[1]) ? 1 : Number(m[1])) * UNIT_S[m[2].toLowerCase()] * 1000 : null;
  };
  // …and back, in KickBot's words, so shared.js tidy() turns it into Persian like the tips' times
  const enAgo = (at) => {
    const s = (Date.now() - at) / 1000;
    if (s < 45) return 'just now';
    for (const [unit, len] of Object.entries(UNIT_S)) {
      const n = Math.floor(s / len);
      if (n >= 1) return `${n} ${unit}${n > 1 ? 's' : ''} ago`;
    }
    return 'just now';
  };

  const nodes = new Map(); // event id -> card
  function cardFor(e) {
    let g = nodes.get(e.id);
    if (g) return g;
    g = document.createElement('div');
    g.className = 'group sw-sahne';
    g.dataset.swId = e.id;
    g.dataset.kind = e.kind;
    const head = document.createElement('div');
    const what = document.createElement('span');
    const n = Math.max(1, e.count || 1);
    what.textContent = e.kind === 'gift' ? `${fa.format(n)} ساب گیفت` : n > 1 ? `ساب · ${fa.format(n)} ماه` : 'ساب جدید';
    const who = document.createElement('button');
    who.type = 'button';
    who.tabIndex = -1;
    who.textContent = e.name || 'ناشناس';
    head.append(what, who);
    g.append(head);
    if (e.kind === 'gift' && e.message) {
      const to = document.createElement('p');
      to.textContent = 'برای ' + e.message;
      g.append(to);
    }
    const time = document.createElement('span');
    time.className = 'tabular-nums';
    time.textContent = enAgo(e.at);
    g.append(time);
    nodes.set(e.id, g);
    return g;
  }

  function place() {
    const grp = document.querySelector('#tip-history .kb-grp');
    if (!grp) return;
    const shown = enabled() ? events.filter((e) => e.kind === 'sub' || e.kind === 'gift').slice(0, SHOW) : [];
    const keep = new Set(shown.map((e) => e.id));
    for (const [id, node] of nodes) {
      if (keep.has(id)) continue;
      node.remove();
      nodes.delete(id);
    }
    if (!shown.length) return;

    // When was each KickBot row? Exact if Sahne Plus played that tip (same name and amount), else
    // from its "N days ago".
    const tips = events.filter((e) => e.kind === 'tip');
    const used = new Set();
    const rows = [...grp.children].filter((n) => n.classList.contains('group') && !n.classList.contains('sw-sahne'));
    const timeOf = new Map();
    for (const r of rows) {
      const name = ((r.querySelector(':scope > div > button') || {}).textContent || '').trim().toLowerCase();
      const amount = parseFloat(((r.querySelector(':scope > div > span') || {}).textContent || '').replace(/[^\d.]/g, ''));
      const hit = tips.find((t) => !used.has(t.id) && t.name.trim().toLowerCase() === name && Math.abs(t.amount - amount) < 0.005);
      if (hit) used.add(hit.id);
      const ago = r.querySelector(':scope > span.tabular-nums');
      timeOf.set(r, hit ? hit.at : (ago && parseAgo(ago.textContent)) || 0);
    }

    // Wanted order: KickBot's rows as they are, each sub/gift just before the first older row.
    const wanted = [];
    const evs = [...shown].sort((a, b) => b.at - a.at);
    let i = 0;
    for (const r of rows) {
      while (i < evs.length && evs[i].at >= timeOf.get(r)) wanted.push(cardFor(evs[i++]));
      wanted.push(r);
    }
    while (i < evs.length) wanted.push(cardFor(evs[i++]));

    // Move only our own cards (KickBot's rows belong to its React tree), and only when out of place,
    // so the MutationObserver below settles after one pass.
    let next = null;
    for (let k = wanted.length - 1; k >= 0; k--) {
      const n = wanted[k];
      if (n.classList.contains('sw-sahne') && (n.parentNode !== grp || n.nextSibling !== next)) grp.insertBefore(n, next);
      next = n;
    }
  }

  function refreshTimes() {
    for (const e of events) {
      const n = nodes.get(e.id);
      const t = n && n.querySelector(':scope > span.tabular-nums');
      const label = t && enAgo(e.at);
      if (t && t.textContent !== label) t.textContent = label;
    }
  }

  let queued = 0;
  const schedule = () => {
    if (!queued) queued = setTimeout(() => ((queued = 0), place()), 300);
  };
  chrome.storage.local.get(['cfg', 'sahneEvents']).then((r) => {
    cfg = r.cfg || null;
    events = Array.isArray(r.sahneEvents) ? r.sahneEvents : [];
    schedule();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.cfg) cfg = changes.cfg.newValue || null;
    if (changes.sahneEvents) events = changes.sahneEvents.newValue || [];
    if (changes.cfg || changes.sahneEvents) schedule();
  });
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(refreshTimes, 30000);
})();
