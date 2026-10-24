'use strict';

// Runs as the extension page; also degrades to a plain page (localStorage, no header
// stripping) so the UI can be previewed outside the extension.
const EXT = typeof chrome !== 'undefined' && !!(chrome.runtime && chrome.runtime.id);

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const r2 = (v) => Math.round(v * 100) / 100;
const uid = () => 'p' + Math.random().toString(36).slice(2, 8);

const MIN_W = 8;
const MIN_H = 5;
const SNAP_PX = 10;
const SLOW_MS = 15000; // a page still loading after this long gets a "taking long · retry" note

// ---------- icons (Lucide-style strokes, 24×24) ----------
const ICONS = {
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  sliders: '<path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
  external: '<path d="M15 3h6v6M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>',
  expand: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
  maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
  'zoom-in': '<circle cx="11" cy="11" r="7.5"/><path d="m21 21-4.3-4.3M11 8v6M8 11h6"/>',
  'zoom-out': '<circle cx="11" cy="11" r="7.5"/><path d="m21 21-4.3-4.3M8 11h6"/>',
  move: '<path d="M12 2v20M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M5 9l-3 3 3 3M9 5l3-3 3 3"/>',
  layout: '<rect x="3" y="3" width="8" height="10" rx="2"/><rect x="13" y="3" width="8" height="6" rx="2"/><rect x="13" y="11" width="8" height="10" rx="2"/><rect x="3" y="15" width="8" height="6" rx="2"/>',
  logo: '<rect x="4" y="2.5" width="7" height="11" rx="2"/><rect x="13" y="2.5" width="7" height="7" rx="2"/><rect x="13" y="11.5" width="7" height="10" rx="2"/><rect x="4" y="15.5" width="7" height="6" rx="2"/>',
  palette: '<path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.13-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2C19.48 16.38 22 13.88 22 10.83 21.97 6 17.46 2 12 2z"/><circle cx="7.5" cy="10.5" r="1.2"/><circle cx="12" cy="7" r="1.2"/><circle cx="16.5" cy="10.5" r="1.2"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  more: '<circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/><circle cx="5" cy="12" r="1.2"/>',
  swap: '<path d="M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4"/>',
  back: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  trash: '<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
  'eye-off': '<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.53 13.53 0 0 0 2 12s3 8 10 8a9.74 9.74 0 0 0 5.39-1.61M14.12 14.12a3 3 0 1 1-4.24-4.24M2 2l20 20"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  coins: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18M7 6h1v4M16.71 13.88l.7.71-2.82 2.82"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  'corner-tl': '<path d="M7 17V7h10M17 17 7 7"/>',
  'corner-tr': '<path d="M7 7h10v10M7 17 17 7"/>',
  'corner-bl': '<path d="M17 7 7 17M17 17H7V7"/>',
  'corner-br': '<path d="m7 7 10 10M17 7v10H7"/>',
};
const icon = (name) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
function hydrateIcons(root = document) {
  for (const el of root.querySelectorAll('i[data-icon]')) el.outerHTML = icon(el.dataset.icon);
}

// The badge in a panel's name tag: "KICK" like the chat overlay, an icon for the other sites.
function badgeHtml(url) {
  const key = StreamWall.siteKeyFor(url);
  return icon((key && StreamWall.SITES[key].icon) || (url ? 'globe' : 'link'));
}

// Persian digits for everything the wall itself writes.
const faNum = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 });
const fa = (n) => faNum.format(Number(n) || 0);

const CDN = 'https://cdn.jsdelivr.net/';
const FONTS = [
  { id: 'vazirmatn', label: 'وزیرمتن', family: 'Vazirmatn Variable', local: ['Vazirmatn', 'Vazir'], css: ['npm/@fontsource-variable/vazirmatn/index.css'] },
  { id: 'sahel', label: 'ساحل', family: 'Sahel', css: ['gh/rastikerdar/sahel-font@v3.4.0/dist/font-face.css'] },
  { id: 'shabnam', label: 'شبنم', family: 'Shabnam', css: ['gh/rastikerdar/shabnam-font@v5.0.1/dist/font-face.css'] },
  { id: 'samim', label: 'صمیم', family: 'Samim', css: ['gh/rastikerdar/samim-font@v4.0.5/dist/font-face.css'] },
  { id: 'lalezar', label: 'لاله‌زار (تیتری)', family: 'Lalezar', css: ['npm/@fontsource/lalezar/index.css'] },
  { id: 'katibeh', label: 'کتیبه (تیتری)', family: 'Katibeh', css: ['npm/@fontsource/katibeh/index.css'] },
  { id: 'noto-sans', label: 'Noto Sans Arabic', family: 'Noto Sans Arabic Variable', css: ['npm/@fontsource-variable/noto-sans-arabic/index.css'] },
  { id: 'noto-kufi', label: 'Noto Kufi Arabic', family: 'Noto Kufi Arabic Variable', css: ['npm/@fontsource-variable/noto-kufi-arabic/index.css'] },
  { id: 'noto-naskh', label: 'Noto Naskh Arabic', family: 'Noto Naskh Arabic Variable', css: ['npm/@fontsource-variable/noto-naskh-arabic/index.css'] },
  { id: 'plex', label: 'IBM Plex Sans Arabic', family: 'IBM Plex Sans Arabic', css: ['npm/@fontsource/ibm-plex-sans-arabic/400.css', 'npm/@fontsource/ibm-plex-sans-arabic/700.css'] },
  { id: 'markazi', label: 'Markazi Text', family: 'Markazi Text Variable', css: ['npm/@fontsource-variable/markazi-text/index.css'] },
  { id: 'readex', label: 'Readex Pro', family: 'Readex Pro Variable', css: ['npm/@fontsource-variable/readex-pro/index.css'] },
  { id: 'rubik', label: 'Rubik', family: 'Rubik Variable', css: ['npm/@fontsource-variable/rubik/index.css'] },
  { id: 'baloo', label: 'Baloo Bhaijaan 2', family: 'Baloo Bhaijaan 2 Variable', css: ['npm/@fontsource-variable/baloo-bhaijaan-2/index.css'] },
  { id: 'cairo', label: 'Cairo', family: 'Cairo Variable', css: ['npm/@fontsource-variable/cairo/index.css'] },
  { id: 'amiri', label: 'Amiri', family: 'Amiri', css: ['npm/@fontsource/amiri/400.css', 'npm/@fontsource/amiri/700.css'] },
  { id: 'system', label: 'فونت نصب‌شده روی سیستم…', family: '' },
];

const THEMES = {
  kick: { name: 'کیک', bg: ['#050807', '#0c2a18', '#123d22'], panel: '#0e1512', border: '#53fc18', accent: '#53fc18', text: '#eafff0' },
  purple: { name: 'نیمه‌شب', bg: ['#0b0520', '#2a0f52', '#7b2d8e'], panel: '#160b2b', border: '#b388ff', accent: '#c77dff', text: '#f3eaff' },
  teal: { name: 'فیروزه‌ای', bg: ['#031316', '#08303a', '#0e4a4f'], panel: '#0a1d22', border: '#2dd4bf', accent: '#2dd4bf', text: '#e6fffb' },
  sunset: { name: 'غروب', bg: ['#16050f', '#5a1436', '#c2521f'], panel: '#1d0a17', border: '#ff9f5a', accent: '#ffb86b', text: '#fff1e6' },
  ocean: { name: 'اقیانوس', bg: ['#030a1c', '#0a2650', '#0f4c81'], panel: '#081427', border: '#4cc9f0', accent: '#4cc9f0', text: '#e8f7ff' },
  gold: { name: 'طلایی', bg: ['#080604', '#1f1708', '#3a2a0c'], panel: '#14100a', border: '#f5c451', accent: '#f5c451', text: '#fff8e6' },
  rose: { name: 'رز', bg: ['#12040c', '#3d0a26', '#7a1548'], panel: '#1a0812', border: '#ff5c9d', accent: '#ff5c9d', text: '#ffeaf3' },
  oled: { name: 'مشکی', bg: ['#000000', '#050505', '#0d0d0d'], panel: '#0a0a0a', border: '#4a4a4a', accent: '#ffffff', text: '#f2f2f2' },
};

const PANEL_DEFAULTS = {
  title: 'پنل', url: '', x: 25, y: 35, w: 50, h: 30, z: 1,
  zoom: 100, header: true, visible: true, refresh: 0,
  transparent: false, injectFont: false, cropX: 0, cropY: 0, cropW: 0, pageW: 0,
  sandbox: true, css: '',
  cookieBridge: false, // opt-in per panel, see "cookie bridge" below
  skin: false, // restyle the page like the chat bubbles, where a skin exists for its site
  notify: false, // a chime when a new item arrives (donation, tip, reward)
  sahne: false, // KickBot panel: subs and gift subs from Sahne Plus between the tips
  // a second address to flip to from the name tag (the solo / the dual chat): `url` is always the one
  // showing, `url2` the other; altFlip remembers which is "second" so the switch keeps its order
  url2: '', urlName: '', url2Name: '', altFlip: false,
};
const NUMERIC_PANEL_KEYS = ['x', 'y', 'w', 'h', 'z', 'zoom', 'refresh', 'cropX', 'cropY', 'cropW', 'pageW'];
const CONFIG_VERSION = 14;
// The owner's own copy carries owner.json (personal panels, chat links, channel); anyone else's
// copy has no such file and starts from GENERIC_PANELS. Loaded in init(), before the config.
let OWNER = {};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
async function loadOwner() {
  try {
    const r = await fetch(EXT ? chrome.runtime.getURL('owner.json') : 'owner.json', { cache: 'no-store' });
    if (r.ok) OWNER = (await r.json()) || {};
  } catch {
    OWNER = {}; // not the owner's copy
  }
}
// What a new Backstage starts with when it isn't the owner's: the usual four panels, addresses to
// fill in (each says what goes there). {kick} is the streamer's Kick ID, detected or typed in settings.
const GENERIC_PANELS = [
  { id: 'chat', title: 'چت', url: '', hint: 'آدرس ویجت چتت را وارد کن (مثلاً از Meld یا StreamElements)', x: 0, y: 0, w: 46, h: 62 },
  { id: 'donate', title: 'دونیت‌ها', url: '', hint: 'آدرس پاپ‌آپ هشدارهای دونیت را وارد کن (دونوفا، ریمیت یا StreamElements)', x: 46, y: 0, w: 54, h: 62, zoom: 90, cookieBridge: true, skin: true, transparent: true, injectFont: true, notify: true },
  { id: 'tips', title: 'درآمد تیپ', url: 'https://kickbot.com/dashboard/tipping/earnings', x: 0, y: 62, w: 46, h: 38, pageW: 1280, refresh: 60, sahne: true, skin: true, transparent: true, injectFont: true, notify: true },
  { id: 'rewards', title: 'ریواردهای کیک', url: 'https://dashboard.kick.com/popout/{kick}/reward-request-queue', x: 46, y: 62, w: 54, h: 38, pageW: 1000, cookieBridge: true, skin: true, transparent: true, injectFont: true, notify: true },
];

// "Chat look" skins: site CSS (shared.js SITES[].skin) that restyles a page's items like the chat
// overlay. The files are read here and handed to content.js through storage (it cannot read
// extension files itself), keyed by site.
const skinFor = (url) => {
  if (!EXT && window.__swSkinOverride) return window.__swSkinOverride(url); // dev preview only
  const key = StreamWall.siteKeyFor(url);
  return key && StreamWall.SITES[key].skin ? { key, file: StreamWall.SITES[key].skin } : null;
};
async function publishSkins() {
  if (!EXT) return;
  const skins = {};
  for (const [key, site] of Object.entries(StreamWall.SITES)) {
    if (!site.skin) continue;
    try {
      skins[key] = await (await fetch(chrome.runtime.getURL(site.skin), { cache: 'no-store' })).text();
    } catch {}
  }
  await chrome.storage.local.set({ skins });
}
const DESKTOP_WIDTH = 1280;
const KICKBOT_SKIN_WIDTH = 1280; // KickBot's desktop layout; skins/kickbot.css zooms the table to fit
const KICK_SKIN_WIDTH = 1000; // skins/kick.css: Kick's desktop layout, where the request list shows

