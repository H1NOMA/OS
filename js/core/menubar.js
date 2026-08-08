/* ============================================================
   Hiko OS · menubar — строка меню + всплывающие/контекстные меню
   ============================================================ */
(function () {
  'use strict';
  const { el, $, esc, clamp } = OS;

  /* ================= МЕНЮ (общий механизм) ================= */

  let openMenus = [];
  function closeMenus() {
    openMenus.forEach(m => m.remove());
    openMenus = [];
    document.querySelectorAll('.mb-item.open').forEach(i => i.classList.remove('open'));
    OS.emit('menus:closed');
  }

  /**
   * items: [{label, icon, hotkey, disabled, checked, action, sep}]
   */
  function buildMenu(items, x, y, opts) {
    const menu = el('div', 'menu');
    items.forEach(it => {
      if (it.sep) { menu.appendChild(el('div', 'menu-sep')); return; }
      const mi = el('div', 'menu-item' + (it.disabled ? ' disabled' : ''));
      mi.innerHTML = `${it.icon ? it.icon : ''}<span>${esc(it.label)}${it.checked ? ' ✓' : ''}</span>${it.hotkey ? `<span class="mi-hotkey">${esc(it.hotkey)}</span>` : ''}`;
      if (!it.disabled && it.action) {
        mi.addEventListener('click', (e) => {
          e.stopPropagation();
          closeMenus();
          setTimeout(() => it.action(), 10);
        });
      }
      menu.appendChild(mi);
    });
    document.body.appendChild(menu);
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    menu.style.left = clamp(x, 4, innerWidth - mw - 4) + 'px';
    menu.style.top = clamp(y, 4, innerHeight - mh - 4) + 'px';
    openMenus.push(menu);
    return menu;
  }

  OS.contextMenu = (items, x, y) => { closeMenus(); return buildMenu(items, x, y); };
  OS.closeMenus = closeMenus;

  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.menu') && !e.target.closest('.mb-item')) closeMenus();
  }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenus(); });

  /* ================= MENU BAR ================= */

  let activeAppName = 'Рабочий стол';
  let activeAppMenus = null;

  function render() {
    const bar = document.getElementById('menubar');
    bar.innerHTML = '';

    // — логотип
    const logo = el('div', 'mb-item mb-logo', OS.icons.logo);
    logo.addEventListener('click', (e) => {
      e.stopPropagation();
      if (logo.classList.contains('open')) { closeMenus(); return; }
      closeMenus();
      logo.classList.add('open');
      const r = logo.getBoundingClientRect();
      buildMenu([
        { label: 'Об этой системе', action: showAbout },
        { sep: true },
        { label: 'Настройки…', action: () => OS.launch('settings') },
        { label: 'Диспетчер задач…', action: () => OS.launch('taskmgr') },
        { sep: true },
        { label: 'Свернуть все окна', action: () => OS.wm.minimizeOthers(null) },
        { label: 'Обзор окон', hotkey: 'F3', action: () => OS.wm.missionToggle() },
        { sep: true },
        { label: 'Заблокировать экран', hotkey: 'Ctrl+Alt+L', action: () => OS.emit('session:lock') },
        { label: 'Перезагрузить…', action: () => OS.emit('session:restart') },
        { label: 'Выключить…', action: () => OS.emit('session:shutdown') },
      ], r.left, r.bottom + 6);
    });
    bar.appendChild(logo);

    // — имя активного приложения
    const appName = el('div', 'mb-item mb-appname', esc(activeAppName));
    bar.appendChild(appName);

    // — меню приложения
    const menus = activeAppMenus || defaultAppMenus();
    menus.forEach(m => {
      const item = el('div', 'mb-item', esc(m.title));
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        if (item.classList.contains('open')) { closeMenus(); return; }
        closeMenus();
        item.classList.add('open');
        const r = item.getBoundingClientRect();
        buildMenu(m.items, r.left, r.bottom + 6);
      });
      bar.appendChild(item);
    });

    bar.appendChild(el('div', 'mb-spacer'));

    // — правая часть
    const right = [
      { id: 'mb-assist', html: OS.icons.spark, title: 'Ассистент (Ctrl+Alt+H)', click: () => OS.assistant.toggle() },
      { id: 'mb-search', html: OS.icons.search, title: 'Поиск (Alt+Space)', click: () => OS.emit('spotlight:toggle') },
      { id: 'mb-mission', html: OS.icons.mission, title: 'Обзор окон (F3)', click: () => OS.wm.missionToggle() },
      { id: 'mb-wifi', html: OS.icons.wifi, title: 'Wi-Fi', click: (e, n) => toggleQuick(n, 'wifi') },
      { id: 'mb-vpn', html: OS.icons.globe, title: 'Обход блокировок включён', click: () => OS.emit('cc:toggle') },
      { id: 'mb-battery', html: `<span style="font-size:11.5px;font-weight:600;">100%</span>` + OS.icons.battery, title: 'Аккумулятор', click: () => OS.emit('cc:toggle') },
      { id: 'mb-cc', html: OS.icons.cc, title: 'Центр управления', click: () => OS.emit('cc:toggle') },
    ];
    right.forEach(cfg => {
      const item = el('div', 'mb-item', cfg.html);
      item.id = cfg.id;
      item.title = cfg.title || '';
      if (cfg.click) item.addEventListener('click', (e) => { e.stopPropagation(); cfg.click(e, item); });
      bar.appendChild(item);
    });
    updateWifiIcon();
    updateVpnIndicator();
    setupBattery();
    applyBatteryUI();

    // — часы
    const clock = el('div', 'mb-item mb-clock');
    clock.id = 'mb-clock';
    clock.addEventListener('click', (e) => { e.stopPropagation(); OS.emit('clockpanel:toggle'); });
    bar.appendChild(clock);
    tickClock();
  }

  function toggleQuick(node, key) {
    OS.settings.set(key, !OS.settings.get(key));
    updateWifiIcon();
  }
  function updateWifiIcon() {
    const w = document.getElementById('mb-wifi');
    if (w) w.style.opacity = OS.settings.get('wifi') ? '1' : '.35';
  }
  OS.on('settings:change', ({ key }) => { if (key === 'wifi') updateWifiIcon(); });

  /* --- индикатор обхода блокировок (показывается только когда включён) --- */
  function updateVpnIndicator() {
    const v = document.getElementById('mb-vpn');
    if (!v) return;
    const on = OS.net ? OS.net.isOn() : false;
    v.style.display = on ? '' : 'none';
    v.classList.toggle('on', on);
  }
  OS.on('net:state', updateVpnIndicator);
  OS.on('net:providers', updateVpnIndicator);

  /* --- живой аккумулятор (Battery API, с запасным «100%») --- */
  let batteryReady = false;
  let batteryState = null; // { pct, charging }
  function applyBatteryUI() {
    const b = document.getElementById('mb-battery');
    if (!b) return;
    if (!batteryState) return; // остаётся дефолтный «100%»
    const bolt = batteryState.charging ? `<span class="mb-bolt">${OS.icons.bolt}</span>` : '';
    b.innerHTML = `<span style="font-size:11.5px;font-weight:600;">${batteryState.pct}%</span>${bolt}${OS.icons.battery}`;
    b.title = 'Аккумулятор' + (batteryState.charging ? ' · заряжается' : '');
  }
  function setupBattery() {
    if (batteryReady || !navigator.getBattery) return;
    batteryReady = true;
    navigator.getBattery().then(bat => {
      const upd = () => { batteryState = { pct: Math.round(bat.level * 100), charging: bat.charging }; applyBatteryUI(); };
      bat.addEventListener('levelchange', upd);
      bat.addEventListener('chargingchange', upd);
      upd();
    }).catch(() => { /* нет доступа — оставим 100% */ });
  }

  const DOW = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const MON = ['янв.', 'февр.', 'мар.', 'апр.', 'мая', 'июн.', 'июл.', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'];
  function tickClock() {
    const c = document.getElementById('mb-clock');
    if (c) {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      c.textContent = `${DOW[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]}  ${hh}:${mm}`;
    }
    setTimeout(tickClock, 1000 * (60 - new Date().getSeconds()) + 500);
  }

  function defaultAppMenus() {
    return [
      {
        title: 'Файл',
        items: [
          { label: 'Новое окно', hotkey: 'Ctrl+N', action: () => { const w = OS.wm.focused; if (w) OS.launch(w.app.id); else OS.launch('finder'); } },
          { label: 'Закрыть окно', hotkey: 'Ctrl+W', action: () => OS.wm.focused?.close() },
        ],
      },
      {
        title: 'Окно',
        items: [
          { label: 'Свернуть', action: () => OS.wm.focused?.minimize() },
          { label: 'Развернуть / восстановить', action: () => OS.wm.focused?.toggleMaximize() },
          { sep: true },
          { label: 'Прикрепить слева', hotkey: 'Ctrl+Alt+←', action: () => OS.wm.focused?.snapTo('left') },
          { label: 'Прикрепить справа', hotkey: 'Ctrl+Alt+→', action: () => OS.wm.focused?.snapTo('right') },
          { sep: true },
          { label: 'Все окна (Обзор)', hotkey: 'F3', action: () => OS.wm.missionToggle() },
        ],
      },
      {
        title: 'Справка',
        items: [
          { label: 'О системе Hiko OS', action: showAbout },
          { label: 'Горячие клавиши', action: showHotkeys },
        ],
      },
    ];
  }

  function showAbout() {
    OS.dialog.alert(
      `Hiko OS ${OS.VERSION} «${OS.CODENAME}»`,
      `Персональная веб-ОС со своим характером\nЧистый JavaScript, ноль зависимостей\n\nПамять: localStorage (${OS.fmtBytes(OS.vfs.usage())} занято)\nПользователь: ${OS.settings.get('userName')}`,
      `<div style="width:52px;height:52px;color:var(--accent)">${OS.icons.logo}</div>`
    );
  }
  function showHotkeys() {
    OS.dialog.alert('Горячие клавиши',
      'Alt + Space — поиск\nAlt + Tab — переключение окон\nF3 — обзор окон\nCtrl + Alt + ←/→/↑/↓ — прикрепить окно\nCtrl + W — закрыть окно\nCtrl + Alt + L — заблокировать\nF2 — переименовать файл');
  }

  OS.on('wm:focus', (win) => {
    const newName = win ? win.app.name : 'Рабочий стол';
    const newMenus = win && win.app.menus ? win.app.menus(win) : null;
    if (newName !== activeAppName || newMenus !== activeAppMenus) {
      activeAppName = newName;
      activeAppMenus = newMenus;
      render();
    }
  });
  OS.on('wm:closed', () => { if (!OS.wm.focused) { activeAppName = 'Рабочий стол'; activeAppMenus = null; render(); } });

  OS.menubar = { render, showAbout, showHotkeys };
})();
