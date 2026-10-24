// Stream Wall — Kick reward queue, newest first. Runs in the page's own JS world on
// dashboard.kick.com, but only does anything inside the wall (same check as cookie-shim.js).
//
// Why: Kick's queue API (/api/v2/channels/<name>/redemptions) returns 25 requests per page,
// oldest first, so on stream the newest requests sat on the last page. Here the first page's
// request is answered with every page merged and sorted newest first (read from the real API,
// 2026-10-23: { data: { redemptions: [...], next_page_token } }, `created_at` ISO times). Kick
// then draws them all on one page; <html data-sw-all-pages> lets skins/kick.css drop the pager.
(() => {
  if (window === window.top) return;
  let ancestors;
  try {
    ancestors = location.ancestorOrigins;
  } catch {
    return;
  }
  if (!ancestors || !ancestors.length || !ancestors[ancestors.length - 1].startsWith('chrome-extension://')) return;

  const QUEUE = /\/api\/v2\/channels\/[^/]+\/redemptions(\?|$)/;
  const MAX_PAGES = 20; // 500 requests; a queue that long is never cleared on stream anyway
  const base = window.fetch;

  window.fetch = async function (input, init) {
    const url = String((input && input.url) || input);
    if (!QUEUE.test(url) || /[?&]next_page_token=/.test(url)) return base.apply(this, arguments);
    const first = await base.apply(this, arguments);
    if (!first.ok) return first;
    try {
      const j = await first.clone().json();
      if (!j || !j.data || !Array.isArray(j.data.redemptions)) return first;
      const all = [...j.data.redemptions];
      let token = j.data.next_page_token;
      for (let pages = 1; token && pages < MAX_PAGES; pages++) {
        const u = new URL(url, location.href);
        u.searchParams.set('next_page_token', token);
        const r = await base.call(this, input instanceof Request ? new Request(u.href, input) : u.href, init);
        if (!r.ok) return first; // half a list in the wrong order is worse than Kick's own pages
        const k = await r.json();
        all.push(...((k.data && k.data.redemptions) || []));
        token = k.data && k.data.next_page_token;
      }
      if (token) return first;
      all.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      document.documentElement.dataset.swAllPages = '';
      return new Response(JSON.stringify({ ...j, data: { ...j.data, redemptions: all, next_page_token: null } }), {
        status: first.status,
        headers: { 'content-type': 'application/json' },
      });
    } catch {
      return first;
    }
  };

  // A request that arrives live is placed by Kick itself, which may put it at the bottom. When the
  // "All reward requests" count goes up and the top card is not brand new, reload so the merged,
  // sorted list comes back (a reload in the wall takes a second or two).
  const COUNT = 'button.rounded-md.p-2:has(> div.flex-col)';
  const TOP_TIME = 'div:has(> div.flex.w-full.gap-3 > button[role="checkbox"]) div.justify-between:first-child > span:last-child';
  const FRESH = /second|just now|less than a minute|^(a|1) minute/i;
  const countOf = () => {
    const el = document.querySelector(COUNT);
    const m = el && el.textContent.match(/(\d+)\s*requests?/i);
    return m ? Number(m[1]) : null;
  };
  let last = null;
  let pending = 0;
  const check = () => {
    const n = countOf();
    if (n === null) return;
    if (last !== null && n > last && !pending) {
      pending = setTimeout(() => {
        pending = 0;
        const top = document.querySelector(TOP_TIME);
        if (top && !FRESH.test(top.textContent.trim())) location.reload();
      }, 2500);
    }
    last = n;
  };
  let queued = 0; // Kick re-renders a lot; look at most every half second
  const onChange = () => { if (!queued) queued = setTimeout(() => { queued = 0; check(); }, 500); };
  const start = () => new MutationObserver(onChange).observe(document.body, { childList: true, subtree: true, characterData: true });
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