function defaultConfig() {
  const t = THEMES.kick;
  return {
    v: CONFIG_VERSION,
    theme: 'kick',
    style: 'neon', // the look (shared.js STYLES); the colours come from the theme
    // where the panels sit, per screen shape: turning to a landscape monitor and back keeps both
    layouts: { portrait: {}, landscape: {} },
    drawerLeft: false,
    colors: { accent: t.accent, border: t.border, panel: t.panel, text: t.text, panelAlpha: 55 },
    background: { type: 'aurora', c1: t.bg[0], c2: t.bg[1], c3: t.bg[2], angle: 160, url: '', fit: 'cover', dim: 0, blur: 0, animate: false, grain: true },
    font: { id: 'vazirmatn', custom: '', size: 15, weight: '700', stack: '', hrefs: [] },
    panelStyle: { gap: 12, radius: 18, borderWidth: 2, glass: 12, glow: true, headH: 38, chrome: 'tag' },
    sound: { on: true, volume: 70 },
    kickId: '', // the streamer's Kick ID; empty = detected (Sahne Plus, the reward queue address, owner.json)
    donatePage: '', // the top bar's donation link; empty = built from the donations panel's site and the Kick ID
    panels: (Array.isArray(OWNER.panels) && OWNER.panels.length ? OWNER.panels : GENERIC_PANELS).map((p) => ({ ...PANEL_DEFAULTS, ...p })),
  };
}

// ---------- state ----------
let cfg = defaultConfig();
let bgImage = '';
let editing = false;
let currentPanelId = null;
let drag = null;
let upgradedFrom = 0;
let donofaMoved = false;
let soundAdded = false;
let sahneAdded = false;
let altAdded = false;
let stylesAdded = false;
let currentTab = 'layout';
const views = new Map();
const panelsEl = $('#panels');
const guideV = $('.guide.gv');
const guideH = $('.guide.gh');

// ---------- storage ----------
const store = {
  async load() {
    if (EXT) return chrome.storage.local.get(['cfg', 'bgImage']);
    try {
      return { cfg: JSON.parse(localStorage.getItem('sw.cfg') || 'null'), bgImage: localStorage.getItem('sw.bg') || '' };
    } catch {
      return {};
    }
  },
  async saveCfg(value) {
    if (EXT) return chrome.storage.local.set({ cfg: value });
    localStorage.setItem('sw.cfg', JSON.stringify(value));
  },
  async saveBg(value) {
    if (EXT) return chrome.storage.local.set({ bgImage: value });
    localStorage.setItem('sw.bg', value);
  },
};

let saveTimer = 0;
function save() {
  rememberLayout();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    store.saveCfg(cfg).catch((err) => toast('ذخیره نشد: ' + err.message));
  }, 250);
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
function mergeDefaults(base, over) {
  if (!isObj(base)) return over === undefined || over === null ? base : over;
  const out = { ...base };
  if (isObj(over)) for (const k of Object.keys(over)) out[k] = k in base ? mergeDefaults(base[k], over[k]) : over[k];
  return out;
}

function normalizeUrl(raw) {
  let s = String(raw || '').trim();
  if (!s) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = 'https://' + s;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : '';
  } catch {
    return '';
  }
}

function normalizePanel(raw) {
  const p = { ...PANEL_DEFAULTS, ...(isObj(raw) ? raw : {}) };
  p.id = String(p.id || uid()).replace(/[^\w-]/g, '') || uid();
  p.title = String(p.title || 'پنل');
  p.url = normalizeUrl(p.url);
  p.url2 = normalizeUrl(p.url2);
  p.urlName = String(p.urlName || '').slice(0, 20);
  p.url2Name = String(p.url2Name || '').slice(0, 20);
  p.altFlip = !!p.altFlip;
  p.css = String(p.css || '');
  for (const k of NUMERIC_PANEL_KEYS) p[k] = Number(p[k]) || 0;
  p.w = clamp(p.w || 50, MIN_W, 100);
  p.h = clamp(p.h || 30, MIN_H, 100);
  p.x = clamp(p.x, 0, 100 - p.w);
  p.y = clamp(p.y, 0, 100 - p.h);
  p.zoom = clamp(p.zoom || 100, 25, 200);
  p.refresh = Math.max(0, p.refresh);
  return p;
}

function normalizeConfig(saved) {
  const base = defaultConfig();
  if (!isObj(saved)) return base;
  const out = mergeDefaults(base, saved);
  out.panels = Array.isArray(saved.panels) ? saved.panels.map(normalizePanel) : base.panels;
  const seen = new Set();
  for (const p of out.panels) {
    while (seen.has(p.id)) p.id = uid();
    seen.add(p.id);
  }
  if ((Number(saved.v) || 1) < 2) {
    // v2: KickBot refuses narrow viewports ("use a larger device") — render it at desktop width.
    const tips = out.panels.find((p) => p.id === 'tips' && p.pageW === 0);
    if (tips) tips.pageW = DESKTOP_WIDTH;
  }
  if ((Number(saved.v) || 1) < 3) {
    // v3: Kick and Donofa read their login token from a cookie in JS — they need the cookie bridge.
    for (const p of out.panels) if (p.id === 'donate' || p.id === 'rewards') p.cookieBridge = true;
  }
  if ((Number(saved.v) || 1) < 4) {
    // v4: Donofa and KickBot get the chat look (needs a see-through page and the wall's font).
    for (const p of out.panels) if (skinFor(p.url)) Object.assign(p, { skin: true, transparent: true, injectFont: true });
  }
  if ((Number(saved.v) || 1) < 5) {
    // v5: the redesign. The KickBot skin now shows only the tips table, so an old crop (taken on
    // the full page) would cut the wrong part; the skin is drawn for an 800px page.
    for (const p of out.panels) {
      if (p.skin && StreamWall.siteKeyFor(p.url) === 'kickbot') Object.assign(p, { pageW: KICKBOT_SKIN_WIDTH, cropX: 0, cropY: 0, cropW: 0 });
      // the new Kick reward-queue skin: desktop width, so Kick shows the requests themselves
      if (StreamWall.siteKeyFor(p.url) === 'kick') {
        Object.assign(p, { skin: true, transparent: true, injectFont: true, pageW: KICK_SKIN_WIDTH, cropX: 0, cropY: 0, cropW: 0 });
      }
    }
    if (out.panelStyle.borderWidth === 1.5) out.panelStyle.borderWidth = 2; // the old default
    const w = Number(out.font.weight) || 700;
    out.font.weight = String(w < 600 ? 500 : w < 800 ? 700 : 900); // the three weights the UI offers
    upgradedFrom = Number(saved.v) || 1;
  }
  if ((Number(saved.v) || 1) < 8) {
    // v6, v8: the Meld chat widget moved to a new link.
    if (OWNER.chatUrl) for (const p of out.panels) if ((OWNER.oldChatUrls || []).includes(p.url)) p.url = OWNER.chatUrl;
    if ((Number(saved.v) || 1) < 6) upgradedFrom = Number(saved.v) || 1;
  }
  if ((Number(saved.v) || 1) < 9) {
    // v9: the chat panel had lost its name tag (and with it its title and tools); bring it back.
    const chat = out.panels.find((p) => p.id === 'chat');
    if (chat) chat.header = true;
  }
  if ((Number(saved.v) || 1) < 10) {
    // v10: donofa.com is behind Cloudflare, which is throttled in Iran (every file stalls at ~59KB,
    // so the panel never finishes loading); donofa.ir is the same app on an Iranian CDN.
    for (const p of out.panels) {
      try {
        const u = new URL(p.url);
        if (u.hostname === 'donofa.com' || u.hostname === 'www.donofa.com') {
          u.hostname = 'donofa.ir';
          p.url = u.href;
          donofaMoved = true;
        }
      } catch { /* not a URL */ }
    }
  }
  if ((Number(saved.v) || 1) < 11) {
    // v11: a chime for new donations, tips and rewards.
    for (const p of out.panels) if (CHIMES[StreamWall.siteKeyFor(p.url)]) p.notify = true;
    soundAdded = true;
  }
  if ((Number(saved.v) || 1) < 12) {
    // v12: subs and gift subs from Sahne Plus in the KickBot tips panel.
    for (const p of out.panels) if (StreamWall.siteKeyFor(p.url) === 'kickbot') p.sahne = true;
    sahneAdded = true;
  }
  if ((Number(saved.v) || 1) < 13) {
    // v13: the chat panel can flip to the combined (dual) chat from its name tag.
    const chat = out.panels.find((p) => p.id === 'chat' || StreamWall.siteKeyFor(p.url) === 'meld');
    if (chat && OWNER.dualChatUrl && chat.url === OWNER.chatUrl && !chat.url2) {
      Object.assign(chat, { url2: OWNER.dualChatUrl, urlName: 'تکی', url2Name: 'دوتایی', altFlip: false });
      altAdded = true;
    }
  }
  if ((Number(saved.v) || 1) < 14) stylesAdded = true; // v14: looks, any-screen sizing, a layout per screen shape
  if ((Number(saved.v) || 1) < 7) {
    // v7: KickBot back at its desktop width (at 800px it may not draw the tips table at all).
    for (const p of out.panels) {
      if (p.skin && StreamWall.siteKeyFor(p.url) === 'kickbot' && p.pageW === 800) Object.assign(p, { pageW: KICKBOT_SKIN_WIDTH, cropX: 0, cropY: 0, cropW: 0 });
    }
  }
  out.v = CONFIG_VERSION;
  return out;
}

// ---------- letting the sites load inside frames ----------
// Most dashboards forbid framing (X-Frame-Options / CSP frame-ancestors). Strip those
// headers, but only for sub-frames of tabs that are showing this wall.
async function installFrameRules() {
  if (!EXT || !chrome.declarativeNetRequest) return;
  const me = await chrome.tabs.getCurrent();
  myTabId = me ? me.id : null;
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['TAB'] });
  const tabIds = [...new Set([me && me.id, ...contexts.map((c) => c.tabId)].filter((id) => Number.isInteger(id) && id >= 0))];
  if (!tabIds.length) return;
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [1],
    addRules: [{
      id: 1,
      priority: 1,
      condition: { tabIds, resourceTypes: ['sub_frame'] },
      action: {
        type: 'modifyHeaders',
        responseHeaders: [
          { header: 'x-frame-options', operation: 'remove' },
          { header: 'content-security-policy', operation: 'remove' },
          { header: 'content-security-policy-report-only', operation: 'remove' },
        ],
      },
    }],
  });
}

// ---------- cookie bridge ----------
// Inside a panel, HTTP requests carry the site's login cookies, but Chrome shows the page's
// own scripts only SameSite=None cookies. Sites that read their session token from a cookie
// in JS (Kick, Donofa) then look logged-in yet load no data. For panels that opted in, the
// wall hands the page the cookies it would see in a normal tab (never HttpOnly ones) and
// applies the cookies it writes. cookie-shim.js / content.js are the in-page half.
let myTabId = null;
const cookieFrames = new Map(); // frameId -> { url, host, timer }

// Rough registrable domain (kick.com for dashboard.kick.com); same helper as content.js.
function siteOf(hostname) {
  const labels = hostname.split('.');
  const n = labels.length;
  const twoPartTld = n >= 3 && labels[n - 1].length === 2 && labels[n - 2].length <= 3;
  return labels.slice(twoPartTld ? -3 : -2).join('.');
}

function bridgedSites() {
  const sites = new Set();
  for (const p of cfg.panels) if (p.cookieBridge && p.visible && p.url) sites.add(siteOf(new URL(p.url).hostname));
  return sites;
}

function cookieMatchesHost(cookie, host) {
  const domain = cookie.domain.replace(/^\./, '');
  return cookie.hostOnly ? host === domain : host === domain || host.endsWith('.' + domain);
}

async function scriptCookiesFor(url) {
  const u = new URL(url);
  const host = u.hostname;
  const named = host.includes('.') && !/^[\d.]+$/.test(host);
  const all = await chrome.cookies.getAll(named ? { domain: siteOf(host) } : { url: u.origin + '/' });
  return all
    .filter((c) => !c.httpOnly && cookieMatchesHost(c, host) && (!c.secure || u.protocol === 'https:'))
    .map((c) => ({
      name: c.name, value: c.value, domain: c.domain.replace(/^\./, ''), hostOnly: c.hostOnly,
      path: c.path, secure: c.secure, expires: c.session ? null : c.expirationDate,
    }));
}

