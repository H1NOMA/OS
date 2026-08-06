/* ============================================================
   hinomaOS · boot — загрузка, экран блокировки, выключение
   ============================================================ */
(function () {
  'use strict';
  const { el, esc } = OS;

  function bootSequence() {
    OS._applyAll();
    OS.wallpapers.apply();

    const boot = document.getElementById('boot');
    const bar = boot.querySelector('.boot-bar > div');
    let p = 0;
    const step = () => {
      p += 12 + Math.random() * 22;
      bar.style.width = Math.min(100, p) + '%';
      if (p < 100) setTimeout(step, 160 + Math.random() * 200);
      else setTimeout(showLock, 420);
    };
    setTimeout(step, 300);
  }

  function showLock() {
    const boot = document.getElementById('boot');
    boot.classList.add('fade');
    setTimeout(() => boot.classList.add('hidden'), 550);

    const lock = document.getElementById('lock');
    lock.classList.remove('hidden', 'fade');
    lock.style.backgroundImage = `url("${OS.wallpapers.uriFor(OS.settings.get('wallpaper'))}")`;

    const name = OS.settings.get('userName');
    lock.innerHTML = `
      <div class="lock-time">--:--</div>
      <div class="lock-date"></div>
      <div class="lock-user">
        <div class="lock-avatar">${esc(name.slice(0, 1).toUpperCase())}</div>
        <div class="lock-name">${esc(name)}</div>
        <button class="lock-enter">Войти</button>
        <div class="lock-hint">или нажмите Enter</div>
      </div>`;

    const DOW_FULL = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
    const MON_RU = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    const tick = () => {
      if (lock.classList.contains('hidden')) return;
      const d = new Date();
      const t = lock.querySelector('.lock-time');
      const dt = lock.querySelector('.lock-date');
      if (t) t.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      if (dt) dt.textContent = `${DOW_FULL[d.getDay()]}, ${d.getDate()} ${MON_RU[d.getMonth()]}`;
      setTimeout(tick, 1000);
    };
    tick();

    setTimeout(() => lock.classList.add('deblur'), 60);

    const unlock = () => {
      document.removeEventListener('keydown', onKey);
      lock.classList.add('fade');
      setTimeout(() => { lock.classList.add('hidden'); lock.innerHTML = ''; }, 560);
      enterDesktop();
    };
    const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); unlock(); } };
    lock.querySelector('.lock-enter').addEventListener('click', unlock);
    document.addEventListener('keydown', onKey);
  }

  let desktopReady = false;
  function enterDesktop() {
    if (!desktopReady) {
      desktopReady = true;
      OS.menubar.render();
      OS.dock.init();
      OS.desktop.init();
    }
    if (OS.settings.get('firstRun')) {
      OS.settings.set('firstRun', false);
      setTimeout(() => {
        OS.notify({ title: 'Добро пожаловать! 👋', body: 'Alt+Space — поиск, F3 — все окна. Приятной работы!', appId: 'system' });
      }, 900);
    }
  }

  /* --- блокировка / выключение / перезагрузка --- */
  OS.on('session:lock', () => {
    OS.closeMenus();
    showLock();
  });

  OS.on('session:shutdown', async () => {
    const ok = await OS.dialog.confirm('Выключить компьютер?', 'Все окна будут закрыты.', { okLabel: 'Выключить' });
    if (!ok) return;
    powerDown(false);
  });

  OS.on('session:restart', async () => {
    const ok = await OS.dialog.confirm('Перезагрузить?', 'Система перезапустится.', { okLabel: 'Перезагрузить' });
    if (!ok) return;
    powerDown(true);
  });

  function powerDown(restart) {
    const off = el('div');
    off.id = 'power-off';
    document.body.appendChild(off);
    if (restart) {
      setTimeout(() => location.reload(), 1100);
    } else {
      off.innerHTML = `<button class="pw-btn" title="Включить">${OS.icons.power}</button>`;
      off.querySelector('.pw-btn').addEventListener('click', () => location.reload());
    }
  }

  document.addEventListener('DOMContentLoaded', bootSequence);
})();
