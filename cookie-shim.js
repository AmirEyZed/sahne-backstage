// Stream Wall — runs in the page's own JS world, but only does anything for pages framed
// inside an extension page (the wall).
//
// Why: inside the wall, HTTP requests carry the site's login cookies normally, but Chrome
// treats `document.cookie` in the frame as cross-site: scripts see and can write only
// SameSite=None cookies. Sites that read their session token from a cookie in JS (Kick,
// Donofa, …) therefore look logged-out. This gives `document.cookie` the same view the
// page has in a normal tab. HttpOnly cookies are never exposed. The jar is fed by
// content.js, which gets it from the wall page (chrome.cookies).
(() => {
  if (window === window.top) return;
  let ancestors;
  try {
    ancestors = location.ancestorOrigins;
  } catch {
    return;
  }
  if (!ancestors || !ancestors.length || !ancestors[ancestors.length - 1].startsWith('chrome-extension://')) return;

  const native = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
  if (!native || !native.get || !native.set) return;

  const STORE_KEY = '__stream_wall_cookie_jar';
  const host = location.hostname;
  let jar = []; // { name, value, domain, hostOnly, path, secure, expires }
  const recent = new Map(); // cookie key -> { cookie | null, at } — local writes not yet echoed back

  const keyOf = (c) => `${c.name}|${c.domain}|${c.path}`;
  const nowSec = () => Date.now() / 1000;

  // First load: the wall hands the snapshot over in the frame name (the only channel that is
  // readable synchronously before page scripts run). Strip it at once so nothing else sees it.
  const named = /^(sw-panel-[\w-]+)#(.+)$/.exec(window.name || '');
  if (named) {
    window.name = named[1];
    try {
      const data = JSON.parse(decodeURIComponent(escape(atob(named[2]))));
      if (data && data.host === host && Array.isArray(data.cookies)) jar = data.cookies;
    } catch {}
  }
  // Later documents in the same frame (reloads, in-site navigation) start from the last jar.
  if (!jar.length) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE_KEY) || 'null');
      if (saved && saved.host === host && Array.isArray(saved.cookies)) jar = saved.cookies;
    } catch {}
  }

  // 'on'  = this panel opted in: serve the jar.  'off' = not opted in: stay out of the way.
  // 'unknown' = no snapshot yet and the wall has not answered; behave natively meanwhile.
  let mode = jar.length ? 'on' : 'unknown';

  function persist() {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify({ host, cookies: jar }));
    } catch {}
  }

  function pathMatches(requestPath, cookiePath) {
    if (cookiePath === requestPath) return true;
    if (!requestPath.startsWith(cookiePath)) return false;
    return cookiePath.endsWith('/') || requestPath[cookiePath.length] === '/';
  }

  function read() {
    if (mode !== 'on') return native.get.call(document);
    const path = location.pathname || '/';
    const https = location.protocol === 'https:';
    const now = nowSec();
    const list = jar
      .filter((c) => (c.expires == null || c.expires > now) && (!c.secure || https) && pathMatches(path, c.path || '/'))
      .sort((a, b) => (b.path || '/').length - (a.path || '/').length);
    const seen = new Set(list.map((c) => c.name));
    const parts = list.map((c) => (c.name ? `${c.name}=${c.value}` : c.value));
    let own = '';
    try {
      own = native.get.call(document);
    } catch {}
    for (const pair of own ? own.split('; ') : []) {
      const name = pair.split('=')[0];
      if (!seen.has(name)) {
        seen.add(name);
        parts.push(pair);
      }
    }
    return parts.join('; ');
  }

  function defaultPath() {
    const p = location.pathname || '/';
    const cut = p.lastIndexOf('/');
    return cut <= 0 ? '/' : p.slice(0, cut);
  }

  function parse(text) {
    const parts = String(text).split(';');
    const first = parts.shift();
    const eq = first.indexOf('=');
    const c = {
      name: eq >= 0 ? first.slice(0, eq).trim() : '',
      value: eq >= 0 ? first.slice(eq + 1).trim() : first.trim(),
      domain: host, hostOnly: true, path: null, secure: false, expires: null, sameSite: 'unspecified',
    };
    let maxAge = null;
    for (const raw of parts) {
      const i = raw.indexOf('=');
      const k = (i >= 0 ? raw.slice(0, i) : raw).trim().toLowerCase();
      const v = i >= 0 ? raw.slice(i + 1).trim() : '';
      if (k === 'expires') {
        const t = Date.parse(v);
        if (!Number.isNaN(t)) c.expires = t / 1000;
      } else if (k === 'max-age') {
        const n = parseInt(v, 10);
        if (!Number.isNaN(n)) maxAge = n;
      } else if (k === 'domain' && v) {
        c.domain = v.replace(/^\./, '').toLowerCase();
        c.hostOnly = false;
      } else if (k === 'path' && v.startsWith('/')) c.path = v;
      else if (k === 'secure') c.secure = true;
      else if (k === 'samesite') c.sameSite = v.toLowerCase();
    }
    if (maxAge !== null) c.expires = maxAge <= 0 ? 0 : nowSec() + maxAge;
    if (!c.path) c.path = defaultPath();
    return c;
  }

  function write(text) {
    try {
      native.set.call(document, text); // still lands natively when Chrome allows it (SameSite=None)
    } catch {}
    if (mode === 'off') return;
    const c = parse(text);
    if (!c.name && !c.value) return;
    if (!(host === c.domain || host.endsWith('.' + c.domain))) return; // same rule the browser applies
    if (c.sameSite === 'none' && !c.secure) return;
    const key = keyOf(c);
    const alive = c.expires == null || c.expires > nowSec();
    recent.set(key, { cookie: alive ? c : null, at: Date.now() });
    if (mode === 'on') {
      jar = jar.filter((x) => keyOf(x) !== key);
      if (alive) jar.push(c);
      persist();
    }
    document.dispatchEvent(new CustomEvent('__sw_cookie_set', { detail: JSON.stringify(c) }));
  }

  // Proxies keep the native accessors' behaviour (and brand checks) for every other document.
  Object.defineProperty(Document.prototype, 'cookie', {
    configurable: true,
    enumerable: native.enumerable,
    get: new Proxy(native.get, {
      apply: (target, self, args) => (self === document ? read() : Reflect.apply(target, self, args)),
    }),
    set: new Proxy(native.set, {
      apply: (target, self, args) => (self === document ? write(args[0]) : Reflect.apply(target, self, args)),
    }),
  });

  document.addEventListener('__sw_cookie_jar', (e) => {
    let list;
    try {
      list = JSON.parse(e.detail);
    } catch {
      return;
    }
    if (list === null) {
      // The panel is not (or no longer) opted in: back to Chrome's own view.
      mode = 'off';
      jar = [];
      recent.clear();
      try {
        sessionStorage.removeItem(STORE_KEY);
      } catch {}
      return;
    }
    if (!Array.isArray(list)) return;
    mode = 'on';
    // A snapshot can be slightly older than a write the page just made; keep those on top.
    for (const [key, entry] of recent) {
      if (Date.now() - entry.at > 3000) {
        recent.delete(key);
        continue;
      }
      list = list.filter((x) => keyOf(x) !== key);
      if (entry.cookie) list.push(entry.cookie);
    }
    jar = list;
    persist();
  });
})();