async function setCookieFromFrame(frameUrl, raw) {
  const u = new URL(frameUrl);
  const c = JSON.parse(raw);
  if (!c || typeof c.name !== 'string' || typeof c.value !== 'string') return;
  const domain = String(c.domain || u.hostname).replace(/^\./, '').toLowerCase();
  if (u.hostname !== domain && !u.hostname.endsWith('.' + domain)) return; // only its own site
  const path = typeof c.path === 'string' && c.path.startsWith('/') ? c.path : '/';
  const cookieUrl = `${u.protocol}//${domain}${path}`;

  const existing = await chrome.cookies.getAll({ url: cookieUrl, name: c.name });
  const sameCookie = (x) => x.path === path && x.domain.replace(/^\./, '') === domain;
  if (existing.some((x) => x.httpOnly && sameCookie(x))) return; // scripts can never touch HttpOnly cookies

  if (typeof c.expires === 'number' && c.expires <= Date.now() / 1000) {
    if (existing.some(sameCookie)) await chrome.cookies.remove({ url: cookieUrl, name: c.name });
    return;
  }
  const sameSite = { lax: 'lax', strict: 'strict', none: 'no_restriction' }[c.sameSite] || 'unspecified';
  if (sameSite === 'no_restriction' && !c.secure) return;
  const details = { url: cookieUrl, name: c.name, value: c.value, path, secure: !!c.secure, httpOnly: false, sameSite };
  if (!c.hostOnly) details.domain = domain;
  if (typeof c.expires === 'number') details.expirationDate = c.expires;
  await chrome.cookies.set(details);
}

function pushCookies(frameId, frame) {
  clearTimeout(frame.timer);
  frame.timer = setTimeout(async () => {
    try {
      const cookies = await scriptCookiesFor(frame.url);
      await chrome.tabs.sendMessage(myTabId, { type: 'sw-cookies-update', cookies }, { frameId });
    } catch {
      cookieFrames.delete(frameId); // that frame is gone
    }
  }, 80);
}

function initCookieBridge() {
  if (!EXT || !chrome.cookies) return;
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || (msg.type !== 'sw-cookies-get' && msg.type !== 'sw-cookies-set')) return;
    if (!sender.tab || sender.tab.id !== myTabId || !sender.frameId || !sender.url) return;
    let host;
    try {
      host = new URL(sender.url).hostname;
    } catch {
      return;
    }
    const allowed = bridgedSites().has(siteOf(host));
    if (msg.type === 'sw-cookies-set') {
      if (allowed) setCookieFromFrame(sender.url, msg.cookie).catch(() => {});
      return;
    }
    if (!allowed) {
      cookieFrames.delete(sender.frameId);
      sendResponse({ cookies: null });
      return;
    }
    cookieFrames.set(sender.frameId, { url: sender.url, host, timer: 0 });
    scriptCookiesFor(sender.url).then((cookies) => sendResponse({ cookies }), () => sendResponse({ cookies: [] }));
    return true; // answered asynchronously
  });
  chrome.cookies.onChanged.addListener(({ cookie }) => {
    if (cookie.httpOnly) return;
    for (const [frameId, frame] of cookieFrames) if (cookieMatchesHost(cookie, frame.host)) pushCookies(frameId, frame);
  });
}

// The very first read of document.cookie happens before any async answer can arrive, so the
// snapshot rides in on the frame's name; cookie-shim.js strips it before page scripts run.
async function frameNameFor(p) {
  const base = 'sw-panel-' + p.id;
  if (!EXT || !chrome.cookies || !p.cookieBridge) return base;
  try {
    const cookies = await scriptCookiesFor(p.url);
    if (!cookies.length) return base;
    const payload = JSON.stringify({ host: new URL(p.url).hostname, cookies });
    return base + '#' + btoa(unescape(encodeURIComponent(payload)));
  } catch {
    return base;
  }
}

// ---------- theme / font / background ----------
function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  const n = m ? parseInt(m[1], 16) : 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// The knobs each look sets when picked (still adjustable one by one below it).
const STYLE_KNOBS = {
  neon: { radius: 18, borderWidth: 2, glass: 12, glow: true, panelAlpha: 55 },
  glass: { radius: 24, borderWidth: 1, glass: 22, glow: false, panelAlpha: 30 },
  minimal: { radius: 8, borderWidth: 1, glass: 0, glow: false, panelAlpha: 92 },
  bold: { radius: 14, borderWidth: 3, glass: 0, glow: false, panelAlpha: 100 },
};
function setStyle(id) {
  if (!STYLE_KNOBS[id]) return;
  const { panelAlpha, ...knobs } = STYLE_KNOBS[id];
  cfg.style = id;
  Object.assign(cfg.panelStyle, knobs);
  cfg.colors.panelAlpha = panelAlpha;
  applyAll();
  syncInputs();
  save();
}

// ---------- any screen ----------
// Sizes in settings are for a screen 1080 px on its short side (the vertical 1080×1920 the wall was
// made on); other screens scale them, so a laptop or a 4K monitor shows the same wall, in proportion.
const BASE_SHORT_SIDE = 1080;
let appliedScale = 1;
function uiScale() {
  let s = Math.min(innerWidth, innerHeight) / BASE_SHORT_SIDE;
  if (Math.abs(s - 1) < 0.08) s = 1; // window chrome and taskbars don't nudge a 1080 screen
  return Math.round(clamp(s, 0.7, 2.2) * 20) / 20;
}
const orientation = () => (innerWidth > innerHeight * 1.1 ? 'landscape' : 'portrait');
let currentOrientation = null;
function rememberLayout() {
  if (!cfg.layouts) return;
  cfg.layouts[currentOrientation || orientation()] = Object.fromEntries(cfg.panels.map((p) => [p.id, { x: p.x, y: p.y, w: p.w, h: p.h }]));
}
// The window changed size: rescale, and on a turn (portrait ⇄ landscape) bring that shape's layout.
function onScreenChange() {
  if (uiScale() !== appliedScale) {
    applyFont();
    applyTheme();
    for (const p of cfg.panels) applyZoom(p);
  }
  const o = orientation();
  if (o === currentOrientation) return;
  rememberLayout(); // the shape being left
  currentOrientation = o;
  const saved = cfg.layouts[o] || {};
  if (cfg.panels.some((p) => saved[p.id])) {
    for (const p of cfg.panels) {
      const r = saved[p.id];
      if (!r) continue;
      p.w = clamp(Number(r.w) || p.w, MIN_W, 100);
      p.h = clamp(Number(r.h) || p.h, MIN_H, 100);
      p.x = clamp(Number(r.x) || 0, 0, 100 - p.w);
      p.y = clamp(Number(r.y) || 0, 0, 100 - p.h);
      layoutPanel(p);
    }
    buildPresets();
    syncPanelInputs();
    save();
  } else {
    applyPreset(o === 'landscape' ? 'cols' : 'corners');
  }
  toast(o === 'landscape' ? 'صفحه افقی شد و چیدمان افقی آمد. هر جهت صفحه چیدمان خودش را نگه می‌دارد.' : 'صفحه عمودی شد و چیدمان عمودی برگشت.', 6000);
}

function applyTheme() {
  const s = document.documentElement.style;
  const c = cfg.colors;
  const ps = cfg.panelStyle;
  const k = (appliedScale = uiScale());
  $('#sw-tokens').textContent = StreamWall.themeVars(cfg); // the same tokens the skins get
  s.setProperty('--glow', c.border);
  s.setProperty('--panel-rgb', hexToRgb(c.panel).join(' '));
  s.setProperty('--panel-a', String(c.panelAlpha / 100));
  s.setProperty('--ui-s', String(k));
  s.setProperty('--tb', String(2 * k)); // the top bar (topbar.js) is drawn in multiples of --tb
  s.setProperty('--gap', ps.gap * k + 'px');
  s.setProperty('--radius', ps.radius * k + 'px');
  s.setProperty('--bw', ps.borderWidth + 'px');
  s.setProperty('--glass', ps.glass + 'px');
  s.setProperty('--tag-h', ps.headH * k + 'px');
  document.body.dataset.style = StreamWall.STYLES[cfg.style] ? cfg.style : 'neon';
  $$('#styleGrid [data-style]').forEach((b) => {
    b.classList.toggle('on', b.dataset.style === document.body.dataset.style);
    b.setAttribute('aria-pressed', String(b.dataset.style === document.body.dataset.style));
  });
  document.body.classList.toggle('glow', !!ps.glow);
  document.body.classList.toggle('chrome-bar', ps.chrome === 'bar');
  document.body.classList.toggle('drawer-left', !!cfg.drawerLeft);
  $$('#themeGrid .theme').forEach((b) => b.classList.toggle('on', b.dataset.theme === cfg.theme));
}

function applyFont() {
  const f = FONTS.find((x) => x.id === cfg.font.id) || FONTS[0];
  const main = f.id === 'system' ? cfg.font.custom.trim() || 'Tahoma' : f.family;
  const names = [...new Set([main, ...(f.local || []), 'Vazirmatn', 'Vazir', 'Tahoma'])];
  cfg.font.stack = names.map((n) => `"${n.replace(/["\\;{}]/g, '')}"`).join(', ') + ', sans-serif';
  cfg.font.hrefs = (f.css || []).map((u) => CDN + u);

  const wanted = cfg.font.hrefs.join('|');
  if (document.head.dataset.fontHrefs !== wanted) {
    $$('link[data-font]').forEach((l) => l.remove());
    for (const href of cfg.font.hrefs) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.dataset.font = '';
      document.head.append(link);
    }
    document.head.dataset.fontHrefs = wanted;
  }
  const s = document.documentElement.style;
  s.setProperty('--font', cfg.font.stack);
  s.setProperty('--fs', cfg.font.size * uiScale() + 'px');
  s.setProperty('--fw', String(cfg.font.weight));
  $$('[data-font-system]').forEach((n) => (n.hidden = cfg.font.id !== 'system'));
}

