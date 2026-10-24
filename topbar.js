// Top bar of the wall: shortcuts plus live numbers of the stream. The numbers come from the Subathon Timer server on
// this PC (http://localhost:7799/api/hub/live): time live (from Meld), Meld's real bitrate (measured by the Dual-WAN
// watchdog) and a ping to 4.2.2.4. When that server is not running, the bar shows "—" and keeps the shortcuts.
'use strict';
(() => {
  const LIVE_API = 'http://localhost:7799/api/hub/live';
  const $ = id => document.getElementById(id);
  const faNum = n => Number(n).toLocaleString('fa-IR');
  let since = null, live = null, offset = 0;

  function hms(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    const t = (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(x).padStart(2, '0');
    return t.replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]); // Persian digits, like the other numbers on the bar
  }
  function level(el, cls) {
    el.classList.remove('good', 'warn', 'bad');
    if (cls) el.classList.add(cls);
  }
  function tickLive() {
    const box = $('tbLive'), txt = $('tbLiveText');
    if (live === true && since) {
      txt.textContent = 'لایو ' + '⁦' + hms(Date.now() + offset - since) + '⁩'; // h:mm:ss stays left-to-right
      level(box, 'good');
    } else if (live === true) {
      txt.textContent = 'لایو';
      level(box, 'good');
    } else if (live === false) {
      txt.textContent = 'آفلاین';
      level(box, null);
    } else {
      txt.textContent = '—';
      level(box, null);
    }
    box.classList.toggle('on', live === true);
  }

  // Without the Subathon Timer on this PC (anyone but the owner), live state and rank come straight
  // from streamfa.com for the Kick ID the wall detected (dashboard.js puts it on <html data-kick>):
  // its live list sorted by total_viewers is the site's own order, so the rank is the position in it.
  const STREAMFA_API = 'https://streamfa.com/api/streams/live';
  let sf = { at: 0, list: null };
  async function streamfaList() {
    if (Date.now() - sf.at < 30000) return sf.list;
    let list = null;
    try {
      const r = await fetch(STREAMFA_API, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      const j = r.ok ? await r.json() : null;
      if (Array.isArray(j)) list = j.slice().sort((a, b) => (Number(b && b.total_viewers) || 0) - (Number(a && a.total_viewers) || 0));
    } catch {}
    sf = { at: Date.now(), list: list || (sf.list && Date.now() - sf.at < 120000 ? sf.list : null) };
    return sf.list;
  }
  const kickSlug = (p) => ((/kick\.com\/([^/?#]+)/i.exec(String((p && p.stream_url) || '')) || [])[1] || '').toLowerCase();
  async function pollStreamfa() {
    const id = (document.documentElement.dataset.kick || '').toLowerCase();
    const rk = $('tbRank');
    since = null;
    if (!id) {
      live = null;
      rk.classList.add('off');
      $('tbRankVal').textContent = '—';
      rk.title = 'آیدی کیک پیدا نشد (تنظیمات ← بیشتر ← کانال)';
      return;
    }
    const list = await streamfaList();
    if (!list) {
      live = null;
      rk.classList.add('off');
      $('tbRankVal').textContent = '—';
      rk.title = 'استریم‌فا جواب نداد';
      return;
    }
    const i = list.findIndex((x) => String((x && x.display_name) || '').toLowerCase() === id || (Array.isArray(x && x.platforms) && x.platforms.some((p) => kickSlug(p) === id)));
    live = i >= 0;
    rk.classList.toggle('off', !live);
    $('tbRankVal').textContent = live ? faNum(i + 1) + ' از ' + faNum(list.length) : 'آفلاین';
    rk.title = live ? faNum(Number(list[i].total_viewers) || 0) + ' بیننده · مرتب‌شده بر اساس بیننده، مثل خود سایت' : 'وقتی لایو باشی رتبه‌ات بین لایوهای استریم‌فا این‌جا می‌آید';
  }

  async function poll() {
    let d = null;
    try {
      const r = await fetch(LIVE_API, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
      if (r.ok) d = await r.json();
    } catch {}
    $('topBar').classList.toggle('no-local', !d);
    $('tbHub').title = d ? 'مرکز کنترل محلی (Subathon Timer)' : 'تنظیمات پشت‌صحنه: پنل‌ها، چت، دونیت و بقیه';
    if (!d) {
      $('topBar').title = '';
      await pollStreamfa();
      tickLive();
      return;
    }
    $('topBar').title = '';
    offset = d.now ? d.now - Date.now() : 0;
    live = d.live;
    since = d.since || null;
    // bitrate: green near the configured output bitrate, yellow under 80%, red under 50%
    const b = d.bitrate, rate = $('tbRate');
    if (b && live === true) {
      $('tbRateVal').textContent = faNum(b.mbps.toFixed(2)) + ' Mbps';
      const ratio = b.target ? b.mbps / b.target : 1;
      level(rate, ratio >= 0.8 ? 'good' : ratio >= 0.5 ? 'warn' : 'bad');
      rate.title = (b.target ? 'هدف خروجی Meld: ' + b.target + ' Mbps · ' : '') + (b.minute != null ? 'میانگین یک دقیقه: ' + b.minute + ' Mbps · ' : '') + (b.link ? 'روی ' + b.link : '');
    } else {
      $('tbRateVal').textContent = live === true ? '…' : '—';
      level(rate, null);
      rate.title = live === true ? 'Dual-WAN هنوز بیت‌ریت را اندازه نگرفته' : 'وقتی لایو باشی نشان داده می‌شود';
    }
    // ping: green under 100 ms, yellow under 200 ms, red above or no answer
    const ping = $('tbPing');
    if (d.ping == null) {
      $('tbPingVal').textContent = 'بی‌پاسخ';
      level(ping, 'bad');
    } else {
      $('tbPingVal').textContent = faNum(d.ping) + ' ms';
      level(ping, d.ping < 100 ? 'good' : d.ping < 200 ? 'warn' : 'bad');
    }
    // rank among the live Persian streamers on streamfa.com (by viewers); always in place, «آفلاین» when not live
    const rk = $('tbRank'), r = d.rank;
    rk.classList.toggle('off', live !== true);
    if (live !== true) {
      $('tbRankVal').textContent = 'آفلاین';
      rk.title = 'وقتی لایو باشی رتبه‌ات بین لایوهای استریم‌فا این‌جا می‌آید';
    } else if (r && r.rank) {
      $('tbRankVal').textContent = faNum(r.rank) + ' از ' + faNum(r.total);
      rk.title = faNum(r.viewers) + ' بیننده · مرتب‌شده بر اساس بیننده، مثل خود سایت';
    } else {
      $('tbRankVal').textContent = '…';
      rk.title = r ? 'هنوز در فهرست لایوهای استریم‌فا نیستی (چند دقیقه طول می‌کشد)' : 'استریم‌فا جواب نداد';
    }
    tickLive();
  }

  poll();
  setInterval(poll, 2000);
  setInterval(tickLive, 1000);
})();
