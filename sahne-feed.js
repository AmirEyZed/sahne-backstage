// Stream Wall — reads alerts from Sahne Plus, the streamer's own alert app (local server on
// 127.0.0.1:7788), for the wall. Runs only in the wall's hidden feed frame (/sw-feed, a page of
// that server, so the app's same-origin rule for its event stream is met).
//
// Sahne Plus streams { type: 'state', state: { recent: [...] } } on /events?role=admin; `recent`
// holds its last 30 played alerts ({ id, kind: tip|sub|gift, source, name, amount, count, message,
// test, at }) and lives only in the app's memory, so subs and gifts are kept here in
// chrome.storage.local.sahneEvents (KickBot tips too, to place subs between them by time).
(() => {
  if (window === window.top || location.pathname !== '/sw-feed') return;
  let wallOrigin;
  try {
    wallOrigin = new URL(chrome.runtime.getURL('/')).origin;
  } catch {
    return;
  }
  const ancestors = location.ancestorOrigins;
  if (!ancestors || !ancestors.length || ancestors[ancestors.length - 1] !== wallOrigin) return;

  const KEEP = 400;
  const KINDS = new Set(['tip', 'sub', 'gift']);
  const clean = (x) => ({
    id: String(x.id),
    kind: x.kind,
    source: String(x.source || ''),
    name: String(x.name || '').slice(0, 80),
    amount: Number(x.amount) || 0,
    currency: String(x.currency || 'USD'),
    count: x.count == null ? null : Number(x.count) || null,
    message: String(x.message || '').slice(0, 300),
    at: Number(x.at),
  });

  let queue = Promise.resolve(); // one storage merge at a time
  const merge = (recent) => {
    const items = recent.filter((x) => x && x.id && Number(x.at) > 0 && !x.test && KINDS.has(x.kind)).map(clean);
    if (!items.length) return;
    queue = queue.then(async () => {
      const { sahneEvents = [] } = await chrome.storage.local.get('sahneEvents');
      const byId = new Map(sahneEvents.map((e) => [e.id, e]));
      let changed = false;
      for (const it of items) {
        if (byId.has(it.id)) continue;
        byId.set(it.id, it);
        changed = true;
      }
      if (!changed) return;
      const list = [...byId.values()].sort((a, b) => b.at - a.at).slice(0, KEEP);
      await chrome.storage.local.set({ sahneEvents: list });
    }).catch(() => {});
  };

  // The wall reloads this frame when the heartbeat stops (app closed, then opened again).
  const beat = () => chrome.storage.local.set({ sahneAlive: Date.now() }).catch(() => {});
  let version = null; // the wall tells the streamer when Sahne Plus is too old for this
  const es = new EventSource('/events?role=admin');
  es.onopen = beat;
  es.onmessage = (e) => {
    try {
      const d = JSON.parse(e.data);
      if (d && d.type === 'state' && d.state && Array.isArray(d.state.recent)) merge(d.state.recent);
      if (d && d.type === 'state' && d.state && d.state.version && d.state.version !== version) {
        version = String(d.state.version);
        chrome.storage.local.set({ sahneInfo: { version, channel: (d.state.kick && d.state.kick.channel) || '', at: Date.now() } }).catch(() => {});
      }
    } catch {}
  };
  setInterval(() => es.readyState === EventSource.OPEN && beat(), 20000);
})();