const cssUrl = (u) => String(u).replace(/["\\\n\r]/g, (ch) => '\\' + ch);

function applyBackground() {
  const b = cfg.background;
  const el = $('#bg');
  const st = el.style;
  let base = b.c1;
  if (b.type === 'gradient') base = `linear-gradient(${b.angle}deg, ${b.c1}, ${b.c2}, ${b.c3})`;
  if (b.type === 'aurora') {
    base =
      `radial-gradient(60% 38% at 12% 8%, ${b.c3} 0%, transparent 70%),` +
      `radial-gradient(55% 34% at 92% 34%, color-mix(in srgb, ${cfg.colors.accent} 30%, transparent) 0%, transparent 70%),` +
      `radial-gradient(75% 45% at 40% 100%, ${b.c2} 0%, transparent 72%), ${b.c1}`;
  }
  st.background = base;

  const image = b.type === 'image' ? bgImage : b.type === 'url' ? normalizeUrl(b.url) : '';
  const blur = image ? b.blur : 0;
  if (image) {
    st.backgroundImage = `url("${cssUrl(image)}")`;
    st.backgroundSize = b.fit === 'contain' ? 'contain' : 'cover';
    st.backgroundPosition = 'center';
    st.backgroundRepeat = 'no-repeat';
  }
  st.filter = blur ? `blur(${blur}px)` : '';
  st.inset = blur ? `-${blur * 2}px` : '';

  const animate = !!b.animate && (b.type === 'aurora' || b.type === 'gradient');
  el.classList.toggle('animate', animate);
  if (animate) st.backgroundSize = '220% 220%';

  $('#bgDim').style.opacity = String(b.dim / 100);
  document.body.classList.toggle('no-grain', !b.grain);
  $$('#viewMain [data-show]').forEach((n) => (n.hidden = !n.dataset.show.split(' ').includes(b.type)));
}

function applyAll() {
  applyFont();
  applyTheme();
  applyBackground();
  for (const p of cfg.panels) layoutPanel(p);
  syncSahneFeed();
  applyIdentity();
}

// ---------- the streamer ----------
// Who this wall is for: typed in settings, else what Sahne Plus knows (its Kick channel), else the
// reward queue address, else owner.json. Addresses may say {kick}; the top bar's links and the
// StreamFa rank (topbar.js reads <html data-kick>) follow the same ID.
let detectedKick = { id: '', from: '' };
const cleanKickId = (raw) => {
  let s = String(raw || '').trim();
  const m = /kick\.com\/(?:popout\/)?([^/?#\s]+)/i.exec(s);
  if (m) s = m[1];
  return s.replace(/^@/, '').replace(/[^\w.-]/g, '').toLowerCase().slice(0, 40);
};
const streamerId = () => cleanKickId(cfg.kickId) || detectedKick.id;
function resolveUrl(url) {
  if (!url || !url.includes('{kick}')) return url || '';
  const id = streamerId();
  return id ? url.replaceAll('{kick}', encodeURIComponent(id)) : '';
}
async function detectKick() {
  let id = '';
  let from = '';
  if (EXT) {
    const { sahneInfo } = await chrome.storage.local.get('sahneInfo');
    if (sahneInfo && sahneInfo.channel) [id, from] = [sahneInfo.channel, 'از صحنه پلاس'];
  }
  if (!id) {
    for (const p of cfg.panels) {
      const m = /kick\.com\/popout\/([^/{}]+)\//i.exec(p.url || '');
      if (m) {
        [id, from] = [m[1], 'از آدرس صف ریوارد'];
        break;
      }
    }
  }
  if (!id && OWNER.channel) [id, from] = [OWNER.channel, 'از فایل شخصی'];
  detectedKick = { id: cleanKickId(id), from };
  applyIdentity();
}
// The donation page for the top bar's link, from the site the donations panel uses.
const DONATE_PAGES = {
  donofa: ['دونوفا', (id) => `https://donofa.ir/${id}`],
  reymit: ['ریمیت', (id) => `https://reymit.ir/${id}`],
  streamelements: ['StreamElements', (id) => `https://streamelements.com/${id}/tip`],
};
function applyIdentity() {
  const id = streamerId();
  document.documentElement.dataset.kick = id;
  const input = $('#kickIdInput');
  if (input) input.placeholder = detectedKick.id || 'آیدی کانالت در کیک';
  const hint = $('#kickIdHint');
  if (hint) {
    hint.textContent = cleanKickId(cfg.kickId)
      ? 'دستی وارد شده'
      : detectedKick.id
        ? `${detectedKick.id} · ${detectedKick.from} (خالی بماند تا خودکار بماند)`
        : 'پیدا نشد · واردش کن یا صحنه پلاس را باز کن';
  }
  const kick = $('#tbKick');
  if (kick) kick.href = id ? `https://kick.com/${encodeURIComponent(id)}` : 'https://kick.com/';
  // the donation link: typed in settings, else the owner's, else the donations panel's site + the ID
  // (a Reymit/Donofa name can differ from the Kick one, hence the field); its label follows its site
  const panel = cfg.panels.find((p) => p.id === 'donate') || cfg.panels.find((p) => DONATE_PAGES[StreamWall.siteKeyFor(p.url)]);
  const built = DONATE_PAGES[panel && StreamWall.siteKeyFor(panel.url)];
  const auto = OWNER.donatePage || (built && id ? built[1](encodeURIComponent(id)) : '');
  const href = normalizeUrl(cfg.donatePage) || auto;
  const donateInput = $('#donatePageInput');
  if (donateInput) donateInput.placeholder = auto || 'مثلاً https://reymit.ir/…';
  const donate = $('#tbDonate');
  if (donate) {
    const site = DONATE_PAGES[StreamWall.siteKeyFor(href)];
    donate.hidden = !href;
    if (href) donate.href = href;
    $('.tb-label', donate).textContent = site ? site[0] : 'دونیت';
  }
  // a panel built from {kick} follows a new ID
  for (const p of cfg.panels) {
    const v = views.get(p.id);
    if (v && p.url && p.url.includes('{kick}') && v.mountedSrc !== resolveUrl(p.url)) mountFrame(p);
  }
}
function openIdentity() {
  setDrawer(true);
  showTab('more');
  setTimeout(() => $('#kickIdInput') && $('#kickIdInput').focus(), 350);
}

// ---------- Sahne Plus ----------
// The streamer's own alert app serves its event stream only to its own pages, so a hidden frame
// on its server (any path; sahne-feed.js acts on /sw-feed) reads it and keeps subs and gifts in
// storage, where kickbot-sahne.js picks them up. Reloaded when its heartbeat stops (app restarted).
const SAHNE_FEED_URL = 'http://127.0.0.1:7788/sw-feed';
let sahneFrame = null;
function syncSahneFeed() {
  const want = EXT && cfg.panels.some((p) => p.visible && p.sahne && StreamWall.siteKeyFor(p.url) === 'kickbot');
  if (!want) {
    if (sahneFrame) sahneFrame.remove();
    sahneFrame = null;
    return;
  }
  if (sahneFrame) return;
  sahneFrame = document.createElement('iframe');
  sahneFrame.className = 'sahne-feed';
  sahneFrame.tabIndex = -1;
  sahneFrame.setAttribute('aria-hidden', 'true');
  sahneFrame.src = SAHNE_FEED_URL;
  document.body.append(sahneFrame);
}
if (EXT) {
  setInterval(async () => {
    if (!sahneFrame) return;
    const { sahneAlive = 0 } = await chrome.storage.local.get('sahneAlive');
    if (Date.now() - sahneAlive > 60000) sahneFrame.src = SAHNE_FEED_URL + '?r=' + Date.now();
  }, 60000);
  setTimeout(() => {
    checkSahne();
    setInterval(checkSahne, 60000);
  }, 25000);
}
// Subs and gifts need Sahne Plus running on this PC, recent enough to have the event stream.
const SAHNE_MIN_VERSION = '1.6.1';
const SAHNE_DOWNLOAD = 'https://github.com/AmirEyZed/sahne-plus/releases/latest';
let sahneWarned = false;
const versionAtLeast = (v, min) => {
  const a = String(v).split(/[.-]/).map((n) => parseInt(n, 10) || 0);
  const b = String(min).split(/[.-]/).map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  return true;
};
let sahneState = { state: 'off', version: '' };
async function checkSahne() {
  if (!sahneFrame) return showSahneState('off');
  const { sahneAlive = 0, sahneInfo = null } = await chrome.storage.local.get(['sahneAlive', 'sahneInfo']);
  const version = (sahneInfo && sahneInfo.version) || '';
  const state = Date.now() - sahneAlive > 70000 ? 'missing' : version && !versionAtLeast(version, SAHNE_MIN_VERSION) ? 'old' : 'ok';
  showSahneState(state, version);
  if (state === 'ok' || sahneWarned) return;
  sahneWarned = true;
  toast(
    state === 'old'
      ? `ساب و گیفت‌ها به صحنه پلاس ${SAHNE_MIN_VERSION} یا جدیدتر نیاز دارند (نسخهٔ نصب‌شده: ${version}). آخرین نسخه را نصب کن.`
      : 'برای نمایش ساب و گیفت‌ها، صحنه پلاس باید روی همین کامپیوتر نصب و باز باشد. آخرین نسخه را نصب و اجرا کن.',
    15000,
    { label: 'دانلود صحنه پلاس', run: () => window.open(SAHNE_DOWNLOAD, '_blank', 'noopener') },
  );
}
function showSahneState(state, version = '') {
  sahneState = { state, version };
  const box = $('#sahneStatus');
  if (!box) return;
  box.dataset.state = state;
  $('.ss-text', box).textContent =
    state === 'ok'
      ? `وصل به صحنه پلاس${version ? ' · نسخهٔ ' + version : ''}`
      : state === 'old'
        ? `صحنه پلاس قدیمی است (${version}) · نسخهٔ ${SAHNE_MIN_VERSION} یا جدیدتر لازم است`
        : state === 'missing'
          ? 'صحنه پلاس پیدا نشد · باید نصب و باز باشد'
          : 'هنوز بررسی نشده';
}

// ---------- panels ----------
const EDGES = ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'];
const bodyObserver = new ResizeObserver((entries) => {
  for (const entry of entries) {
    const p = cfg.panels.find((q) => q.id === entry.target.dataset.pid);
    if (p) applyZoom(p);
  }
});

const SANDBOX =
  'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox ' +
  'allow-modals allow-downloads allow-pointer-lock allow-presentation allow-storage-access-by-user-activation';

function createView(p) {
  const root = document.createElement('section');
  root.className = 'panel';
  root.dataset.id = p.id;
  root.innerHTML = `
    <div class="p-frame">
      <div class="p-body">
        <div class="p-view"></div>
        <div class="p-loader" dir="rtl"><i></i><i></i><i></i>
          <div class="p-slow">${icon('alert')}<span>بارگذاری این صفحه طول کشیده</span><button type="button" class="btn sm" data-act="reload">${icon('refresh')}تلاش دوباره</button></div>
        </div>
      </div>
      <div class="p-pickbar" dir="rtl" hidden>
        ${icon('crop')}<span>دور بخشی که می‌خواهی دیده شود کادر بکش · برای پایین‌تر اسکرول کن</span>
        <button type="button" class="btn sm" data-act="pick-cancel">انصراف</button>
      </div>
      <div class="p-edit">
        <b class="pe-title"></b>
        <span class="pe-size"></span>
        <div class="pe-tools">
          <button type="button" class="btn sm" data-corner="tl" title="گوشهٔ بالا-چپ">${icon('corner-tl')}</button>
          <button type="button" class="btn sm" data-corner="tr" title="گوشهٔ بالا-راست">${icon('corner-tr')}</button>
          <button type="button" class="btn sm" data-corner="bl" title="گوشهٔ پایین-چپ">${icon('corner-bl')}</button>
          <button type="button" class="btn sm" data-corner="br" title="گوشهٔ پایین-راست">${icon('corner-br')}</button>
          <button type="button" class="btn sm" data-act="settings">${icon('sliders')}تنظیمات</button>
          <button type="button" class="btn sm" data-act="hide">${icon('eye-off')}پنهان</button>
        </div>
        ${EDGES.map((h) => `<i class="h h-${h}" data-h="${h}"></i>`).join('')}
      </div>
    </div>
    <header class="p-tag" tabindex="0" title="برای جابه‌جایی بکش · یا با کلیدهای جهت">
      <span class="p-badge"></span><span class="p-title"></span>
      <span class="p-alt" role="group" hidden><button type="button" data-act="alt"></button><button type="button" data-act="alt"></button></span>
      <span class="p-count" hidden></span>
      <span class="p-tools" dir="ltr">
        <button type="button" class="p-btn" data-act="smaller" title="ریزتر کردن محتوا">${icon('zoom-out')}</button>
        <span class="p-zoom" title="اندازهٔ محتوا"></span>
        <button type="button" class="p-btn" data-act="bigger" title="درشت‌تر کردن محتوا">${icon('zoom-in')}</button>
        <span class="sep"></span>
        <button type="button" class="p-btn" data-act="pick" title="فقط بخشی از صفحه را نشان بده">${icon('crop')}</button>
        <button type="button" class="p-btn" data-act="reload" title="بارگذاری دوباره">${icon('refresh')}</button>
        <button type="button" class="p-btn" data-act="open" title="باز کردن در تب جدید">${icon('external')}</button>
        <button type="button" class="p-btn" data-act="settings" title="تنظیمات این پنل">${icon('sliders')}</button>
      </span>
    </header>
    ${EDGES.map((h) => `<i class="grip grip-${h}" data-h="${h}"></i>`).join('')}`;

  const v = {
    root,
    tag: $('.p-tag', root),
    badge: $('.p-badge', root),
    title: $('.p-title', root),
    alt: $('.p-alt', root),
    count: $('.p-count', root),
    zoomLabel: $('.p-zoom', root),
    body: $('.p-body', root),
    view: $('.p-view', root),
    pickbar: $('.p-pickbar', root),
    picking: null,
    edit: $('.p-edit', root),
    peTitle: $('.pe-title', root),
    peSize: $('.pe-size', root),
    iframe: null,
    timer: 0,
    slowTimer: 0,
    flashTimer: 0,
    lastSig: null,
    unseen: 0,
    badgeFor: null,
  };
  v.body.dataset.pid = p.id;
  bodyObserver.observe(v.body);

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act], [data-corner]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (btn.dataset.corner) moveToCorner(p, btn.dataset.corner);
    if (act === 'smaller') nudgeZoom(p, -1);
    if (act === 'bigger') nudgeZoom(p, 1);
    if (act === 'pick') startPick(p);
    if (act === 'pick-cancel') endPick(p);
    if (act === 'reload') reloadPanel(p);
    if (act === 'alt' && btn.getAttribute('aria-pressed') !== 'true') switchAddress(p);
    if (act === 'open' && resolveUrl(p.url)) window.open(resolveUrl(p.url), '_blank', 'noopener');
    if (act === 'identity') openIdentity();
    if (act === 'settings') openPanelSettings(p.id);
    if (act === 'hide') setPanelVisible(p, false);
  });
  // Seen it: resting on the panel for a moment (or clicking its tag) clears the "new" counter;
  // a cursor just passing over on its way somewhere else doesn't.
  let seenTimer = 0;
  root.addEventListener('pointerenter', () => {
    clearTimeout(seenTimer);
    if (v.unseen) seenTimer = setTimeout(() => setUnseen(v, 0), 1200);
  });
  root.addEventListener('pointerleave', () => clearTimeout(seenTimer));
  v.tag.addEventListener('click', () => setUnseen(v, 0));
  v.tag.addEventListener('keydown', (e) => nudgePanel(e, p));
  // Always available, no edit mode needed: drag the name tag to move, drag any edge to resize.
  v.tag.addEventListener('pointerdown', (e) => startDrag(e, p, 'move', true));
  for (const grip of $$('.grip', root)) grip.addEventListener('pointerdown', (e) => startDrag(e, p, grip.dataset.h));
  v.edit.addEventListener('dblclick', (e) => {
    if (!e.target.closest('button')) openPanelSettings(p.id);
  });
  v.edit.addEventListener('pointerdown', (e) => startDrag(e, p, e.target.dataset.h || 'move'));
  return v;
}

function setLoading(v, on) {
  clearTimeout(v.slowTimer);
  v.root.classList.toggle('loading', on);
  v.root.classList.remove('slow');
  if (on) v.slowTimer = setTimeout(() => v.root.classList.add('slow'), SLOW_MS);
}

function mountFrame(p) {
  const v = views.get(p.id);
  if (!v) return;
  clearInterval(v.timer);
  v.timer = 0;
  if (v.picking) endPick(p, false);
  v.iframe = null;
  v.view.textContent = '';
  setLoading(v, false);
  const token = (v.mountToken = (v.mountToken || 0) + 1);
  if (!p.visible) return;
  const src = resolveUrl(p.url);
  v.mountedSrc = src;
  if (!src) {
    const empty = document.createElement('div');
    empty.className = 'p-empty';
    const needsId = !!p.url && p.url.includes('{kick}');
    const text = needsId
      ? 'برای این پنل آیدی کیکت لازم است: در تنظیمات ← بیشتر ← کانال واردش کن، یا صحنه پلاس را باز کن تا خودش پیدا کند'
      : esc(p.hint || 'هنوز آدرسی برای این پنل وارد نشده');
    empty.innerHTML = needsId
      ? `${icon('link')}<span>${text}</span><button type="button" class="btn primary" data-act="identity">${icon('sliders')}وارد کردن آیدی کیک</button>`
      : `${icon('link')}<span>${text}</span><button type="button" class="btn primary" data-act="settings">${icon('plus')}افزودن آدرس</button>`;
    v.view.append(empty);
    return;
  }
  const f = document.createElement('iframe');
  f.allow = 'autoplay; fullscreen; clipboard-read; clipboard-write; encrypted-media; picture-in-picture';
  if (p.sandbox) f.setAttribute('sandbox', SANDBOX);
  v.view.append(f);
  v.iframe = f;
  setLoading(v, true);
  frameNameFor(p).then((name) => {
    if (v.mountToken !== token) return; // remounted meanwhile
    f.name = name;
    f.addEventListener('load', () => v.mountToken === token && setLoading(v, false), { once: true });
    f.addEventListener('load', () => (v.loadedAt = Date.now())); // also the page's own reloads
    f.src = src;
  });
  if (p.refresh > 0) {
    v.timer = setInterval(() => {
      // Don't yank the page away while it is being used (typing a login, clicking around).
      if (document.activeElement !== v.iframe) reloadPanel(p);
    }, Math.max(5, p.refresh) * 1000);
  }
}

// ---------- something new arrived ----------
// content.js (or the dev preview) reports a fingerprint of a page's newest item. A change after
// the first report means a new donation / tip: the panel flashes and its tag counts it until
// the panel is hovered. The fingerprint survives the page's own reloads, so auto-refreshing
// panels don't flash for nothing.
function onActivity(panelId, sig, kind = null) {
  const v = views.get(panelId);
  if (!v || !sig) return;
  const prev = v.lastSig;
  v.lastSig = sig;
  if (prev === null || prev === sig) return;
  const p = cfg.panels.find((q) => q.id === panelId);
  const site = p && StreamWall.SITES[StreamWall.siteKeyFor(p.url)];
  // A page that has just (re)loaded can show other items for a moment before its real list
  // (KickBot reloads every minute): what it shows then is the new baseline, not news.
  if (Date.now() - (v.loadedAt || 0) < SETTLE_MS) return logActivity(panelId, prev, sig, 'settling');
  if (site && site.countUp) {
    // a queue count: only a rise is news (completing a request lowers it)
    const num = (t) => Number((String(t).match(/\d+/) || [0])[0]);
    if (num(sig) <= num(prev)) return logActivity(panelId, prev, sig, 'lower');
  }
  logActivity(panelId, prev, sig, 'new');
  v.root.classList.remove('flash');
  void v.root.offsetWidth; // restart the animation
  v.root.classList.add('flash');
  clearTimeout(v.flashTimer);
  v.flashTimer = setTimeout(() => v.root.classList.remove('flash'), 2700);
  setUnseen(v, v.unseen + 1);
  if (p && p.notify) chime(CHIMES[kind] ? kind : StreamWall.siteKeyFor(p.url), v);
}

const SETTLE_MS = 10000;

// The last few signals, kept in storage (swActivityLog) to tell a real item from a page that
// keeps changing its newest item by itself.
const activityLog = [];
let activityLogSave = 0;
function logActivity(panelId, prev, sig, act) {
  activityLog.push({ at: new Date().toISOString().slice(11, 19), panelId, act, prev: String(prev).slice(0, 90), sig: String(sig).slice(0, 90) });
  if (activityLog.length > 40) activityLog.shift();
  if (!EXT) return;
  clearTimeout(activityLogSave);
  activityLogSave = setTimeout(() => chrome.storage.local.set({ swActivityLog: activityLog }).catch(() => {}), 1000);
}

// ---------- sound ----------
// One short synthesized chime per kind of item, so a donation, a tip and a reward can be told
// apart by ear: [frequency Hz, start s] notes, each a soft bell (sine + a quiet octave).
const CHIMES = {
  donofa: [[783.99, 0], [1046.5, 0.1], [1318.51, 0.2]], // donation: rising G-C-E, the brightest
  kickbot: [[1567.98, 0], [2093, 0.075]], // tip: a quick high coin "ding-ding"
  kick: [[659.25, 0], [880, 0.13]], // reward: a calm two-note "ding-dong" up
  sub: [[523.25, 0], [659.25, 0.09], [783.99, 0.18]], // sub (from Sahne Plus): a warm C-E-G
  gift: [[1318.51, 0], [1567.98, 0.07], [2093, 0.14], [2637.02, 0.21]], // gift subs: a high sparkle run
};
let audioCtx = null;
let soundBlockedShown = false;
function audioContext() {
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}
async function chime(siteKey, v = null) {
  const notes = CHIMES[siteKey] || CHIMES.kick;
  if (!cfg.sound.on || !(cfg.sound.volume > 0)) return;
  if (!EXT && !/[?&]sound/.test(location.search)) return; // dev preview: silent unless ?sound
  if (v) {
    // several items landing at once (a page catching up) ring once
    if (Date.now() - (v.chimedAt || 0) < 1500) return;
    v.chimedAt = Date.now();
  }
  const ctx = audioContext();
  if (!ctx) return;
  if (ctx.state !== 'running') await Promise.race([ctx.resume().catch(() => {}), new Promise((r) => setTimeout(r, 400))]);
  if (ctx.state !== 'running') {
    // Chrome may hold sound back until the page has been clicked once
    if (!soundBlockedShown) toast('برای پخش صدای اعلان‌ها یک بار هرجای دیوار کلیک کن.', 9000);
    soundBlockedShown = true;
    return;
  }
  const out = ctx.createGain();
  out.gain.value = Math.pow(cfg.sound.volume / 100, 1.6) * 0.55; // the slider feels even this way
  out.connect(ctx.destination);
  const t0 = ctx.currentTime + 0.02;
  for (const [freq, at] of notes) {
    for (const [mult, amp, dur] of [[1, 1, 0.9], [2, 0.18, 0.4]]) {
      const t = t0 + at;
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq * mult;
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(amp, t + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(env).connect(out);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }
  }
  setTimeout(() => out.disconnect(), 2000);
}
// Any click or key on the wall lets Chrome start sound later without one.
for (const type of ['pointerdown', 'keydown']) addEventListener(type, () => audioContext(), { capture: true, passive: true });

function setUnseen(v, n) {
  v.unseen = n;
  v.count.hidden = n === 0;
  v.count.textContent = '+' + fa(n);
  v.root.classList.toggle('unseen', n > 0);
}

// Arrow keys on a focused name tag move the panel (Shift = bigger steps).
let nudgeSave = 0;
function nudgePanel(e, p) {
  const step = e.shiftKey ? 5 : 1;
  const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
  if (!d) return;
  e.preventDefault();
  p.x = r2(clamp(p.x + d[0], 0, 100 - p.w));
  p.y = r2(clamp(p.y + d[1], 0, 100 - p.h));
  layoutPanel(p);
  clearTimeout(nudgeSave);
  nudgeSave = setTimeout(() => {
    syncPanelInputs();
    buildPresets();
    save();
  }, 300);
}

// A fresh frame rather than re-setting src, so a bridged panel starts from current cookies.
// Flip a panel to its other address (the name tag's switch).
function switchAddress(p) {
  if (!p.url2) return;
  [p.url, p.url2] = [p.url2, p.url];
  [p.urlName, p.url2Name] = [p.url2Name, p.urlName];
  p.altFlip = !p.altFlip;
  const v = views.get(p.id);
  if (v) v.lastSig = null; // another page: its newest item is a new baseline, not news
  mountFrame(p);
  layoutPanel(p);
  if (currentPanelId === p.id) syncPanelInputs();
  syncSahneFeed();
  save();
}

function reloadPanel(p) {
  mountFrame(p);
  layoutPanel(p);
}

function layoutPanel(p) {
  const v = views.get(p.id);
  if (!v) return;
  const s = v.root.style;
  s.left = p.x + '%';
  s.top = p.y + '%';
  s.width = p.w + '%';
  s.height = p.h + '%';
  s.zIndex = String(p.z);
  v.root.hidden = !p.visible;
  v.root.classList.toggle('no-head', !p.header);
  v.title.textContent = p.title;
  v.peTitle.textContent = p.title;
  v.alt.hidden = !p.url2;
  if (p.url2) {
    // fixed order (first, second), whichever is showing
    const here = { name: p.urlName || 'این', on: true };
    const there = { name: p.url2Name || 'آن یکی', on: false };
    const [a, b] = p.altFlip ? [there, here] : [here, there];
    [a, b].forEach((s, i) => {
      const btn = v.alt.children[i];
      btn.textContent = s.name;
      btn.setAttribute('aria-pressed', String(s.on));
      btn.title = s.on ? 'همین الان نمایش داده می‌شود' : 'رفتن به ' + s.name;
    });
  }
  if (v.badgeFor !== p.url) {
    v.badge.innerHTML = `<span>${badgeHtml(p.url)}</span>`;
    v.badgeFor = p.url;
  }
  if (v.iframe) v.iframe.classList.toggle('force-dark', !!p.transparent);
  const site = StreamWall.SITES[StreamWall.siteKeyFor(p.url)];
  v.root.classList.toggle('feed', !!(p.skin && site && site.newest && skinFor(p.url)));
  applyZoom(p);
  if (editing && p.visible) {
    const box = v.edit.getBoundingClientRect();
    v.peSize.textContent = `${Math.round(box.width)} × ${Math.round(box.height)} px`;
  }
}

// Manual mode: the page is as wide as the panel and scaled by p.zoom.
// Desktop mode (p.pageW > 0): the page is laid out p.pageW wide — so sites that refuse small
// screens work — and scaled so that width always fits the panel, whatever size it is dragged to.
// With a region (cropX/cropY/cropW) only that part of the page is shown: its left/top are
// pushed out of view and its width is what gets fitted to the panel.
function applyZoom(p) {
  const v = views.get(p.id);
  if (!v) return;
  const width = v.body.clientWidth;
  let zoom = (p.zoom / 100) * uiScale(); // a page drawn in px keeps its size relative to the screen
  let pageW = p.pageW;
  let cx = p.cropX;
  let cy = p.cropY;
  if (v.picking) {
    // Choosing a region: show the whole page, fitted to the panel, nothing cut off.
    pageW = v.picking.pageW;
    cx = cy = 0;
    if (width > 0) zoom = width / pageW;
    v.picking.zoom = zoom;
    v.view.style.height = Math.round(PICK_PAGE_HEIGHT * zoom) + 'px';
  } else if (pageW > 0) {
    const shown = p.cropW > 0 ? p.cropW : pageW - cx;
    if (shown > 0 && width > 0) zoom = width / shown;
  }
  v.body.style.setProperty('--z', String(zoom));
  if (!v.picking) v.zoomLabel.textContent = fa(Math.round(zoom * 100)) + '٪';
  v.body.style.setProperty('--cx', cx + 'px');
  v.body.style.setProperty('--cy', cy + 'px');
  if (v.iframe) v.iframe.style.width = pageW > 0 ? pageW + 'px' : '';
}

// ---------- choosing which part of a page a panel shows ----------
const PICK_PAGE_HEIGHT = 3200; // page px laid out while choosing, so parts far down are reachable

function startPick(p) {
  const v = views.get(p.id);
  if (!v || !v.iframe || v.picking) return;
  if (editing) setEditing(false);
  setDrawer(false);
  // A region only stays put if the page keeps one layout width, so choosing one pins it.
  const pageW = p.pageW > 0 ? p.pageW : Math.max(320, Math.round(v.body.clientWidth / (p.zoom / 100)));
  v.picking = { pageW, zoom: 1 };
  v.body.classList.add('picking');
  v.pickbar.hidden = false;

  const layer = document.createElement('div');
  layer.className = 'p-pick';
  const box = document.createElement('div');
  box.className = 'p-pickbox';
  box.hidden = true;
  layer.append(box);
  v.view.append(layer);

  let start = null;
  const local = (e) => {
    const r = layer.getBoundingClientRect();
    return { x: clamp(e.clientX - r.left, 0, r.width), y: clamp(e.clientY - r.top, 0, r.height) };
  };
  const rectOf = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });
  layer.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    start = local(e);
    try {
      layer.setPointerCapture(e.pointerId);
    } catch {}
  });
  layer.addEventListener('pointermove', (e) => {
    if (!start) return;
    const r = rectOf(start, local(e));
    box.hidden = false;
    Object.assign(box.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
  });
  layer.addEventListener('pointerup', (e) => {
    if (!start) return;
    const r = rectOf(start, local(e));
    start = null;
    const z = v.picking.zoom;
    if (r.w / z < 80 || r.h / z < 40) {
      box.hidden = true; // too small to be meant; let them try again
      return;
    }
    Object.assign(p, { pageW, cropX: Math.round(r.x / z), cropY: Math.round(r.y / z), cropW: Math.round(r.w / z) });
    endPick(p);
    toast('فقط همین بخش نشان داده می‌شود. برای برگشتن: ⚙ همان پنل ← «نمایش کل صفحه».');
  });
  layoutPanel(p);
}

