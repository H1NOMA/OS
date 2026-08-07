/* ============================================================
   hinomaOS · kernel — ядро системы
   Глобальный namespace `OS`: события, настройки, реестр
   приложений, диалоги, темы, иконки, утилиты.
   ============================================================ */
(function () {
  'use strict';

  const VERSION = '1.0';
  const CODENAME = 'Nova';

  /* ---------- шина событий ---------- */
  const listeners = new Map();
  function on(evt, cb) {
    if (!listeners.has(evt)) listeners.set(evt, new Set());
    listeners.get(evt).add(cb);
    return () => off(evt, cb);
  }
  function off(evt, cb) { listeners.get(evt)?.delete(cb); }
  function emit(evt, data) {
    listeners.get(evt)?.forEach(cb => { try { cb(data); } catch (e) { console.error(`[OS] обработчик ${evt}:`, e); } });
  }

  /* ---------- утилиты ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  function el(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let uidCounter = 0;
  const uid = (p) => `${p || 'id'}-${Date.now().toString(36)}-${(++uidCounter).toString(36)}`;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function fmtBytes(n) {
    if (n == null) return '—';
    if (n < 1024) return n + ' Б';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' КБ';
    return (n / 1024 / 1024).toFixed(2) + ' МБ';
  }
  const MONTHS_RU = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  function fmtDate(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    const time = d.toTimeString().slice(0, 5);
    if (sameDay) return `сегодня, ${time}`;
    return `${d.getDate()} ${MONTHS_RU[d.getMonth()]} ${d.getFullYear()}, ${time}`;
  }
  function debounce(fn, ms) {
    let t;
    return function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
  }

  /* ---------- инъекция стилей ---------- */
  function injectStyle(id, css) {
    let s = document.getElementById('style-' + id);
    if (!s) {
      s = document.createElement('style');
      s.id = 'style-' + id;
      document.head.appendChild(s);
    }
    s.textContent = css;
  }

  /* ---------- настройки ---------- */
  const SETTINGS_KEY = 'hinoma.settings.v1';
  const DEFAULT_SETTINGS = {
    userName: 'h1noma',
    theme: 'dark',              // 'light' | 'dark' | 'auto'
    accent: '#23D1A8',          // «Мята» — фирменный акцент
    wallpaper: 'nebula',        // id из OS.wallpapers либо data:-URI
    dockSize: 56,
    dockMagnify: true,
    nightLight: false,
    brightness: 1,              // 0.4 … 1
    volume: 70,
    wifi: true,
    bluetooth: true,
    dnd: false,                 // не беспокоить
    dockPinned: ['finder', 'browser', 'textedit', 'terminal', 'calculator', 'paint', 'photos', 'minesweeper', 'taskmgr', 'settings'],
    desktopIconPos: {},         // имя -> {x, y}
    firstRun: true,
  };
  let settings = { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) { console.warn('[OS] настройки повреждены, сброс', e); }

  // миграция со старой айдентики (v1.0)
  const WALLPAPER_IDS = ['nebula', 'mint', 'dune', 'aurora', 'abyss', 'ember', 'dawn', 'fern'];
  if (settings.accent === '#0A84FF') settings.accent = DEFAULT_SETTINGS.accent;
  if (!String(settings.wallpaper).startsWith('data:') && !WALLPAPER_IDS.includes(settings.wallpaper)) {
    settings.wallpaper = DEFAULT_SETTINGS.wallpaper;
  }

  const saveSettings = debounce(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { console.warn('[OS] не удалось сохранить настройки', e); }
  }, 150);

  const Settings = {
    get: (k, d) => (settings[k] !== undefined ? settings[k] : d),
    set(k, v) {
      settings[k] = v;
      saveSettings();
      emit('settings:change', { key: k, value: v });
      applySettingKey(k, v);
    },
    all: () => ({ ...settings }),
    reset() {
      localStorage.removeItem(SETTINGS_KEY);
      localStorage.removeItem('hinoma.vfs.v1');
      localStorage.removeItem('hinoma.notifications.v1');
      location.reload();
    },
  };

  /* ---------- применение темы / внешнего вида ---------- */
  function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [35, 209, 168];
  }
  const rgbToHex = (r, g, b) => '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  // сдвиг тона: из одного акцента рождается парный цвет для фирменного градиента
  function rotateHue(rgb, deg) {
    let [r, g, b] = rgb.map(v => v / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s;
    const l = (max + min) / 2;
    if (max === min) { h = 0; s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    h = (h + deg / 360 + 1) % 1;
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    let r2, g2, b2;
    if (s === 0) { r2 = g2 = b2 = l; }
    else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r2 = hue2rgb(p, q, h + 1 / 3); g2 = hue2rgb(p, q, h); b2 = hue2rgb(p, q, h - 1 / 3);
    }
    return [r2 * 255, g2 * 255, b2 * 255];
  }
  function applyTheme() {
    const t = settings.theme === 'auto'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : settings.theme;
    document.documentElement.setAttribute('data-theme', t);
    emit('theme:applied', t);
  }
  function applyAccent() {
    const rgb = hexToRgb(settings.accent);
    const [r, g, b] = rgb;
    const accent2 = rgbToHex(...rotateHue(rgb, 52));
    // на светлом акценте — тёмный текст, на тёмном — белый
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const on = lum > 0.56 ? '#0f1417' : '#ffffff';
    const st = document.documentElement.style;
    st.setProperty('--accent', settings.accent);
    st.setProperty('--accent-2', accent2);
    st.setProperty('--accent-soft', `rgba(${r}, ${g}, ${b}, .20)`);
    st.setProperty('--on-accent', on);
  }
  function applyBrightness() {
    const o = $('#brightness-overlay');
    if (o) o.style.opacity = String((1 - clamp(settings.brightness, 0.4, 1)) * 0.75);
  }
  function applyNightLight() {
    const o = $('#nightlight-overlay');
    if (o) o.style.opacity = settings.nightLight ? '1' : '0';
  }
  function applyDockVars() {
    document.documentElement.style.setProperty('--dock-icon', settings.dockSize + 'px');
  }
  function applySettingKey(k) {
    if (k === 'theme') applyTheme();
    else if (k === 'accent') applyAccent();
    else if (k === 'brightness') applyBrightness();
    else if (k === 'nightLight') applyNightLight();
    else if (k === 'dockSize') applyDockVars();
  }
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (settings.theme === 'auto') applyTheme();
  });

  /* ---------- реестр приложений ---------- */
  const apps = new Map();
  function registerApp(def) {
    if (!def || !def.id || typeof def.render !== 'function') {
      console.error('[OS] некорректная регистрация приложения', def);
      return;
    }
    apps.set(def.id, def);
    emit('apps:registered', def);
  }
  const getApp = (id) => apps.get(id);
  const allApps = () => Array.from(apps.values());

  function launch(appId, args) {
    const app = apps.get(appId);
    if (!app) {
      notify({ title: 'Система', body: `Приложение «${appId}» не установлено`, appId: 'system' });
      return null;
    }
    if (app.singleton) {
      const existing = OS.wm.windowsOf(appId)[0];
      if (existing) {
        existing.restore();
        existing.focus();
        if (args && app.onReopen) { try { app.onReopen(existing, args); } catch (e) { console.error(e); } }
        return existing;
      }
    }
    emit('app:launching', { appId });
    const win = OS.wm.createWindow(app, args || {});
    emit('app:launched', { appId, win });
    return win;
  }

  /* ---------- ассоциации файлов ---------- */
  const FILE_ASSOC = [
    { exts: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'], app: 'photos' },
    { exts: ['txt', 'md', 'json', 'js', 'css', 'html', 'csv', 'log', 'xml', 'sh'], app: 'textedit' },
  ];
  function appForFile(name) {
    const ext = (name.split('.').pop() || '').toLowerCase();
    for (const a of FILE_ASSOC) if (a.exts.includes(ext)) return a.app;
    return 'textedit';
  }
  function openFile(path) {
    const node = OS.vfs.stat(path);
    if (!node) return notify({ title: 'Файлы', body: 'Файл не найден: ' + path, appId: 'finder' });
    if (node.type === 'dir') return launch('finder', { path });
    launch(appForFile(node.name), { path });
  }

  /* ---------- уведомления ---------- */
  const NOTIF_KEY = 'hinoma.notifications.v1';
  let notifHistory = [];
  try { notifHistory = JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]'); } catch (e) { /* пусто */ }
  function saveNotifs() {
    try { localStorage.setItem(NOTIF_KEY, JSON.stringify(notifHistory.slice(0, 40))); } catch (e) { /* квота */ }
  }
  function notify(opts) {
    const n = {
      id: uid('ntf'),
      title: opts.title || 'Уведомление',
      body: opts.body || '',
      appId: opts.appId || 'system',
      ts: Date.now(),
    };
    notifHistory.unshift(n);
    notifHistory = notifHistory.slice(0, 40);
    saveNotifs();
    emit('os:notify', n);
    return n;
  }
  function clearNotifications() {
    notifHistory = [];
    saveNotifs();
    emit('os:notify-cleared');
  }

  /* ---------- иконки ---------- */
  // Фирменная плитка приложения hinomaOS — скруглённый шестиугольник
  // (перекликается с гексагоном-логотипом), диагональный градиент + глиф.
  function roundedHexPath(cornerR) {
    const V = [[98, 50], [74, 95], [26, 95], [2, 50], [26, 5], [74, 5]];
    const segs = V.map((C, i) => {
      const P = V[(i + 5) % 6], N = V[(i + 1) % 6];
      const d1 = [C[0] - P[0], C[1] - P[1]], l1 = Math.hypot(d1[0], d1[1]);
      const d2 = [N[0] - C[0], N[1] - C[1]], l2 = Math.hypot(d2[0], d2[1]);
      return {
        a: [C[0] - d1[0] / l1 * cornerR, C[1] - d1[1] / l1 * cornerR],
        C,
        b: [C[0] + d2[0] / l2 * cornerR, C[1] + d2[1] / l2 * cornerR],
      };
    });
    let d = `M ${segs[0].a[0].toFixed(1)} ${segs[0].a[1].toFixed(1)} `;
    for (let i = 0; i < 6; i++) {
      const cur = segs[i], nxt = segs[(i + 1) % 6];
      d += `Q ${cur.C[0]} ${cur.C[1]} ${cur.b[0].toFixed(1)} ${cur.b[1].toFixed(1)} L ${nxt.a[0].toFixed(1)} ${nxt.a[1].toFixed(1)} `;
    }
    return d + 'Z';
  }
  const HEX_TILE = roundedHexPath(15);

  function appTile(bg, glyphSvg, opts) {
    const o = opts || {};
    const gid = uid('g');
    return `<svg class="app-tile" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>${bg.defs ? bg.defs(gid) : `<linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${bg.from}"/><stop offset="1" stop-color="${bg.to}"/>
      </linearGradient>`}<clipPath id="${gid}c"><path d="${HEX_TILE}"/></clipPath></defs>
      <path d="${HEX_TILE}" fill="url(#${gid})"/>
      ${o.noGloss ? '' : `<g clip-path="url(#${gid}c)"><ellipse cx="30" cy="0" rx="70" ry="36" fill="rgba(255,255,255,.14)"/></g>`}
      <path d="${HEX_TILE}" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="1.6"/>
      <g transform="translate(50 50) scale(.86)">${glyphSvg}</g>
    </svg>`;
  }

  // Глифы (рисуются в системе координат с центром 0,0; холст 100×100)
  const stroke = (d, w) => `<path d="${d}" fill="none" stroke="#fff" stroke-width="${w || 6}" stroke-linecap="round" stroke-linejoin="round"/>`;

  const ICONS = {
    logo: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M 50 6 L 88 28 L 88 72 L 50 94 L 12 72 L 12 28 Z" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round"/><path d="M 36 68 L 36 32 M 64 68 L 64 32 M 36 50 L 64 50" stroke="currentColor" stroke-width="7" stroke-linecap="round" fill="none"/></svg>`,
    folder: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="fldA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2FC9A8"/><stop offset="1" stop-color="#0F9487"/></linearGradient><linearGradient id="fldB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5FE3C0"/><stop offset="1" stop-color="#1FB3A0"/></linearGradient></defs><path d="M 8 24 C 8 20 11 17 15 17 L 36 17 C 39 17 41 18 43 20 L 48 25 L 85 25 C 89 25 92 28 92 32 L 92 78 C 92 82 89 85 85 85 L 15 85 C 11 85 8 82 8 78 Z" fill="url(#fldA)"/><path d="M 8 36 C 8 32 11 29 15 29 L 85 29 C 89 29 92 32 92 36 L 92 78 C 92 82 89 85 85 85 L 15 85 C 11 85 8 82 8 78 Z" fill="url(#fldB)"/></svg>`,
    trashEmpty: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="trA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E8E8EE"/><stop offset="1" stop-color="#B9B9C4"/></linearGradient></defs><path d="M 30 30 L 34 88 C 34 91 37 93 40 93 L 60 93 C 63 93 66 91 66 88 L 70 30 Z" fill="url(#trA)"/><path d="M 30 30 L 34 88 C 34 91 37 93 40 93 L 60 93 C 63 93 66 91 66 88 L 70 30 Z" fill="none" stroke="rgba(0,0,0,.18)" stroke-width="1.5"/><rect x="24" y="22" width="52" height="8" rx="4" fill="#CFCFD8"/><path d="M 42 22 C 42 16 46 13 50 13 C 54 13 58 16 58 22" fill="none" stroke="#CFCFD8" stroke-width="6" stroke-linecap="round"/><path d="M 42 38 L 44 84 M 50 38 L 50 84 M 58 38 L 56 84" stroke="rgba(0,0,0,.15)" stroke-width="2.5" stroke-linecap="round" fill="none"/></svg>`,
    trashFull: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="trB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E8E8EE"/><stop offset="1" stop-color="#B9B9C4"/></linearGradient></defs><path d="M 32 20 L 42 8 L 52 16 L 62 6 L 68 18 L 56 24 L 44 22 Z" fill="#fff" opacity=".92"/><path d="M 30 30 L 34 88 C 34 91 37 93 40 93 L 60 93 C 63 93 66 91 66 88 L 70 30 Z" fill="url(#trB)"/><path d="M 30 30 L 34 88 C 34 91 37 93 40 93 L 60 93 C 63 93 66 91 66 88 L 70 30 Z" fill="none" stroke="rgba(0,0,0,.18)" stroke-width="1.5"/><rect x="24" y="22" width="52" height="8" rx="4" fill="#CFCFD8"/><path d="M 42 38 L 44 84 M 50 38 L 50 84 M 58 38 L 56 84" stroke="rgba(0,0,0,.15)" stroke-width="2.5" stroke-linecap="round" fill="none"/></svg>`,
    fileGeneric: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="fgA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E3E3EA"/></linearGradient></defs><path d="M 22 10 C 22 7 24 5 27 5 L 62 5 L 78 21 L 78 90 C 78 93 76 95 73 95 L 27 95 C 24 95 22 93 22 90 Z" fill="url(#fgA)" stroke="rgba(0,0,0,.14)" stroke-width="1.5"/><path d="M 62 5 L 62 18 C 62 20 63 21 65 21 L 78 21 Z" fill="#C9C9D4"/></svg>`,
    fileText: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="ftA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E3E3EA"/></linearGradient></defs><path d="M 22 10 C 22 7 24 5 27 5 L 62 5 L 78 21 L 78 90 C 78 93 76 95 73 95 L 27 95 C 24 95 22 93 22 90 Z" fill="url(#ftA)" stroke="rgba(0,0,0,.14)" stroke-width="1.5"/><path d="M 62 5 L 62 18 C 62 20 63 21 65 21 L 78 21 Z" fill="#C9C9D4"/><path d="M 32 38 L 68 38 M 32 50 L 68 50 M 32 62 L 68 62 M 32 74 L 54 74" stroke="#8E8E99" stroke-width="4" stroke-linecap="round"/></svg>`,
    fileImage: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="fiA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E3E3EA"/></linearGradient><linearGradient id="fiB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9C86FF"/><stop offset="1" stop-color="#6C56E8"/></linearGradient></defs><path d="M 22 10 C 22 7 24 5 27 5 L 62 5 L 78 21 L 78 90 C 78 93 76 95 73 95 L 27 95 C 24 95 22 93 22 90 Z" fill="url(#fiA)" stroke="rgba(0,0,0,.14)" stroke-width="1.5"/><path d="M 62 5 L 62 18 C 62 20 63 21 65 21 L 78 21 Z" fill="#C9C9D4"/><rect x="30" y="36" width="40" height="34" rx="4" fill="url(#fiB)"/><circle cx="41" cy="47" r="4.5" fill="#FFB454"/><path d="M 30 62 L 44 52 L 54 60 L 62 54 L 70 61 L 70 66 C 70 68 68 70 66 70 L 34 70 C 32 70 30 68 30 66 Z" fill="#23D1A8"/></svg>`,
    search: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="44" cy="44" r="26" fill="none" stroke="currentColor" stroke-width="9"/><path d="M 64 64 L 84 84" stroke="currentColor" stroke-width="10" stroke-linecap="round"/></svg>`,
    power: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M 50 12 L 50 48" stroke="currentColor" stroke-width="9" stroke-linecap="round"/><path d="M 30 26 A 32 32 0 1 0 70 26" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round"/></svg>`,
    wifi: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M 14 40 C 34 22 66 22 86 40" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round"/><path d="M 27 56 C 40 45 60 45 73 56" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round"/><path d="M 40 71 C 46 66 54 66 60 71" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round"/><circle cx="50" cy="84" r="7" fill="currentColor"/></svg>`,
    bluetooth: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M 30 32 L 68 66 L 50 82 L 50 18 L 68 34 L 30 68" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    battery: `<svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="10" width="78" height="40" rx="10" fill="none" stroke="currentColor" stroke-width="6" opacity=".5"/><rect x="10" y="16" width="58" height="28" rx="6" fill="currentColor"/><path d="M 88 22 C 93 24 93 36 88 38" stroke="currentColor" stroke-width="5" fill="none" stroke-linecap="round" opacity=".5"/></svg>`,
    cc: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="16" width="80" height="28" rx="14" fill="none" stroke="currentColor" stroke-width="7"/><circle cx="30" cy="30" r="9" fill="currentColor"/><rect x="10" y="56" width="80" height="28" rx="14" fill="none" stroke="currentColor" stroke-width="7"/><circle cx="70" cy="70" r="9" fill="currentColor"/></svg>`,
    moon: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M 62 12 A 40 40 0 1 0 88 62 A 34 34 0 0 1 62 12 Z" fill="currentColor"/></svg>`,
    sun: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="19" fill="currentColor"/><g stroke="currentColor" stroke-width="7" stroke-linecap="round"><path d="M 50 8 L 50 20"/><path d="M 50 80 L 50 92"/><path d="M 8 50 L 20 50"/><path d="M 80 50 L 92 50"/><path d="M 20 20 L 28 28"/><path d="M 72 72 L 80 80"/><path d="M 80 20 L 72 28"/><path d="M 28 72 L 20 80"/></g></svg>`,
    grid: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="currentColor"><rect x="14" y="14" width="20" height="20" rx="5"/><rect x="40" y="14" width="20" height="20" rx="5"/><rect x="66" y="14" width="20" height="20" rx="5"/><rect x="14" y="40" width="20" height="20" rx="5"/><rect x="40" y="40" width="20" height="20" rx="5"/><rect x="66" y="40" width="20" height="20" rx="5"/><rect x="14" y="66" width="20" height="20" rx="5"/><rect x="40" y="66" width="20" height="20" rx="5"/><rect x="66" y="66" width="20" height="20" rx="5"/></g></svg>`,
    mission: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="currentColor" stroke-width="7"><rect x="10" y="16" width="44" height="30" rx="6"/><rect x="62" y="22" width="28" height="20" rx="5"/><rect x="16" y="56" width="30" height="24" rx="5"/><rect x="54" y="52" width="36" height="30" rx="6"/></g></svg>`,
    chevronL: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M 62 20 L 34 50 L 62 80" fill="none" stroke="currentColor" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    chevronR: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M 38 20 L 66 50 L 38 80" fill="none" stroke="currentColor" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    warn: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="wrA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD54D"/><stop offset="1" stop-color="#FFAC33"/></linearGradient></defs><path d="M 44 14 C 47 9 53 9 56 14 L 92 78 C 95 83 92 89 86 89 L 14 89 C 8 89 5 83 8 78 Z" fill="url(#wrA)"/><path d="M 50 36 L 50 62" stroke="#7A4A00" stroke-width="8" stroke-linecap="round"/><circle cx="50" cy="75" r="5" fill="#7A4A00"/></svg>`,
  };

  function fileIcon(node) {
    if (!node) return ICONS.fileGeneric;
    if (node.type === 'dir') return ICONS.folder;
    const ext = (node.name.split('.').pop() || '').toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) return ICONS.fileImage;
    if (['txt', 'md', 'json', 'js', 'css', 'html', 'csv', 'log', 'xml', 'sh'].includes(ext)) return ICONS.fileText;
    return ICONS.fileGeneric;
  }

  /* ---------- диалоги ---------- */
  function dialogBase(opts) {
    return new Promise((resolve) => {
      const layer = el('div');
      layer.id = 'dialog-layer';
      const dlg = el('div', 'dialog');
      dlg.innerHTML = `
        <div class="dlg-icon">${opts.icon || ICONS.warn}</div>
        <div class="dlg-title">${esc(opts.title || '')}</div>
        <div class="dlg-msg">${esc(opts.message || '')}</div>
        ${opts.input !== undefined ? `<input type="text" spellcheck="false">` : ''}
        <div class="dlg-btns"></div>`;
      const btns = $('.dlg-btns', dlg);
      const input = $('input', dlg);
      if (input) input.value = opts.input || '';
      const finish = (val) => {
        layer.remove();
        document.removeEventListener('keydown', onKey, true);
        resolve(val);
      };
      (opts.buttons || [{ label: 'OK', primary: true, value: true }]).forEach(b => {
        const btn = el('button', 'ui-btn' + (b.primary ? ' primary' : '') + (b.danger ? ' danger' : ''), esc(b.label));
        btn.addEventListener('click', () => finish(input && b.value === true ? input.value : b.value));
        btns.appendChild(btn);
      });
      const onKey = (e) => {
        if (e.key === 'Escape') { e.stopPropagation(); finish(opts.escValue !== undefined ? opts.escValue : null); }
        if (e.key === 'Enter') {
          e.stopPropagation();
          const ok = (opts.buttons || []).find(b => b.primary);
          finish(input && ok && ok.value === true ? input.value : (ok ? ok.value : true));
        }
      };
      document.addEventListener('keydown', onKey, true);
      layer.appendChild(dlg);
      document.body.appendChild(layer);
      if (input) { input.focus(); input.select(); }
    });
  }
  const dialog = {
    alert: (title, message, icon) => dialogBase({ title, message, icon, buttons: [{ label: 'OK', primary: true, value: true }] }),
    confirm: (title, message, opts) => dialogBase({
      title, message, icon: opts?.icon,
      escValue: false,
      buttons: [
        { label: opts?.cancelLabel || 'Отмена', value: false },
        { label: opts?.okLabel || 'OK', primary: !opts?.danger, danger: opts?.danger, value: true },
      ],
    }),
    prompt: (title, message, initial) => dialogBase({
      title, message, input: initial || '',
      buttons: [
        { label: 'Отмена', value: null },
        { label: 'OK', primary: true, value: true },
      ],
    }),
  };

  /* ---------- звук (WebAudio, без внешних файлов) ---------- */
  let audioCtx = null;
  function beep(freq, dur, vol) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sine';
      o.frequency.value = freq || 660;
      const v = (vol !== undefined ? vol : (settings.volume / 100)) * 0.12;
      g.gain.setValueAtTime(v, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + (dur || 0.15));
      o.connect(g).connect(audioCtx.destination);
      o.start();
      o.stop(audioCtx.currentTime + (dur || 0.15));
    } catch (e) { /* без звука */ }
  }

  /* ---------- экспорт ---------- */
  window.OS = {
    VERSION, CODENAME,
    on, off, emit,
    $, $$, el, clamp, uid, esc, fmtBytes, fmtDate, debounce,
    injectStyle,
    settings: Settings,
    registerApp, getApp, allApps, launch,
    openFile, appForFile,
    notify, clearNotifications,
    getNotifications: () => notifHistory.slice(),
    dialog,
    icons: ICONS, appTile, stroke, fileIcon,
    beep,
    // заполняются другими модулями ядра:
    wm: null, vfs: null, wallpapers: null,
    _applyAll() { applyTheme(); applyAccent(); applyBrightness(); applyNightLight(); applyDockVars(); },
  };
})();
