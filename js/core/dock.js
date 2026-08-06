/* ============================================================
   hinomaOS · dock — док с магнификацией, индикаторами
   запущенных приложений, тултипами и контекстными меню
   ============================================================ */
(function () {
  'use strict';
  const { el, esc, clamp } = OS;

  let dockEl = null;
  let tipEl = null;

  function pinned() { return OS.settings.get('dockPinned', []); }

  function itemsModel() {
    const running = new Set(OS.wm.all().map(w => w.app.id));
    const list = [];
    // Launchpad всегда первый
    list.push({ special: 'launchpad' });
    pinned().forEach(id => {
      const app = OS.getApp(id);
      if (app) list.push({ app, running: running.has(id) });
    });
    // запущенные, но не закреплённые
    running.forEach(id => {
      if (!pinned().includes(id)) {
        const app = OS.getApp(id);
        if (app) list.push({ app, running: true });
      }
    });
    list.push({ special: 'sep' });
    list.push({ special: 'trash' });
    return list;
  }

  function render() {
    if (!dockEl) dockEl = document.getElementById('dock');
    dockEl.innerHTML = '';
    itemsModel().forEach(m => {
      if (m.special === 'sep') { dockEl.appendChild(el('div', 'dock-sep')); return; }

      const item = el('div', 'dock-item');
      let name, iconHtml;
      if (m.special === 'launchpad') {
        name = 'Launchpad';
        iconHtml = OS.appTile({ from: '#8e9bb5', to: '#5a6478' }, `<g transform="translate(-50 -50) scale(0.62) translate(30 30)">${OS.icons.grid.replace(/<\/?svg[^>]*>/g, '')}</g>`.replace('currentColor', '#fff'));
        iconHtml = OS.appTile(
          { from: '#aab6cf', to: '#616c85' },
          `<g fill="#fff" transform="translate(-31 -31) scale(0.62)">
            <rect x="14" y="14" width="20" height="20" rx="5"/><rect x="40" y="14" width="20" height="20" rx="5"/><rect x="66" y="14" width="20" height="20" rx="5"/>
            <rect x="14" y="40" width="20" height="20" rx="5"/><rect x="40" y="40" width="20" height="20" rx="5"/><rect x="66" y="40" width="20" height="20" rx="5"/>
            <rect x="14" y="66" width="20" height="20" rx="5"/><rect x="40" y="66" width="20" height="20" rx="5"/><rect x="66" y="66" width="20" height="20" rx="5"/>
          </g>`
        );
        item.addEventListener('click', () => OS.emit('launchpad:toggle'));
      } else if (m.special === 'trash') {
        name = 'Корзина';
        iconHtml = OS.vfs.trashCount() > 0 ? OS.icons.trashFull : OS.icons.trashEmpty;
        item.addEventListener('click', () => OS.launch('finder', { path: '/Trash' }));
        item.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          OS.contextMenu([
            { label: 'Открыть', action: () => OS.launch('finder', { path: '/Trash' }) },
            { label: 'Очистить корзину…', disabled: OS.vfs.trashCount() === 0, action: confirmEmptyTrash },
          ], e.clientX, e.clientY - 10);
        });
      } else {
        const app = m.app;
        name = app.name;
        iconHtml = app.icon || OS.icons.fileGeneric;
        if (m.running) item.classList.add('running');
        item.dataset.app = app.id;
        item.addEventListener('click', () => {
          const wins = OS.wm.windowsOf(app.id);
          if (!wins.length) {
            item.classList.add('bouncing');
            setTimeout(() => item.classList.remove('bouncing'), 1150);
            OS.launch(app.id);
          } else if (wins.length === 1) {
            const w = wins[0];
            if (w.isMin) { w.restore(); }
            else if (OS.wm.focused === w) w.minimize();
            else w.focus();
          } else {
            const w = wins.find(x => x.isMin) || wins[0];
            w.restore(); w.focus();
          }
        });
        item.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          const wins = OS.wm.windowsOf(app.id);
          const isPinned = pinned().includes(app.id);
          OS.contextMenu([
            ...wins.map(w => ({ label: '· ' + (w.getTitle() || app.name), action: () => { w.restore(); w.focus(); } })),
            ...(wins.length ? [{ sep: true }] : []),
            { label: 'Открыть' + (wins.length ? ' новое окно' : ''), disabled: !!(app.singleton && wins.length), action: () => OS.launch(app.id) },
            { label: isPinned ? 'Открепить от дока' : 'Закрепить в доке', action: () => {
                const p = pinned().slice();
                if (isPinned) p.splice(p.indexOf(app.id), 1);
                else p.push(app.id);
                OS.settings.set('dockPinned', p);
                render();
              } },
            ...(wins.length ? [
              { sep: true },
              { label: 'Свернуть все', action: () => wins.forEach(w => w.minimize()) },
              { label: 'Завершить', action: () => wins.forEach(w => w.close()) },
            ] : []),
          ], e.clientX, e.clientY - 10);
        });
      }

      item.innerHTML = `<div class="dock-icon">${iconHtml}</div><div class="dock-dot"></div>` + item.innerHTML;
      // тултип
      item.addEventListener('mouseenter', () => showTip(item, name));
      item.addEventListener('mouseleave', hideTip);
      dockEl.appendChild(item);
    });
  }

  async function confirmEmptyTrash() {
    const ok = await OS.dialog.confirm('Очистить корзину?',
      `Объектов: ${OS.vfs.trashCount()}. Это действие необратимо.`,
      { okLabel: 'Очистить', danger: true });
    if (ok) { OS.vfs.emptyTrash(); OS.beep(320, .12); }
  }

  function showTip(item, text) {
    hideTip();
    tipEl = el('div', 'dock-tip', esc(text));
    document.body.appendChild(tipEl);
    const r = item.getBoundingClientRect();
    tipEl.style.left = (r.left + r.width / 2) + 'px';
    tipEl.style.top = (r.top - 38) + 'px';
  }
  function hideTip() { if (tipEl) { tipEl.remove(); tipEl = null; } }

  /* --- магнификация --- */
  function wireMagnify() {
    const zone = document.getElementById('dock-zone');
    zone.addEventListener('mousemove', (e) => {
      if (!OS.settings.get('dockMagnify')) return;
      const icons = dockEl.querySelectorAll('.dock-item .dock-icon');
      icons.forEach(ic => {
        const r = ic.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const dist = Math.abs(e.clientX - cx);
        const range = 130;
        const maxScale = 1.5;
        const s = dist > range ? 1 : 1 + (maxScale - 1) * Math.cos((dist / range) * (Math.PI / 2));
        ic.style.transform = `scale(${s.toFixed(3)}) translateY(${(-(s - 1) * 6).toFixed(1)}px)`;
      });
    });
    zone.addEventListener('mouseleave', resetMagnify);
  }
  function resetMagnify() {
    dockEl.querySelectorAll('.dock-item .dock-icon').forEach(ic => { ic.style.transform = ''; });
  }

  /* --- обновления --- */
  OS.on('wm:opened', render);
  OS.on('wm:closed', () => { hideTip(); render(); });
  OS.on('apps:registered', OS.debounce(render, 50));
  OS.on('vfs:change', ({ path, action }) => {
    if (path.startsWith('/Trash') || action === 'empty-trash' || action === 'rm') render();
  });
  OS.on('settings:change', ({ key }) => { if (key === 'dockPinned' || key === 'dockSize') render(); });

  OS.dock = {
    init() { render(); wireMagnify(); },
    render,
    bounce(appId) {
      const item = dockEl?.querySelector(`.dock-item[data-app="${appId}"]`);
      if (item) { item.classList.add('bouncing'); setTimeout(() => item.classList.remove('bouncing'), 1150); }
    },
  };
})();