function endPick(p, relayout = true) {
  const v = views.get(p.id);
  if (!v || !v.picking) return;
  v.picking = null;
  v.body.classList.remove('picking');
  v.body.scrollTop = 0;
  v.view.style.height = '';
  v.pickbar.hidden = true;
  $('.p-pick', v.view)?.remove();
  if (!relayout) return;
  layoutPanel(p);
  syncPanelInputs();
  save();
}

function clearRegion(p) {
  Object.assign(p, { cropX: 0, cropY: 0, cropW: 0 });
  layoutPanel(p);
  syncPanelInputs();
  save();
}

function nudgeZoom(p, direction) {
  if (p.pageW > 0) p.pageW = clamp(Math.round((p.pageW * (direction > 0 ? 0.9 : 1.1)) / 10) * 10, 320, 3840);
  else p.zoom = clamp(p.zoom + direction * 5, 25, 200);
  layoutPanel(p);
  syncPanelInputs();
  save();
}

function renderPanels() {
  for (const v of views.values()) {
    clearInterval(v.timer);
    bodyObserver.unobserve(v.body);
    v.root.remove();
  }
  views.clear();
  cfg.panels.forEach((p, i) => {
    const v = createView(p);
    v.root.style.setProperty('--i', String(i));
    views.set(p.id, v);
    panelsEl.append(v.root);
    mountFrame(p);
    layoutPanel(p);
  });
  renderPanelList();
}

