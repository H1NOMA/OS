/* ============================================================
   Hiko OS · overlays — поиск, экран приложений, быстрые настройки,
   уведомления (тосты + центр), календарь
   ============================================================ */
(function () {
  'use strict';
  const { el, esc } = OS;

  // плавное закрытие панели: класс -> удаление
  function animateOut(node, done) {
    if (!node) { if (done) done(); return; }
    node.classList.add('panel-out');
    setTimeout(() => { node.remove(); if (done) done(); }, 170);
  }

  /* ==================== SPOTLIGHT ==================== */

  let spotEl = null;
  let spotItems = [];
  let spotIdx = 0;

  function spotlightToggle() {
    if (spotEl) { spotlightClose(); return; }
    closeAllPanels();
    spotEl = el('div');
    spotEl.id = 'spotlight';
    spotEl.innerHTML = `
      <div class="spot-row">${OS.icons.search}<input type="text" placeholder="Поиск приложений и файлов…" spellcheck="false"></div>
      <div class="spot-results hidden"></div>`;
    document.body.appendChild(spotEl);
    const input = spotEl.querySelector('input');
    input.focus();
    input.addEventListener('input', () => spotSearch(input.value));
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') spotlightClose();
      else if (e.key === 'ArrowDown') { e.preventDefault(); spotMove(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); spotMove(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); spotRun(); }
    });
    document.addEventListener('pointerdown', spotOutside, true);
  }
  function spotOutside(e) { if (spotEl && !spotEl.contains(e.target)) spotlightClose(); }
  function spotlightClose() {
    animateOut(spotEl);
    spotEl = null;
    spotItems = [];
    document.removeEventListener('pointerdown', spotOutside, true);
  }

  function spotSearch(q) {
    const box = spotEl.querySelector('.spot-results');
    q = q.trim().toLowerCase();
    if (!q) { box.classList.add('hidden'); box.innerHTML = ''; spotItems = []; return; }

    // живой калькулятор: «2+2*3» считается прямо в поиске
    const calcItems = [];
    const expr = q.replace(/,/g, '.').replace(/[×х]/g, '*').replace(/[÷:]/g, '/').replace(/\s+/g, '');
    if (/^[\d+\-*/().%]+$/.test(expr) && /\d/.test(expr) && /[+\-*/]/.test(expr.slice(1))) {
      try {
        const val = Function('"use strict";return (' + expr + ')')();
        if (typeof val === 'number' && isFinite(val)) {
          const pretty = String(+val.toPrecision(12)).replace('.', ',');
          calcItems.push({
            kind: 'calc', label: `= ${pretty}`, sub: 'Enter — скопировать результат',
            icon: `<div style="color:var(--accent)">${OS.icons.logo}</div>`,
            run: () => {
              try { navigator.clipboard.writeText(pretty); } catch (e) { /* — */ }
              OS.notify({ title: 'Калькулятор', body: `${q} = ${pretty} · скопировано`, appId: 'calculator' });
            },
          });
        }
      } catch (e) { /* не выражение — молчим */ }
    }

    const apps = OS.allApps()
      .filter(a => a.name.toLowerCase().includes(q) || a.id.includes(q))
      .sort((a, b) => Number(b.name.toLowerCase().startsWith(q)) - Number(a.name.toLowerCase().startsWith(q)))
      .slice(0, 5)
      .map(a => ({ kind: 'app', label: a.name, sub: 'Приложение', icon: a.icon || OS.icons.fileGeneric, run: () => OS.launch(a.id) }));

    const files = OS.vfs.search(q, 8).filter(f => !f.path.startsWith('/Trash'))
      .map(f => ({ kind: 'file', label: f.name, sub: f.path, icon: OS.fileIcon(f), run: () => OS.openFile(f.path) }));

    const actions = [];
    if ('выключить'.includes(q) || 'shutdown'.includes(q)) actions.push({ kind: 'act', label: 'Выключить', sub: 'Действие', icon: `<div style="color:var(--accent)">${OS.icons.power}</div>`, run: () => OS.emit('session:shutdown') });
    if ('заблокировать'.includes(q) || 'lock'.includes(q)) actions.push({ kind: 'act', label: 'Заблокировать экран', sub: 'Действие', icon: `<div style="color:var(--accent)">${OS.icons.moon}</div>`, run: () => OS.emit('session:lock') });

    spotItems = [...calcItems, ...apps, ...files, ...actions];
    spotIdx = 0;
    if (!spotItems.length) {
      box.innerHTML = `<div class="spot-cat">Ничего не найдено</div>`;
      box.classList.remove('hidden');
      return;
    }
    let html = '';
    let lastKind = null;
    spotItems.forEach((it, i) => {
      if (it.kind !== lastKind) {
        html += `<div class="spot-cat">${it.kind === 'calc' ? 'Калькулятор' : it.kind === 'app' ? 'Приложения' : it.kind === 'file' ? 'Файлы' : 'Действия'}</div>`;
        lastKind = it.kind;
      }
      html += `<div class="spot-item ${i === spotIdx ? 'active' : ''}" data-i="${i}">
        <div class="sp-icon">${it.icon}</div>
        <div><div class="sp-name">${esc(it.label)}</div><div class="sp-sub">${esc(it.sub)}</div></div>
      </div>`;
    });
    box.innerHTML = html;
    box.classList.remove('hidden');
    box.querySelectorAll('.spot-item').forEach(n => {
      n.addEventListener('click', () => { spotIdx = +n.dataset.i; spotRun(); });
      n.addEventListener('mousemove', () => {
        if (spotIdx !== +n.dataset.i) {
          spotIdx = +n.dataset.i;
          box.querySelectorAll('.spot-item').forEach(m => m.classList.toggle('active', +m.dataset.i === spotIdx));
        }
      });
    });
  }
  function spotMove(d) {
    if (!spotItems.length) return;
    spotIdx = (spotIdx + d + spotItems.length) % spotItems.length;
    spotEl.querySelectorAll('.spot-item').forEach(m => m.classList.toggle('active', +m.dataset.i === spotIdx));
    const act = spotEl.querySelector('.spot-item.active');
    if (act) act.scrollIntoView({ block: 'nearest' });
  }
  function spotRun() {
    const it = spotItems[spotIdx];
    if (!it) return;
    spotlightClose();
    it.run();
  }

  /* ==================== LAUNCHPAD ==================== */

  let lpEl = null;
  function launchpadToggle() {
    if (lpEl) { launchpadClose(); return; }
    closeAllPanels();
    spotlightClose();
    lpEl = el('div');
    lpEl.id = 'launchpad';
    lpEl.innerHTML = `
      <div class="lp-search">${OS.icons.search}<input type="text" placeholder="Поиск" spellcheck="false"></div>
      <div class="lp-grid"></div>`;
    document.body.appendChild(lpEl);
    const input = lpEl.querySelector('input');
    const grid = lpEl.querySelector('.lp-grid');
    const fill = (q) => {
      q = (q || '').toLowerCase();
      grid.innerHTML = '';
      OS.allApps()
        .filter(a => !a.hidden && (!q || a.name.toLowerCase().includes(q)))
        .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
        .forEach((a, i) => {
          const item = el('div', 'lp-app', `
            <div class="lp-icon">${a.icon || OS.icons.fileGeneric}</div>
            <div class="lp-name">${esc(a.name)}</div>`);
          item.style.setProperty('--i', i);
          item.addEventListener('click', () => { launchpadClose(); OS.launch(a.id); });
          grid.appendChild(item);
        });
    };
    grid.classList.add('stagger');
    setTimeout(() => grid.classList.remove('stagger'), 650);
    fill('');
    input.focus();
    input.addEventListener('input', () => fill(input.value));
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') launchpadClose();
      if (e.key === 'Enter') {
        const first = grid.querySelector('.lp-app');
        if (first) first.click();
      }
    });
    lpEl.addEventListener('click', (e) => { if (e.target === lpEl || e.target.classList.contains('lp-grid')) launchpadClose(); });
  }
  function launchpadClose() {
    if (!lpEl) return;
    const n = lpEl;
    lpEl = null;
    n.classList.add('closing');
    setTimeout(() => n.remove(), 190);
  }

  /* ==================== ЦЕНТР УПРАВЛЕНИЯ (боковая панель справа) ==================== */

  const SPK = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M 14 38 L 34 38 L 56 20 L 56 80 L 34 62 L 14 62 Z" fill="currentColor"/><path d="M 68 36 C 76 44 76 56 68 64 M 76 28 C 90 42 90 58 76 72" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/></svg>`;

  const MON_FULL_CC = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const greetWord = (h) => h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';

  function calendarHTML() {
    const d = new Date();
    const year = d.getFullYear(), month = d.getMonth(), today = d.getDate();
    const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysIn = new Date(year, month + 1, 0).getDate();
    const daysPrev = new Date(year, month, 0).getDate();
    let cells = '';
    ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].forEach(dw => cells += `<div class="cal-dow">${dw}</div>`);
    for (let i = 0; i < firstDow; i++) cells += `<div class="cal-day other">${daysPrev - firstDow + 1 + i}</div>`;
    for (let day = 1; day <= daysIn; day++) cells += `<div class="cal-day ${day === today ? 'today' : ''}">${day}</div>`;
    const tail = (7 - (firstDow + daysIn) % 7) % 7;
    for (let i = 1; i <= tail; i++) cells += `<div class="cal-day other">${i}</div>`;
    return `<div class="cal-head"><span class="cal-month">${MON_FULL_CC[month]}</span><span>${year}</span></div><div class="cal-grid">${cells}</div>`;
  }
  function notifHTML() {
    const notifs = OS.getNotifications();
    return `<div class="notif-head"><span>Уведомления</span>${notifs.length ? '<span class="notif-clear">Очистить</span>' : ''}</div>
      <div class="notif-list">${notifs.length ? notifs.map(n => `
        <div class="notif-item"><div class="t-icon">${appIconOf(n.appId)}</div>
          <div><div class="t-title">${esc(n.title)}</div><div class="t-body">${esc(n.body)}</div></div></div>`).join('')
        : `<div class="notif-empty">Нет новых уведомлений</div>`}</div>`;
  }

  let ccEl = null;
  let ccTick = null;

  function ccToggle() {
    if (ccEl) { ccClose(); return; }
    closeAllPanels();
    ccEl = el('div');
    ccEl.id = 'control-center';
    document.body.appendChild(ccEl);
    renderCC();
    startCCTick();
    setTimeout(() => document.addEventListener('pointerdown', ccOutside, true), 0);
  }

  function renderCC() {
    if (!ccEl) return;
    const s = OS.settings;
    const theme = document.documentElement.getAttribute('data-theme');
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0');
    const vpnOn = OS.net ? OS.net.isOn() : false;
    const provs = OS.net ? OS.net.providers() : [];
    const vp = provs.length ? (provs.find(x => x.id === OS.net.active()) || provs[0]) : null;

    const tile = (t, on, ic, nm, st) =>
      `<div class="cc-tile ${on ? 'on' : ''}" data-t="${t}"><div class="ic">${ic}</div>
        <div class="tx"><div class="nm">${nm}</div><div class="st">${st}</div></div></div>`;

    ccEl.innerHTML = `
      <div class="cc-header">
        <div><div class="cc-clock">${hh}:${mm}</div>
          <div class="cc-sub">${esc(d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }))}</div></div>
        <div class="cc-greet">${esc(greetWord(d.getHours()))}${s.get('userName') ? '<br>' + esc(s.get('userName')) : ''}</div>
      </div>

      <div class="cc-grid">
        ${tile('wifi', s.get('wifi'), OS.icons.wifi, 'Wi-Fi', s.get('wifi') ? 'Hiko_5G' : 'Выкл.')}
        ${tile('bluetooth', s.get('bluetooth'), OS.icons.bluetooth, 'Bluetooth', s.get('bluetooth') ? 'Вкл.' : 'Выкл.')}
        ${tile('dnd', s.get('dnd'), OS.icons.moon, 'Не беспокоить', s.get('dnd') ? 'Вкл.' : 'Выкл.')}
        ${tile('nightlight', s.get('nightLight'), OS.icons.sun, 'Тёплый свет', s.get('nightLight') ? 'Вкл.' : 'Выкл.')}
        ${tile('theme', theme === 'dark', theme === 'dark' ? OS.icons.moon : OS.icons.sun, 'Тема', theme === 'dark' ? 'Тёмная' : 'Светлая')}
        ${tile('edge', s.get('ccEdgeReveal'), OS.icons.cc, 'Панель у края', s.get('ccEdgeReveal') ? 'Вкл.' : 'Выкл.')}
      </div>

      <div class="cc-vpn ${vpnOn ? 'on' : ''}">
        <div class="ic">${OS.icons.globe}</div>
        <div class="tx"><div class="nm">Обход блокировок</div>
          <div class="st">${vp ? (vpnOn ? 'Включён · ' + esc(vp.name) : 'Готов · ' + esc(vp.name)) : 'Нет модуля обхода'}</div></div>
        ${vp ? `<div class="ui-switch ${vpnOn ? 'on' : ''}" data-vpn="1"></div>`
             : `<button class="ui-btn cc-vpn-get">Модуль…</button>`}
      </div>

      <div class="cc-sliders">
        <div class="cc-slider">${OS.icons.sun}<input class="ui-slider" data-s="brightness" type="range" min="40" max="100" value="${Math.round(s.get('brightness') * 100)}"></div>
        <div class="cc-slider">${SPK}<input class="ui-slider" data-s="volume" type="range" min="0" max="100" value="${s.get('volume')}"></div>
      </div>

      <div class="cc-actions">
        <div class="cc-act" data-a="spotlight">${OS.icons.search}<span>Поиск</span></div>
        <div class="cc-act" data-a="mission">${OS.icons.mission}<span>Окна</span></div>
        <div class="cc-act" data-a="assistant">${OS.icons.spark}<span>Ави</span></div>
        <div class="cc-act" data-a="lock">${OS.icons.lock}<span>Замок</span></div>
      </div>

      <div class="cc-cal">${calendarHTML()}</div>
      <div class="cc-notif">${notifHTML()}</div>`;

    bindCC();
  }

  function bindCC() {
    const s = OS.settings;
    ccEl.querySelectorAll('.cc-tile[data-t]').forEach(row => row.addEventListener('click', () => {
      const t = row.dataset.t;
      if (t === 'theme') { const cur = document.documentElement.getAttribute('data-theme'); s.set('theme', cur === 'dark' ? 'light' : 'dark'); }
      else if (t === 'nightlight') s.set('nightLight', !s.get('nightLight'));
      else if (t === 'edge') s.set('ccEdgeReveal', !s.get('ccEdgeReveal'));
      else s.set(t, !s.get(t));
      renderCC();
    }));
    const sw = ccEl.querySelector('[data-vpn]');
    if (sw) sw.addEventListener('click', async () => { await OS.net.toggle(); renderCC(); });
    const getBtn = ccEl.querySelector('.cc-vpn-get');
    if (getBtn) getBtn.addEventListener('click', ccVpnGet);
    const br = ccEl.querySelector('[data-s="brightness"]');
    if (br) br.addEventListener('input', (e) => s.set('brightness', (+e.target.value) / 100));
    const vol = ccEl.querySelector('[data-s="volume"]');
    if (vol) vol.addEventListener('change', (e) => { s.set('volume', +e.target.value); OS.beep(660, .1); });
    ccEl.querySelectorAll('.cc-act[data-a]').forEach(a => a.addEventListener('click', () => {
      const act = a.dataset.a;
      ccClose();
      if (act === 'spotlight') spotlightToggle();
      else if (act === 'mission') OS.wm.missionToggle();
      else if (act === 'assistant') OS.assistant.toggle();
      else if (act === 'lock') OS.emit('session:lock');
    }));
    const clr = ccEl.querySelector('.notif-clear');
    if (clr) clr.addEventListener('click', () => { OS.clearNotifications(); refreshNotif(); });
  }

  async function ccVpnGet() {
    ccClose();
    const demo = await OS.dialog.confirm('Модуль обхода',
      'Скачай последнюю версию модуля обхода с GitHub и поставь её через Установщик («По ссылке…») — Hiko сам подхватит переключатель.\n\nИли поставить встроенный демо-модуль прямо сейчас, чтобы увидеть, как это работает?',
      { okLabel: 'Поставить демо', cancelLabel: 'Открыть Установщик' });
    if (demo) { OS.installer.installTrusted(OS.net.DEMO_CODE, 'obhod-demo.js'); }
    else OS.launch('installer');
  }

  function refreshNotif() {
    if (!ccEl) return;
    const n = ccEl.querySelector('.cc-notif');
    if (!n) return;
    n.innerHTML = notifHTML();
    const clr = n.querySelector('.notif-clear');
    if (clr) clr.addEventListener('click', () => { OS.clearNotifications(); refreshNotif(); });
  }

  function startCCTick() {
    stopCCTick();
    ccTick = setInterval(() => {
      if (!ccEl) { stopCCTick(); return; }
      const d = new Date();
      const c = ccEl.querySelector('.cc-clock');
      if (c) c.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }, 15000);
  }
  function stopCCTick() { if (ccTick) { clearInterval(ccTick); ccTick = null; } }

  function ccOutside(e) {
    if (ccEl && !ccEl.contains(e.target) &&
        !e.target.closest('#mb-cc') && !e.target.closest('#mb-clock') && !e.target.closest('#mb-vpn')) ccClose();
  }
  function ccClose() {
    stopCCTick();
    animateOut(ccEl);
    ccEl = null;
    document.removeEventListener('pointerdown', ccOutside, true);
  }

  OS.on('net:providers', () => { if (ccEl) renderCC(); });
  OS.on('net:state', () => { if (ccEl) renderCC(); });
  OS.on('os:notify', refreshNotif);
  OS.on('os:notify-cleared', refreshNotif);

  /* ==================== ЧАСЫ / КАЛЕНДАРЬ / УВЕДОМЛЕНИЯ ==================== */

  let cpEl = null;
  const MON_FULL = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  function clockPanelToggle() {
    if (cpEl) { cpClose(); return; }
    closeAllPanels();
    cpEl = el('div');
    cpEl.id = 'clock-panel';
    const d = new Date();
    const year = d.getFullYear(), month = d.getMonth(), today = d.getDate();
    const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // пн=0
    const daysIn = new Date(year, month + 1, 0).getDate();
    const daysPrev = new Date(year, month, 0).getDate();

    let cells = '';
    ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].forEach(dw => cells += `<div class="cal-dow">${dw}</div>`);
    for (let i = 0; i < firstDow; i++) cells += `<div class="cal-day other">${daysPrev - firstDow + 1 + i}</div>`;
    for (let day = 1; day <= daysIn; day++) cells += `<div class="cal-day ${day === today ? 'today' : ''}">${day}</div>`;
    const tail = (7 - (firstDow + daysIn) % 7) % 7;
    for (let i = 1; i <= tail; i++) cells += `<div class="cal-day other">${i}</div>`;

    const notifs = OS.getNotifications();
    cpEl.innerHTML = `
      <div class="cal-head"><span class="cal-month">${MON_FULL[month]}</span><span>${year}</span></div>
      <div class="cal-grid">${cells}</div>
      <div class="notif-head"><span>Уведомления</span><span class="notif-clear">Очистить</span></div>
      <div class="notif-list">${notifs.length ? notifs.map(n => `
        <div class="notif-item">
          <div class="t-icon">${appIconOf(n.appId)}</div>
          <div><div class="t-title">${esc(n.title)}</div><div class="t-body">${esc(n.body)}</div></div>
        </div>`).join('') : `<div class="notif-empty">Нет новых уведомлений</div>`}</div>`;
    document.body.appendChild(cpEl);
    cpEl.querySelector('.notif-clear').addEventListener('click', () => {
      OS.clearNotifications();
      cpClose(); clockPanelToggle();
    });
    setTimeout(() => document.addEventListener('pointerdown', cpOutside, true), 0);
  }
  function cpOutside(e) {
    if (cpEl && !cpEl.contains(e.target) && !e.target.closest('#mb-clock')) cpClose();
  }
  function cpClose() {
    animateOut(cpEl);
    cpEl = null;
    document.removeEventListener('pointerdown', cpOutside, true);
  }

  function appIconOf(appId) {
    const app = OS.getApp(appId);
    if (app && app.icon) return app.icon;
    return `<div style="color:var(--accent)">${OS.icons.logo}</div>`;
  }

  /* ==================== ТОСТЫ ==================== */

  OS.on('os:notify', (n) => {
    if (OS.settings.get('dnd')) return;
    const zone = document.getElementById('toasts');
    if (!zone) return;
    const t = el('div', 'toast', `
      <div class="t-icon">${appIconOf(n.appId)}</div>
      <div style="min-width:0"><div class="t-title">${esc(n.title)}</div><div class="t-body">${esc(n.body)}</div></div>`);
    t.addEventListener('click', () => dismiss());
    zone.appendChild(t);
    const dismiss = () => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 260);
    };
    setTimeout(dismiss, 5200);
  });

  function closeAllPanels() { ccClose(); cpClose(); }

  /* ==================== ПРИВЯЗКИ ==================== */

  OS.on('spotlight:toggle', spotlightToggle);
  OS.on('launchpad:toggle', launchpadToggle);
  OS.on('cc:toggle', ccToggle);
  OS.on('clockpanel:toggle', ccToggle); // клик по часам открывает единый Центр управления

  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.code === 'Space') {
      e.preventDefault();
      spotlightToggle();
    }
    if (e.ctrlKey && e.altKey && e.code === 'KeyL') {
      e.preventDefault();
      OS.emit('session:lock');
    }
  });

  /* ==================== ГОРЯЧИЕ УГЛЫ ==================== */

  const CORNER_ACTIONS = {
    mission: () => OS.wm.missionToggle(),
    desktop: () => OS.wm.showDesktop(),
    search: spotlightToggle,
    apps: launchpadToggle,
    assistant: () => OS.assistant.toggle(),
    lock: () => OS.emit('session:lock'),
  };
  let cornerAt = 0;
  let cornerArmed = true; // взводится только после ухода из угла
  document.addEventListener('mousemove', (e) => {
    const M = 2;
    const L = e.clientX <= M, R = e.clientX >= innerWidth - M - 1;
    const T = e.clientY <= M, B = e.clientY >= innerHeight - M - 1;
    const corner = L && T ? 'tl' : R && T ? 'tr' : L && B ? 'bl' : R && B ? 'br' : null;
    if (!corner) { cornerArmed = true; return; }
    if (!cornerArmed || performance.now() - cornerAt < 900) return;
    const conf = OS.settings.get('hotCorners', {});
    const fn = CORNER_ACTIONS[conf[corner]];
    if (fn) {
      cornerAt = performance.now();
      cornerArmed = false;
      fn();
    }
  });

  /* ==================== ОТКРЫТИЕ ПАНЕЛИ НАВЕДЕНИЕМ НА ПРАВЫЙ КРАЙ ==================== */

  let edgeT = null;
  document.addEventListener('mousemove', (e) => {
    if (!OS.settings.get('ccEdgeReveal', true)) { if (edgeT) { clearTimeout(edgeT); edgeT = null; } return; }
    const atEdge = e.clientX >= innerWidth - 1;
    const band = e.clientY > 56 && e.clientY < innerHeight - 56; // не мешаем углам
    if (atEdge && band && !ccEl && !edgeT && !e.buttons) {
      edgeT = setTimeout(() => { edgeT = null; if (!ccEl) ccToggle(); }, 220);
    } else if (!atEdge && edgeT) {
      clearTimeout(edgeT); edgeT = null;
    }
  });

  OS.overlays = { spotlightToggle, launchpadToggle, ccToggle, clockPanelToggle, animateOut };
})();
