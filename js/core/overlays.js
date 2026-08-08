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

  /* ==================== CONTROL CENTER ==================== */

  let ccEl = null;
  function ccToggle() {
    if (ccEl) { ccClose(); return; }
    closeAllPanels();
    ccEl = el('div');
    ccEl.id = 'control-center';
    const s = OS.settings;
    const themeNow = document.documentElement.getAttribute('data-theme');
    ccEl.innerHTML = `
      <div class="cc-module cc-span2">
        <div class="cc-toggle-row" data-t="wifi">
          <div class="cc-toggle-icon ${s.get('wifi') ? 'on' : ''}">${OS.icons.wifi}</div>
          <div><div class="cc-t-name">Wi-Fi</div><div class="cc-t-state">${s.get('wifi') ? 'Hiko_5G' : 'Выкл.'}</div></div>
        </div>
        <div class="cc-toggle-row" data-t="bluetooth">
          <div class="cc-toggle-icon ${s.get('bluetooth') ? 'on' : ''}">${OS.icons.bluetooth}</div>
          <div><div class="cc-t-name">Bluetooth</div><div class="cc-t-state">${s.get('bluetooth') ? 'Вкл.' : 'Выкл.'}</div></div>
        </div>
        <div class="cc-toggle-row" data-t="dnd">
          <div class="cc-toggle-icon ${s.get('dnd') ? 'on' : ''}">${OS.icons.moon}</div>
          <div><div class="cc-t-name">Не беспокоить</div><div class="cc-t-state">${s.get('dnd') ? 'Вкл.' : 'Выкл.'}</div></div>
        </div>
      </div>
      <div class="cc-module" data-t="theme" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;">
        <div class="cc-toggle-icon ${themeNow === 'dark' ? 'on' : ''}" style="width:38px;height:38px;">${themeNow === 'dark' ? OS.icons.moon : OS.icons.sun}</div>
        <div class="cc-t-name" style="font-size:12px;">${themeNow === 'dark' ? 'Тёмная тема' : 'Светлая тема'}</div>
      </div>
      <div class="cc-module" data-t="nightlight" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;">
        <div class="cc-toggle-icon ${s.get('nightLight') ? 'on' : ''}" style="width:38px;height:38px;">${OS.icons.sun}</div>
        <div class="cc-t-name" style="font-size:12px;">Тёплый свет</div>
      </div>
      <div class="cc-module cc-span2">
        <div class="cc-label">Яркость</div>
        <input class="ui-slider" data-s="brightness" type="range" min="40" max="100" value="${Math.round(s.get('brightness') * 100)}">
      </div>
      <div class="cc-module cc-span2">
        <div class="cc-label">Звук</div>
        <input class="ui-slider" data-s="volume" type="range" min="0" max="100" value="${s.get('volume')}">
      </div>`;
    document.body.appendChild(ccEl);

    ccEl.querySelectorAll('[data-t]').forEach(row => {
      row.addEventListener('click', () => {
        const t = row.dataset.t;
        if (t === 'theme') {
          const cur = document.documentElement.getAttribute('data-theme');
          OS.settings.set('theme', cur === 'dark' ? 'light' : 'dark');
        } else if (t === 'nightlight') {
          OS.settings.set('nightLight', !s.get('nightLight'));
        } else {
          OS.settings.set(t, !s.get(t));
        }
        if (ccEl) { ccEl.remove(); ccEl = null; document.removeEventListener('pointerdown', ccOutside, true); }
        ccToggle(); // перерисовать без анимации закрытия
      });
    });
    ccEl.querySelector('[data-s="brightness"]').addEventListener('input', (e) => {
      OS.settings.set('brightness', (+e.target.value) / 100);
    });
    ccEl.querySelector('[data-s="volume"]').addEventListener('change', (e) => {
      OS.settings.set('volume', +e.target.value);
      OS.beep(660, .1);
    });
    setTimeout(() => document.addEventListener('pointerdown', ccOutside, true), 0);
  }
  function ccOutside(e) {
    if (ccEl && !ccEl.contains(e.target) && !e.target.closest('#mb-cc')) ccClose();
  }
  function ccClose() {
    animateOut(ccEl);
    ccEl = null;
    document.removeEventListener('pointerdown', ccOutside, true);
  }

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
  OS.on('clockpanel:toggle', clockPanelToggle);

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

  OS.overlays = { spotlightToggle, launchpadToggle, ccToggle, clockPanelToggle, animateOut };
})();