function setPanelVisible(p, visible) {
  p.visible = visible;
  mountFrame(p);
  layoutPanel(p);
  renderPanelList();
  buildPresets();
  save();
}

function bringToFront(p) {
  const top = Math.max(...cfg.panels.map((q) => q.z));
  if (p.z === top && cfg.panels.filter((q) => q.z === top).length === 1) return;
  p.z = top + 1;
  if (p.z > 500) [...cfg.panels].sort((a, b) => a.z - b.z).forEach((q, i) => (q.z = i + 1));
  for (const q of cfg.panels) layoutPanel(q);
}

function moveToCorner(p, corner) {
  p.x = corner.endsWith('l') ? 0 : r2(100 - p.w);
  p.y = corner.startsWith('t') ? 0 : r2(100 - p.h);
  layoutPanel(p);
  syncPanelInputs();
  save();
}

const PRESETS = [
  ['corners', 'چهار گوشه'],
  ['grid', 'شبکه'],
  ['rows', 'ردیفی'],
  ['cols', 'ستونی'],
  ['left', 'چپ بلند'],
  ['right', 'راست بلند'],
];

// Rectangles (in %) for n panels in a preset layout.
function presetLayout(kind, n) {
  const R = (x, y, w, h) => ({ x: r2(x), y: r2(y), w: r2(w), h: r2(h) });
  if (kind === 'rows' || n === 1) return Array.from({ length: n }, (_, i) => R(0, (i * 100) / n, 100, 100 / n));
  if (kind === 'cols') return Array.from({ length: n }, (_, i) => R((i * 100) / n, 0, 100 / n, 100));
  if (kind === 'left' || kind === 'right') {
    const tall = orientation() === 'landscape' ? 30 : 46;
    const rest = n - 1;
    return [
      R(kind === 'left' ? 0 : 100 - tall, 0, tall, 100),
      ...Array.from({ length: rest }, (_, i) => R(kind === 'left' ? tall : 0, (i * 100) / rest, 100 - tall, 100 / rest)),
    ];
  }
  const cols = kind === 'corners' ? [46, 54] : [50, 50];
  const rows = Math.ceil(n / 2);
  const heights = kind === 'corners' && rows === 2 ? [62, 38] : Array(rows).fill(100 / rows);
  const out = [];
  let y = 0;
  for (let r = 0; r < rows; r++) {
    if (r * 2 + 1 === n) out.push(R(0, y, 100, heights[r]));
    else out.push(R(0, y, cols[0], heights[r]), R(cols[0], y, cols[1], heights[r]));
    y += heights[r];
  }
  return out;
}

function presetSvg(kind, n) {
  const land = orientation() === 'landscape';
  const W = land ? 80 : 45;
  const H = land ? 45 : 80; // the wall's own shape
  const rects = presetLayout(kind, Math.max(1, n))
    .map((r) => `<rect x="${(r.x * W) / 100 + 1.5}" y="${(r.y * H) / 100 + 1.5}" width="${Math.max(1, (r.w * W) / 100 - 3)}" height="${Math.max(1, (r.h * H) / 100 - 3)}" rx="3"/>`)
    .join('');
  return `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">${rects}</svg>`;
}

function applyPreset(kind) {
  const ps = cfg.panels.filter((p) => p.visible);
  if (!ps.length) return;
  presetLayout(kind, ps.length).forEach((r, i) => Object.assign(ps[i], r));
  for (const p of ps) layoutPanel(p);
  syncPanelInputs();
  buildPresets();
  save();
}

// ---------- drag / resize ----------
function nearest(value, candidates, threshold) {
  let best = null;
  let bestDist = threshold;
  for (const c of candidates) {
    const d = Math.abs(c - value);
    if (d <= bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

const LINE_EPS = 0.4; // % — edges closer than this count as the same divider
const geometry = (q) => ({ x: q.x, y: q.y, w: q.w, h: q.h });

// The divider being dragged is shared: the dragged panel plus every panel whose edge sits on
// the same line and that touches it (directly or through each other) move together, so a
// tiled layout stays tiled — make one taller and its neighbour gets shorter.
// `side` says which of a member's edges is on the line: 'hi' = right/bottom, 'lo' = left/top.
function dividerMembers(p, axis, side, pos, solo) {
  const [lo, size, crossLo, crossSize] = axis === 'x' ? ['x', 'w', 'y', 'h'] : ['y', 'h', 'x', 'w'];
  const members = [{ q: p, side, o: geometry(p) }];
  if (solo) return members;
  const candidates = [];
  for (const q of cfg.panels) {
    if (q === p || !q.visible) continue;
    if (Math.abs(q[lo] - pos) < LINE_EPS) candidates.push({ q, side: 'lo', o: geometry(q) });
    else if (Math.abs(q[lo] + q[size] - pos) < LINE_EPS) candidates.push({ q, side: 'hi', o: geometry(q) });
  }
  const touches = (a, b) => Math.min(a[crossLo] + a[crossSize], b[crossLo] + b[crossSize]) - Math.max(a[crossLo], b[crossLo]) > 0.5;
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of candidates) {
      if (members.includes(c) || !members.some((m) => touches(m.o, c.o))) continue;
      members.push(c);
      grew = true;
    }
  }
  return members;
}

// mode: 'move' or a compass edge/corner ('n', 'se', …). fromTitleBar drags only start after a
// few pixels of movement so plain clicks on the title bar stay clicks.
function startDrag(e, p, mode, fromTitleBar = false) {
  if (e.button !== 0 || e.target.closest('button')) return;
  e.preventDefault();
  const box = panelsEl.getBoundingClientRect();
  const solo = e.shiftKey;
  const lines = {};
  if (mode !== 'move') {
    if (mode.includes('e')) lines.x = { pos: p.x + p.w, members: dividerMembers(p, 'x', 'hi', p.x + p.w, solo) };
    if (mode.includes('w')) lines.x = { pos: p.x, members: dividerMembers(p, 'x', 'lo', p.x, solo) };
    if (mode.includes('s')) lines.y = { pos: p.y + p.h, members: dividerMembers(p, 'y', 'hi', p.y + p.h, solo) };
    if (mode.includes('n')) lines.y = { pos: p.y, members: dividerMembers(p, 'y', 'lo', p.y, solo) };
  }

  const moving = new Set([p]);
  for (const line of Object.values(lines)) for (const m of line.members) moving.add(m.q);
  const X = [0, 50, 100];
  const Y = [0, 50, 100];
  for (const q of cfg.panels) {
    if (moving.has(q) || !q.visible) continue;
    X.push(q.x, q.x + q.w);
    Y.push(q.y, q.y + q.h);
  }
  drag = {
    p, mode, lines, X, Y,
    sx: e.clientX, sy: e.clientY,
    o: geometry(p),
    bw: box.width, bh: box.height,
    armed: false, threshold: fromTitleBar ? 4 : 0,
  };
  try {
    e.currentTarget.setPointerCapture(e.pointerId);
  } catch {
    // Capture is only a convenience; iframes stop swallowing the pointer once the drag is armed.
  }
  if (!drag.threshold) armDrag();
}

function armDrag() {
  drag.armed = true;
  if (drag.mode === 'move') bringToFront(drag.p);
  document.body.classList.add('dragging');
}

function moveDrag(e) {
  if (!drag) return;
  if (!drag.armed) {
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < drag.threshold) return;
    armDrag();
  }
  const { p, o, mode, lines, X, Y, bw, bh } = drag;
  const dx = ((e.clientX - drag.sx) / bw) * 100;
  const dy = ((e.clientY - drag.sy) / bh) * 100;
  const snap = !e.altKey;
  const tx = (SNAP_PX / bw) * 100;
  const ty = (SNAP_PX / bh) * 100;
  let gx = null;
  let gy = null;
  let { x, y, w, h } = o;

  if (mode === 'move') {
    x = o.x + dx;
    y = o.y + dy;
    if (snap) {
      const pick = (start, size, lines, thr) => {
        let best = null;
        for (const [off, cands] of [[0, lines], [size, lines], [size / 2, [50]]]) {
          const c = nearest(start + off, cands, thr);
          if (c !== null && (!best || Math.abs(c - start - off) < best.d)) best = { d: Math.abs(c - start - off), pos: c - off, line: c };
        }
        return best;
      };
      const bx = pick(x, w, X, tx);
      const by = pick(y, h, Y, ty);
      if (bx) { x = bx.pos; gx = bx.line; }
      if (by) { y = by.pos; gy = by.line; }
    }
    x = clamp(x, 0, 100 - w);
    y = clamp(y, 0, 100 - h);
    Object.assign(p, { x: r2(x), y: r2(y) });
    layoutPanel(p);
  } else {
    for (const axis of ['x', 'y']) {
      const line = lines[axis];
      if (!line) continue;
      const [lo, size, min] = axis === 'x' ? ['x', 'w', MIN_W] : ['y', 'h', MIN_H];
      let pos = line.pos + (axis === 'x' ? dx : dy);
      let snapped = false;
      if (snap) {
        const c = nearest(pos, axis === 'x' ? X : Y, axis === 'x' ? tx : ty);
        if (c !== null) {
          pos = c;
          snapped = true;
        }
      }
      // Nobody on the divider may shrink below the minimum size.
      let minPos = 0;
      let maxPos = 100;
      for (const m of line.members) {
        if (m.side === 'hi') minPos = Math.max(minPos, m.o[lo] + min);
        else maxPos = Math.min(maxPos, m.o[lo] + m.o[size] - min);
      }
      const clamped = clamp(pos, minPos, maxPos);
      if (snapped && clamped === pos) {
        if (axis === 'x') gx = pos;
        else gy = pos;
      }
      for (const m of line.members) {
        if (m.side === 'hi') m.q[size] = r2(clamped - m.o[lo]);
        else {
          m.q[lo] = r2(clamped);
          m.q[size] = r2(m.o[lo] + m.o[size] - clamped);
        }
        layoutPanel(m.q);
      }
    }
  }

  guideV.hidden = gx === null;
  guideH.hidden = gy === null;
  if (gx !== null) guideV.style.left = gx + '%';
  if (gy !== null) guideH.style.top = gy + '%';
}

