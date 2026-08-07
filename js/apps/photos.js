/* hinomaOS · Фото — галерея и просмотр изображений */
(function () {
  'use strict';
  const { el, esc } = OS;

  const ICON = OS.appTile(
    { from: '#FF8A5C', to: '#C74882' },
    `<g>
      <rect x="-28" y="-22" width="42" height="32" rx="6" fill="rgba(255,255,255,.45)" transform="rotate(-9 -7 -6)"/>
      <rect x="-18" y="-14" width="46" height="36" rx="6" fill="#fff"/>
      <circle cx="-7" cy="-4" r="4.5" fill="#FFB454"/>
      <path d="M -15 17 L -3 5 L 6 13 L 13 7 L 25 18 L 25 16 C 25 20 23 22 20 22 L -12 22 C -15 22 -17 20 -17 18 Z" fill="#23D1A8"/>
    </g>`
  );

  OS.injectStyle('app-photos', `
    .ph-root { flex:1; min-height:0; display:flex; flex-direction:column; }
    .ph-grid { flex:1; min-height:0; overflow-y:auto; padding:14px; display:grid;
      grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:12px; align-content:start; }
    .ph-cat { grid-column:1/-1; font-size:12px; font-weight:700; text-transform:uppercase;
      letter-spacing:.5px; color:var(--text-3); padding-top:6px; }
    .ph-thumb { position:relative; aspect-ratio:1; border-radius:10px; overflow:hidden; cursor:default;
      background:var(--ctl-bg); box-shadow:0 0 0 1px var(--divider); }
    .ph-thumb img { width:100%; height:100%; object-fit:cover; display:block; }
    .ph-thumb:hover { box-shadow:0 0 0 2.5px var(--accent); }
    .ph-thumb .ph-name { position:absolute; left:0; right:0; bottom:0; padding:14px 8px 6px;
      background:linear-gradient(transparent, rgba(0,0,0,.65)); color:#fff; font-size:11.5px;
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .ph-view { flex:1; min-height:0; display:flex; flex-direction:column; background:#121216; }
    .ph-stage { flex:1; min-height:0; display:flex; align-items:center; justify-content:center; overflow:hidden; position:relative; }
    .ph-stage img { max-width:96%; max-height:96%; object-fit:contain; transition:transform .15s ease-out;
      border-radius:4px; box-shadow:0 10px 50px rgba(0,0,0,.5); }
    .ph-nav { position:absolute; top:50%; transform:translateY(-50%); width:42px; height:42px; border:none;
      border-radius:50%; background:rgba(30,30,36,.7); color:#fff; display:flex; align-items:center;
      justify-content:center; cursor:default; backdrop-filter:blur(10px); }
    .ph-nav:hover { background:rgba(60,60,70,.85); }
    .ph-nav svg { width:18px; height:18px; }
    .ph-nav.prev { left:14px; } .ph-nav.next { right:14px; }
    .ph-caption { flex:none; display:flex; align-items:center; gap:10px; padding:10px 16px; color:#d8d8de;
      font-size:13px; background:rgba(20,20,26,.9); }
    .ph-caption .sp { flex:1; }
    .ph-caption .ui-btn { background:rgba(255,255,255,.1); color:#fff; box-shadow:none; }
    .ph-caption .ui-btn:hover { background:rgba(255,255,255,.18); }
  `);

  const IMG_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'];
  const isImage = (name) => IMG_EXT.includes((name.split('.').pop() || '').toLowerCase());

  function srcOf(item) {
    try {
      const c = OS.vfs.read(item.path);
      if (c.startsWith('data:')) return c;
      if (item.name.toLowerCase().endsWith('.svg')) return 'data:image/svg+xml,' + encodeURIComponent(c);
    } catch (e) { /* — */ }
    return null;
  }

  function collect() {
    const out = [];
    const walk = (dir) => {
      let items;
      try { items = OS.vfs.list(dir); } catch (e) { return; }
      items.forEach(i => {
        if (i.type === 'dir') walk(i.path);
        else if (isImage(i.name)) out.push(i);
      });
    };
    walk('/Pictures');
    walk('/Desktop');
    walk('/Downloads');
    return out;
  }

  OS.registerApp({
    id: 'photos',
    name: 'Фото',
    icon: ICON,
    width: 860, height: 580,
    minWidth: 480, minHeight: 360,
    render(win, ctx) {
      let mode = 'grid';       // grid | view
      let items = [];          // файлы-картинки
      let wpMode = false;      // просматриваем обои
      let idx = 0;
      let zoom = 1;

      const root = el('div', 'ph-root');
      win.content.appendChild(root);

      function renderGrid() {
        mode = 'grid';
        zoom = 1;
        win.setTitle('Фото');
        items = collect();
        const wps = OS.wallpapers.presets;
        root.innerHTML = `
          <div class="ui-toolbar">
            <strong style="font-size:14px">Медиатека</strong>
            <span style="color:var(--text-3);font-size:12.5px">${items.length} фото</span>
            <span style="flex:1"></span>
            <button class="ui-btn ph-paint">Открыть Paint</button>
          </div>
          <div class="ph-grid">
            ${items.length ? '<div class="ph-cat">Изображения</div>' : ''}
            ${items.map((it, i) => {
              const src = srcOf(it);
              return `<div class="ph-thumb" data-i="${i}">${src ? `<img src="${src}" alt="">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center">${OS.icons.fileImage}</div>`}<div class="ph-name">${esc(it.name)}</div></div>`;
            }).join('')}
            <div class="ph-cat">Обои системы</div>
            ${wps.map((w, i) => `<div class="ph-thumb" data-wp="${i}"><img src="${w.uri}" alt=""><div class="ph-name">${esc(w.name)}</div></div>`).join('')}
          </div>`;
        if (!items.length) {
          const grid = root.querySelector('.ph-grid');
          const empty = el('div', 'ui-empty', `${OS.icons.fileImage}<div>Нет изображений</div><button class="ui-btn primary">Нарисовать в Paint</button>`);
          empty.style.gridColumn = '1/-1';
          empty.style.minHeight = '160px';
          empty.querySelector('button').addEventListener('click', () => OS.launch('paint'));
          grid.insertBefore(empty, grid.firstChild);
        }
        root.querySelector('.ph-paint').addEventListener('click', () => OS.launch('paint'));
        root.querySelectorAll('[data-i]').forEach(t => t.addEventListener('click', () => {
          wpMode = false; idx = +t.dataset.i; renderView();
        }));
        root.querySelectorAll('[data-wp]').forEach(t => t.addEventListener('click', () => {
          wpMode = true; idx = +t.dataset.wp; renderView();
        }));
      }

      function current() {
        return wpMode ? OS.wallpapers.presets[idx] : items[idx];
      }

      function renderView() {
        mode = 'view';
        zoom = 1;
        const list = wpMode ? OS.wallpapers.presets : items;
        if (!list.length) { renderGrid(); return; }
        idx = (idx + list.length) % list.length;
        const it = list[idx];
        const src = wpMode ? it.uri : srcOf(it);
        win.setTitle(wpMode ? `Обои — ${it.name}` : it.name);
        root.innerHTML = `
          <div class="ph-view">
            <div class="ui-toolbar" style="border-bottom-color:rgba(255,255,255,.08)">
              <button class="ui-btn ph-back" style="background:rgba(255,255,255,.1);color:#fff;box-shadow:none">${OS.icons.chevronL} Назад</button>
              <span style="flex:1"></span>
              <button class="ui-btn ph-zo" style="background:rgba(255,255,255,.1);color:#fff;box-shadow:none">−</button>
              <button class="ui-btn ph-z1" style="background:rgba(255,255,255,.1);color:#fff;box-shadow:none">100%</button>
              <button class="ui-btn ph-zi" style="background:rgba(255,255,255,.1);color:#fff;box-shadow:none">+</button>
            </div>
            <div class="ph-stage">
              ${src ? `<img src="${src}" alt="">` : `<div style="color:#888">Не удалось открыть</div>`}
              <button class="ph-nav prev">${OS.icons.chevronL}</button>
              <button class="ph-nav next">${OS.icons.chevronR}</button>
            </div>
            <div class="ph-caption">
              <span>${esc(it.name)}</span>
              ${!wpMode ? `<span style="color:#8e8e96">${OS.fmtBytes(it.size)}</span>` : ''}
              <span class="sp"></span>
              ${wpMode ? `<button class="ui-btn ph-setwp">Сделать обоями</button>`
                       : `<button class="ui-btn ph-del">Удалить</button>`}
              <span style="color:#8e8e96">${idx + 1} из ${list.length}</span>
            </div>
          </div>`;
        const img = root.querySelector('.ph-stage img');
        const applyZoom = () => { if (img) img.style.transform = `scale(${zoom})`; };
        root.querySelector('.ph-back').addEventListener('click', renderGrid);
        root.querySelector('.prev').addEventListener('click', () => { idx--; renderView(); });
        root.querySelector('.next').addEventListener('click', () => { idx++; renderView(); });
        root.querySelector('.ph-zi').addEventListener('click', () => { zoom = Math.min(6, zoom * 1.3); applyZoom(); });
        root.querySelector('.ph-zo').addEventListener('click', () => { zoom = Math.max(0.2, zoom / 1.3); applyZoom(); });
        root.querySelector('.ph-z1').addEventListener('click', () => { zoom = 1; applyZoom(); });
        root.querySelector('.ph-stage').addEventListener('wheel', (e) => {
          e.preventDefault();
          zoom = Math.max(0.2, Math.min(6, zoom * (e.deltaY < 0 ? 1.12 : 0.89)));
          applyZoom();
        }, { passive: false });
        const setwp = root.querySelector('.ph-setwp');
        if (setwp) setwp.addEventListener('click', () => {
          OS.settings.set('wallpaper', it.id);
          OS.notify({ title: 'Фото', body: `Обои «${it.name}» установлены`, appId: 'photos' });
        });
        const del = root.querySelector('.ph-del');
        if (del) del.addEventListener('click', async () => {
          const ok = await OS.dialog.confirm('Удалить изображение?', `«${it.name}» будет перемещено в корзину.`, { okLabel: 'Удалить', danger: true });
          if (ok) { OS.vfs.rm(it.path, { toTrash: true }); renderGrid(); }
        });
      }

      const onKey = (e) => {
        if (mode !== 'view' || OS.wm.focused !== win) return;
        if (e.key === 'ArrowLeft') { e.preventDefault(); idx--; renderView(); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); idx++; renderView(); }
        else if (e.key === 'Escape') { e.preventDefault(); renderGrid(); }
      };
      document.addEventListener('keydown', onKey);

      const unVfs = OS.on('vfs:change', OS.debounce(() => { if (mode === 'grid') renderGrid(); }, 200));
      win.on('close', () => {
        document.removeEventListener('keydown', onKey);
        unVfs();
      });

      // старт
      if (ctx.args && ctx.args.path) {
        items = collect();
        const i = items.findIndex(x => x.path === ctx.args.path);
        if (i >= 0) { wpMode = false; idx = i; renderView(); return; }
      }
      renderGrid();
    },
  });
})();