function endDrag() {
  if (!drag) return;
  const moved = drag.armed;
  drag = null;
  guideV.hidden = guideH.hidden = true;
  document.body.classList.remove('dragging');
  if (!moved) return;
  syncPanelInputs();
  buildPresets();
  save();
}

// Captured pointer events bubble up here whichever handle started the drag.
window.addEventListener('pointermove', moveDrag);
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', endDrag);

// ---------- drawer UI ----------
function getPath(obj, path) {
  return path.split('.').reduce((a, k) => (a == null ? a : a[k]), obj);
}
function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((a, k) => (a[k] ??= {}), obj)[last] = value;
}
function readInput(inp) {
  if (inp.type === 'checkbox') return inp.checked;
  if (inp.type === 'range' || inp.type === 'number') return Number(inp.value) || 0;
  return inp.value;
}
function writeInput(inp, value) {
  if (inp.type === 'checkbox') inp.checked = !!value;
  else inp.value = value ?? '';
  rangeUi(inp);
}
// A range's filled track and its read-out.
function rangeUi(inp) {
  if (inp.type !== 'range') return;
  const min = Number(inp.min) || 0;
  const max = Number(inp.max) || 100;
  inp.style.setProperty('--fill', ((Number(inp.value) - min) / (max - min)) * 100 + '%');
  const out = inp.parentElement.querySelector('output');
  const unit = inp.dataset.unit === 'px' ? '' : inp.dataset.unit || '';
  if (out) out.textContent = fa(inp.value) + unit;
}
function syncSegments() {
  $$('[data-seg]').forEach((seg) => {
    const value = String(getPath(cfg, seg.dataset.seg));
    seg.querySelectorAll('[data-value]').forEach((b) => {
      b.classList.toggle('on', b.dataset.value === value);
      b.setAttribute('aria-pressed', String(b.dataset.value === value));
    });
  });
}

function syncInputs() {
  $$('[data-bind]').forEach((inp) => writeInput(inp, getPath(cfg, inp.dataset.bind)));
  syncSegments();
  syncPanelInputs();
}

function syncPanelInputs() {
  const p = cfg.panels.find((q) => q.id === currentPanelId);
  if (!p) return;
  $('#pvName').textContent = p.title;
  $('#pvBadge').innerHTML = badgeHtml(p.url);
  $$('[data-pbind]').forEach((inp) => {
    const key = inp.dataset.pbind;
    if (inp !== document.activeElement) writeInput(inp, key === 'desktop' ? p.pageW > 0 : p[key]);
  });
  $$('#viewPanel [data-when]').forEach((n) => {
    if (n.dataset.when === 'skin') n.hidden = !skinFor(p.url);
    else if (n.dataset.when === 'kickbot') n.hidden = StreamWall.siteKeyFor(p.url) !== 'kickbot';
    else if (n.dataset.when === 'alt') n.hidden = !p.url2;
    else if (n.dataset.when === 'sahne') n.hidden = StreamWall.siteKeyFor(p.url) !== 'kickbot' || !p.sahne;
    else n.hidden = (n.dataset.when === 'desktop') !== p.pageW > 0;
  });
}

function onGlobalInput(inp) {
  const path = inp.dataset.bind;
  setPath(cfg, path, readInput(inp));
  writeInput(inp, getPath(cfg, path));
  if (path.startsWith('colors.') || /^background\.c\d$/.test(path)) cfg.theme = 'custom';
  applyAll();
  save();
}

function onPanelInput(inp) {
  const p = cfg.panels.find((q) => q.id === currentPanelId);
  if (!p) return;
  const key = inp.dataset.pbind;
  let value = readInput(inp);
  if (key === 'url') {
    value = normalizeUrl(value);
    if (inp.value.trim() && !value) toast('این آدرس معتبر نیست (فقط http/https).');
  }
  if (key === 'desktop') {
    p.pageW = value ? DESKTOP_WIDTH : 0;
    layoutPanel(p);
    syncPanelInputs();
    save();
    return;
  }
  p[key] = value;
  if (key === 'pageW') p.pageW = p.pageW > 0 ? clamp(p.pageW, 320, 3840) : DESKTOP_WIDTH;
  if (key === 'url2') p.url2 = normalizeUrl(p.url2);
  if (key === 'w') p.w = clamp(p.w, MIN_W, 100);
  if (key === 'h') p.h = clamp(p.h, MIN_H, 100);
  if (key === 'zoom') p.zoom = clamp(p.zoom, 25, 200);
  if (['x', 'y', 'w', 'h'].includes(key)) {
    p.x = clamp(p.x, 0, 100 - p.w);
    p.y = clamp(p.y, 0, 100 - p.h);
  }
  rangeUi(inp);
  if (key === 'url' || key === 'sandbox' || key === 'refresh' || key === 'cookieBridge') mountFrame(p);
  if (key === 'url' || key === 'sahne' || key === 'visible') syncSahneFeed();
  if (key === 'title' || key === 'url' || key === 'url2' || key === 'sahne') {
    renderPanelList();
    syncPanelInputs();
  }
  layoutPanel(p);
  save();
}

function renderPanelList() {
  const list = $('#panelList');
  list.textContent = '';
  cfg.panels.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'pl-row' + (p.visible ? '' : ' off');
    let host = '';
    try {
      host = p.url ? new URL(p.url).hostname.replace(/^www\./, '') : '';
    } catch {}
    row.innerHTML = `
      <span class="badge">${badgeHtml(p.url)}</span>
      <span class="pl-name"><b></b><small></small></span>
      <span class="pl-acts">
        <button type="button" class="icon-btn" data-a="up" title="بالاتر در فهرست"${i === 0 ? ' disabled' : ''}>${icon('up')}</button>
        <button type="button" class="icon-btn" data-a="down" title="پایین‌تر در فهرست"${i === cfg.panels.length - 1 ? ' disabled' : ''}>${icon('chevron')}</button>
        <button type="button" class="icon-btn" data-a="cfg" title="تنظیمات این پنل">${icon('sliders')}</button>
      </span>
      <input type="checkbox" class="switch" title="نمایش / پنهان"${p.visible ? ' checked' : ''}>`;
    $('.pl-name b', row).textContent = p.title;
    $('.pl-name small', row).textContent = host || 'بدون آدرس';
    const swap = (j) => {
      [cfg.panels[i], cfg.panels[j]] = [cfg.panels[j], cfg.panels[i]];
      renderPanelList();
      buildPresets();
      save();
    };
    row.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'up') swap(i - 1);
      if (a === 'down') swap(i + 1);
      if (a === 'cfg') openPanelSettings(p.id);
    });
    $('.switch', row).addEventListener('change', (e) => setPanelVisible(p, e.target.checked));
    list.append(row);
  });
}

function buildStyleGrid() {
  const grid = $('#styleGrid');
  grid.textContent = '';
  for (const [id, st] of Object.entries(StreamWall.STYLES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'style-card';
    b.dataset.style = id;
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML =
      `<span class="style-art" data-look="${id}" aria-hidden="true"><b class="sa-tag"></b><i class="sa-card"><b></b></i><i class="sa-card"><b></b></i></span>` +
      `<span class="style-name">${st.name}${icon('check')}</span><small>${st.hint}</small>`;
    b.addEventListener('click', () => setStyle(id));
    grid.append(b);
  }
}

function buildPresets() {
  const vis = cfg.panels.filter((p) => p.visible);
  const matches = (kind) =>
    vis.length > 0 &&
    presetLayout(kind, vis.length).every((r, i) => ['x', 'y', 'w', 'h'].every((k) => Math.abs(r[k] - vis[i][k]) < 0.6));
  $('#presetGrid').innerHTML = PRESETS.map(
    ([kind, label]) =>
      `<button type="button" data-preset="${kind}" class="${matches(kind) ? 'on' : ''}" aria-pressed="${matches(kind)}">${presetSvg(kind, vis.length)}<span>${label}</span></button>`,
  ).join('');
}

function showTab(name) {
  currentTab = name;
  $$('.tabs [data-tab]').forEach((b) => {
    b.classList.toggle('on', b.dataset.tab === name);
    b.setAttribute('aria-selected', String(b.dataset.tab === name));
    b.tabIndex = b.dataset.tab === name ? 0 : -1;
  });
  $$('[data-pane]').forEach((pane) => (pane.hidden = pane.dataset.pane !== name));
}

function buildStaticUi() {
  buildStyleGrid();
  const grid = $('#themeGrid');
  for (const [id, t] of Object.entries(THEMES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'theme';
    b.dataset.theme = id;
    b.style.setProperty('--t-accent', t.accent);
    b.style.setProperty('--t-panel', t.panel);
    b.innerHTML =
      `<span class="theme-art" style="background:radial-gradient(70% 55% at 15% 10%, ${t.bg[2]}, transparent 70%), linear-gradient(160deg, ${t.bg[0]}, ${t.bg[1]})"><i></i><i></i><i></i><i></i></span>` +
      `<span class="theme-name">${t.name}${icon('check')}</span>`;
    grid.append(b);
  }
  buildPresets();
  const sel = $('#fontSelect');
  for (const f of FONTS) sel.append(new Option(f.label, f.id));
}

function pickTheme(id) {
  const t = THEMES[id];
  if (!t) return;
  cfg.theme = id;
  Object.assign(cfg.colors, { accent: t.accent, border: t.border, panel: t.panel, text: t.text });
  Object.assign(cfg.background, { c1: t.bg[0], c2: t.bg[1], c3: t.bg[2] });
  applyAll();
  syncInputs();
  save();
}

function setDrawer(open) {
  const drawer = $('#drawer');
  const wasOpen = document.body.classList.contains('drawer-open');
  document.body.classList.toggle('drawer-open', open);
  drawer.setAttribute('aria-hidden', String(!open));
  drawer.inert = !open; // closed = not reachable with Tab either
  if (open && !wasOpen) {
    // focus moves in (so Tab/Esc work at once) without drawing a ring when opened with the mouse
    requestAnimationFrame(() => ($('#viewPanel').hidden ? $('.tabs button.on') : $('#btnBack'))?.focus({ preventScroll: true, focusVisible: false }));
  } else if (!open && wasOpen && drawer.contains(document.activeElement)) {
    $('#fab').focus({ preventScroll: true, focusVisible: false });
  }
}
function showView(name) {
  $('#viewMain').hidden = name !== 'main';
  $('#viewPanel').hidden = name !== 'panel';
}
function openPanelSettings(id) {
  currentPanelId = id;
  syncPanelInputs();
  showView('panel');
  setDrawer(true);
}

function setEditing(on) {
  editing = on;
  document.body.classList.toggle('editing', on);
  $('#editBar').hidden = !on;
  $('#btnEdit span').textContent = on ? 'پایان ویرایش' : 'ویرایش چیدمان';
  if (on) for (const p of cfg.panels) layoutPanel(p);
}

async function toggleFullscreen() {
  if (EXT && chrome.windows) {
    const win = await chrome.windows.getCurrent();
    await chrome.windows.update(win.id, { state: win.state === 'fullscreen' ? 'maximized' : 'fullscreen' });
  } else if (document.fullscreenElement) {
    await document.exitFullscreen();
  } else {
    await document.documentElement.requestFullscreen();
  }
}

let toastTimer = 0;
// action: optional { label, run } for a button in the toast.
function toast(message, ms = 4500, action = null) {
  const t = $('#toast');
  $('.t-msg', t).textContent = message;
  const btn = $('.t-act', t);
  btn.hidden = !action;
  btn.onclick = action
    ? () => {
        t.classList.remove('show');
        action.run();
      }
    : null;
  if (action) btn.textContent = action.label;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

// ---------- background image / backup ----------
function readAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function loadBackgroundFile(file) {
  // GIFs stay as they are (animation); large stills are shrunk so storage stays small.
  if (file.type === 'image/gif' || file.size < 1.5 * 1024 * 1024) return readAsDataUrl(file);
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/webp', 0.9);
}

function exportSettings() {
  const blob = new Blob([JSON.stringify({ app: 'stream-wall', cfg, bgImage }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'stream-wall-settings.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function importSettings(file) {
  const data = JSON.parse(await file.text());
  if (!isObj(data) || data.app !== 'stream-wall' || !isObj(data.cfg)) throw new Error('این فایل، خروجی پشت‌صحنه نیست.');
  cfg = normalizeConfig(data.cfg);
  bgImage = typeof data.bgImage === 'string' && data.bgImage.startsWith('data:image/') ? data.bgImage : '';
  await store.saveBg(bgImage);
  renderPanels();
  applyAll();
  syncInputs();
  save();
}

// ---------- events ----------
function bindEvents() {
  $('#fab').addEventListener('click', () => {
    const open = !document.body.classList.contains('drawer-open');
    if (open) showView('main');
    setDrawer(open);
  });
  $('.tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (tab) showTab(tab.dataset.tab);
  });
  // segmented controls: <span data-seg="path"><button data-value>…
  $('#drawer').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-seg] [data-value]');
    if (!btn) return;
    setPath(cfg, btn.closest('[data-seg]').dataset.seg, btn.dataset.value);
    applyAll();
    syncSegments();
    save();
  });
  // The settings button only shows while the mouse is moving, so the wall stays clean.
  let idleTimer = 0;
  const wake = () => {
    document.body.classList.add('pointer-active');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => document.body.classList.remove('pointer-active'), 2600);
  };
  window.addEventListener('pointermove', wake, { passive: true });
  window.addEventListener('keydown', wake);
  $('#btnClose').addEventListener('click', () => setDrawer(false));
  $('#btnBack').addEventListener('click', () => showView('main'));
  $('#btnSide').addEventListener('click', () => {
    cfg.drawerLeft = !cfg.drawerLeft;
    applyTheme();
    save();
  });
  $('#btnFull').addEventListener('click', () => toggleFullscreen().catch((err) => toast(err.message)));
  $('#btnEdit').addEventListener('click', () => setEditing(!editing));
  $('#btnEditDone').addEventListener('click', () => setEditing(false));

  $('#drawer').addEventListener('input', (e) => {
    const inp = e.target;
    if (inp.dataset.lazy !== undefined) return;
    if (inp.dataset.bind) onGlobalInput(inp);
    else if (inp.dataset.pbind) onPanelInput(inp);
  });
  $('#drawer').addEventListener('change', (e) => {
    const inp = e.target;
    if (inp.dataset.lazy === undefined) return;
    if (inp.dataset.bind) onGlobalInput(inp);
    else if (inp.dataset.pbind) {
      onPanelInput(inp);
      syncPanelInputs();
    }
  });

  $('#viewMain').addEventListener('click', (e) => {
    const preset = e.target.closest('[data-preset]');
    if (preset) applyPreset(preset.dataset.preset);
    const theme = e.target.closest('[data-theme]');
    if (theme) pickTheme(theme.dataset.theme);
  });
  $('#viewPanel').addEventListener('click', (e) => {
    const corner = e.target.closest('[data-corner]');
    const p = cfg.panels.find((q) => q.id === currentPanelId);
    if (corner && p) moveToCorner(p, corner.dataset.corner);
  });

  $('#btnAdd').addEventListener('click', () => {
    const p = normalizePanel({ id: uid(), title: 'پنل جدید', z: Math.max(0, ...cfg.panels.map((q) => q.z)) + 1 });
    cfg.panels.push(p);
    renderPanels();
    save();
    openPanelSettings(p.id);
  });
  $('#btnPick').addEventListener('click', () => {
    const p = cfg.panels.find((q) => q.id === currentPanelId);
    if (p) startPick(p);
  });
  $('#btnRegionReset').addEventListener('click', () => {
    const p = cfg.panels.find((q) => q.id === currentPanelId);
    if (p) clearRegion(p);
  });
  $('#btnPReload').addEventListener('click', () => {
    const p = cfg.panels.find((q) => q.id === currentPanelId);
    if (p) reloadPanel(p);
  });
  $('#btnPOpen').addEventListener('click', () => {
    const p = cfg.panels.find((q) => q.id === currentPanelId);
    if (p && p.url) window.open(p.url, '_blank', 'noopener');
  });
  $('#btnPDelete').addEventListener('click', () => {
    const p = cfg.panels.find((q) => q.id === currentPanelId);
    if (!p || !confirm(`پنل «${p.title}» حذف شود؟`)) return;
    cfg.panels = cfg.panels.filter((q) => q !== p);
    currentPanelId = null;
    renderPanels();
    showView('main');
    save();
  });

  $('#btnBgPick').addEventListener('click', () => $('#bgFile').click());
  $('#bgFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      bgImage = await loadBackgroundFile(file);
      await store.saveBg(bgImage);
      applyBackground();
    } catch (err) {
      toast('عکس ذخیره نشد: ' + err.message);
    }
  });
  $('#btnBgClear').addEventListener('click', async () => {
    bgImage = '';
    await store.saveBg('');
    applyBackground();
  });

  // «مرکز کنترل» on the top bar: the owner's local hub (Subathon Timer, localhost:7799) when it runs;
  // anywhere else it is Backstage's own settings, starting at the panels (chat, donations, …)
  $('#tbHub').addEventListener('click', (e) => {
    if (!$('#topBar').classList.contains('no-local')) return;
    e.preventDefault();
    setDrawer(true);
    showTab('layout');
  });
  $('#btnExport').addEventListener('click', exportSettings);
  $('#btnSoundTest').addEventListener('click', () => {
    Object.keys(CHIMES).forEach((key, i) => setTimeout(() => chime(key), i * 900));
  });
  $('#btnImport').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      await importSettings(file);
      toast('تنظیمات وارد شد.');
    } catch (err) {
      toast('وارد نشد: ' + err.message);
    }
  });
  $('#btnReset').addEventListener('click', async () => {
    if (!confirm('همهٔ تنظیمات و چیدمان به حالت اول برگردد؟')) return;
    cfg = defaultConfig();
    bgImage = '';
    currentPanelId = null;
    await store.saveBg('');
    renderPanels();
    applyAll();
    syncInputs();
    showView('main');
    save();
  });

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    if (editing) for (const p of cfg.panels) layoutPanel(p);
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(onScreenChange, 250);
  });
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const picking = cfg.panels.find((p) => views.get(p.id)?.picking);
    if (picking) endPick(picking);
    else if (editing) setEditing(false);
    else setDrawer(false);
  });

  if (EXT) {
    chrome.runtime.onMessage.addListener((msg, sender) => {
      if (!msg) return;
      if (msg.type === 'sw-activity') {
        if (sender.tab && sender.tab.id === myTabId) onActivity(msg.panelId, msg.sig, msg.kind);
        return;
      }
      if (msg.type === 'toggle-edit') setEditing(!editing);
      if (msg.type === 'toggle-settings') {
        const open = !document.body.classList.contains('drawer-open');
        if (open) showView('main');
        setDrawer(open);
      }
    });
  }
}

// ---------- self-update ----------
// Chrome reads this page's files from disk every time, but the manifest (permissions, content
// scripts, service worker) only when the extension is reloaded. If the files on disk are a
// different version than the one Chrome has loaded, reload the extension once; background.js
// then reopens the wall. The remembered target stops a reload loop if the reload didn't take.
async function selfUpdateIfFilesChanged() {
  if (!EXT) return false;
  try {
    const onDisk = await (await fetch(chrome.runtime.getURL('manifest.json'), { cache: 'no-store' })).json();
    if (onDisk.version === chrome.runtime.getManifest().version) {
      await chrome.storage.local.remove('selfReloadTarget');
      return false;
    }
    const { selfReloadTarget } = await chrome.storage.local.get('selfReloadTarget');
    if (selfReloadTarget === onDisk.version) {
      toast('فایل‌های اکستنشن به‌روز شده‌اند ولی ریلود خودکار نگرفت؛ در chrome://extensions دکمهٔ ↻ را بزن.', 15000);
      return false;
    }
    await chrome.storage.local.set({ selfReloadTarget: onDisk.version, reopenAfterReload: Date.now() });
    chrome.runtime.reload();
    return true;
  } catch {
    return false;
  }
}

// ---------- start ----------
async function init() {
  if (await selfUpdateIfFilesChanged()) return;
  await loadOwner();
  const saved = await store.load();
  const firstRun = !saved || !saved.cfg;
  cfg = normalizeConfig(saved && saved.cfg);
  bgImage = (saved && saved.bgImage) || '';
  currentOrientation = orientation();
  detectKick();
  if (EXT) chrome.storage.onChanged.addListener((ch, area) => area === 'local' && ch.sahneInfo && detectKick());

  try {
    await installFrameRules(); // must be in place before any iframe starts loading
  } catch (err) {
    toast('قانون نمایش داخل قاب ثبت نشد: ' + err.message, 9000);
  }
  initCookieBridge();
  await publishSkins();

  hydrateIcons();
  setDrawer(false);
  buildStaticUi();
  renderPanels();
  applyAll();
  syncInputs();
  bindEvents();
  showTab('layout');
  $('#verLabel').textContent = EXT ? 'نسخهٔ ' + chrome.runtime.getManifest().version : 'پیش‌نمایش';
  // Panels fade in one after another; afterwards transitions run without the stagger delay.
  requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove('booting')));
  setTimeout(() => document.body.classList.add('ready'), 1400);

  if (firstRun) {
    save();
    toast('خوش آمدی! لبهٔ هر پنل را بکش تا اندازه‌اش عوض شود، برچسب نامش را بکش تا جابه‌جا شود. تنظیمات: چرخ‌دندهٔ گوشهٔ پایین (با تکان دادن ماوس پیدا می‌شود) یا Alt+Shift+S.', 11000);
  } else if (stylesAdded) {
    save();
    toast('تازه: سه سبک ظاهری جدید (شیشه‌ای، مینیمال، پررنگ) در تنظیمات ← ظاهر. پشت‌صحنه حالا با هر اندازه و هر جهت مانیتور جور می‌شود و برای صفحهٔ افقی و عمودی چیدمان جدا نگه می‌دارد.', 15000);
  } else if (altAdded) {
    save();
    toast('تازه: روی برچسب پنل چت یک کلید «تکی | دوتایی» هست؛ با یک کلیک بین چت خودت و چت دوتایی جابه‌جا شو. هر پنلی می‌تواند «آدرس دوم» داشته باشد (تنظیمات پنل).', 15000);
  } else if (sahneAdded) {
    save();
    toast('تازه: ساب و ساب گیفت‌ها از «صحنه پلاس» حالا در پنل درآمد تیپ، به ترتیب زمان بین تیپ‌ها، هرکدام با صدای خودش. صحنه پلاس باید باز باشد.', 15000);
  } else if (soundAdded) {
    save();
    toast('تازه: دونیت، تیپ و ریوارد جدید حالا صدا هم دارند (هرکدام صدای خودش). صدا و بلندی: تنظیمات ← بیشتر. ریواردهای کیک هم حالا جدیدترین بالا، همه در یک صفحه.', 15000);
  } else if (donofaMoved) {
    save();
    toast('پنل دونیت‌ها به donofa.ir رفت (donofa.com از ایران نصفه لود می‌شد). اگر صفحهٔ ورود آمد، یک بار همان‌جا لاگین کن.', 15000);
  } else if (upgradedFrom) {
    save();
    toast(
      upgradedFrom < 2
        ? 'تازه: لبهٔ هر پنل را مستقیم بکش تا بلندتر/کوتاه‌تر شود؛ سربرگ را بکش تا جابه‌جا شود؛ − و + روی سربرگ برای ریز/درشت کردن محتوا. اتصال لاگین هم برای Kick و Donofa روشن شد.'
        : upgradedFrom < 3
          ? 'تازه: «اتصال لاگین» برای پنل‌های Kick و Donofa روشن شد تا دیتایشان بیاید. برای هر پنل از تنظیماتش خاموش/روشن می‌شود.'
          : upgradedFrom < 4
            ? 'تازه: پنل‌های Donofa و KickBot «ظاهر شبیه چت» گرفتند (اسم بالا، مشخصات در کارت، فونت و رنگ تم).'
            : 'پشت‌صحنه نو شد: برچسب نام مثل چت، ابزارها با رفتن ماوس روی پنل، و درخشیدن پنل وقتی دونیت یا تیپ تازه برسد.',
      12000,
    );
  }
  if (!EXT && new URLSearchParams(location.search).has('demo')) {
    import('../dev-tools/demo.js').catch((err) => toast('demo: ' + err.message));
  } else if (!EXT) {
    toast('حالت پیش‌نمایش: بیرون از اکستنشن، سایت‌های لاگین‌دار داخل قاب باز نمی‌شوند.', 7000);
  }
  // Pick up new files on disk while the wall stays open, not only when it is reopened.
  if (EXT) setInterval(selfUpdateIfFilesChanged, 30000);
}

init();
