/* ============================================================
   hinomaOS · Файлы (finder) — проводник
   ============================================================ */
(function () {
  'use strict';

  /* ---------- иконка приложения: лицо Finder ---------- */
  const ICON = OS.appTile(
    { from: '#35E0B5', to: '#0E8FA8' },
    `<g fill="#fff">
       <path d="M -30 -19 C -30 -23 -27 -25 -24 -25 L -9 -25 C -6 -25 -4 -24 -2 -22 L 2 -18 L 24 -18 C 28 -18 30 -15 30 -12 L 30 -8 L -30 -8 Z" opacity=".8"/>
       <path d="M -30 -12 C -30 -15 -27 -17 -24 -17 L 24 -17 C 28 -17 30 -14 30 -11 L 30 18 C 30 22 28 24 24 24 L -24 24 C -28 24 -30 22 -30 18 Z"/>
     </g>`
  );

  /* ---------- глифы сайдбара (currentColor) ---------- */
  const SIDE = {
    desktop: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"><rect x="12" y="16" width="76" height="50" rx="8"/><path d="M 50 66 L 50 82"/><path d="M 34 84 L 66 84"/></g></svg>`,
    docs: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"><path d="M 28 14 L 58 14 L 76 32 L 76 86 L 28 86 Z"/><path d="M 58 14 L 58 32 L 76 32"/></g></svg>`,
    downloads: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"><path d="M 50 12 L 50 56"/><path d="M 32 40 L 50 58 L 68 40"/><path d="M 16 70 L 16 80 C 16 84 19 86 23 86 L 77 86 C 81 86 84 84 84 80 L 84 70"/></g></svg>`,
    pictures: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"><rect x="12" y="20" width="76" height="60" rx="9"/><path d="M 20 70 L 40 52 L 54 64 L 66 54 L 80 66"/></g><circle cx="35" cy="39" r="7" fill="currentColor"/></svg>`,
    music: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M 40 76 L 40 24 L 76 16 L 76 68" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><circle cx="30" cy="76" r="11" fill="currentColor"/><circle cx="66" cy="68" r="11" fill="currentColor"/></svg>`,
    trash: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"><path d="M 22 28 L 78 28"/><path d="M 30 28 L 34 84 C 34 88 37 90 41 90 L 59 90 C 63 90 66 88 66 84 L 70 28"/><path d="M 40 28 C 40 16 60 16 60 28"/><path d="M 43 42 L 44 76 M 57 42 L 56 76"/></g></svg>`,
    listGlyph: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="currentColor" stroke-width="11" stroke-linecap="round"><path d="M 14 26 L 86 26"/><path d="M 14 50 L 86 50"/><path d="M 14 74 L 86 74"/></g></svg>`,
  };

  const FAVS = [
    { label: 'Рабочий стол', path: '/Desktop', icon: SIDE.desktop },
    { label: 'Документы', path: '/Documents', icon: SIDE.docs },
    { label: 'Загрузки', path: '/Downloads', icon: SIDE.downloads },
    { label: 'Изображения', path: '/Pictures', icon: SIDE.pictures },
    { label: 'Музыка', path: '/Music', icon: SIDE.music },
  ];

  const RU_NAMES = {
    '/Desktop': 'Рабочий стол',
    '/Documents': 'Документы',
    '/Downloads': 'Загрузки',
    '/Pictures': 'Изображения',
    '/Music': 'Музыка',
    '/Trash': 'Корзина',
  };

  function plural(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }
  const objWord = (n) => `${n} ${plural(n, 'объект', 'объекта', 'объектов')}`;

  function dispName(path) {
    if (path === '/' || !path) return 'hinomaOS';
    return RU_NAMES[path] || OS.vfs.nameOf(path);
  }

  /* ---------- буфер обмена (общий для всех окон Файлов) ---------- */
  const clip = { mode: null, paths: [] };

  /* ---------- стили ---------- */
  OS.injectStyle('app-finder', `
    .fnd-root { flex: 1; display: flex; flex-direction: column; min-height: 0; }
    .fnd-toolbar { gap: 8px; }
    .fnd-nav { display: flex; gap: 4px; flex: none; }
    .fnd-nav .ui-btn svg { width: 14px; height: 14px; }

    .fnd-crumbs {
      flex: 1; min-width: 0; height: 28px;
      display: flex; align-items: center; gap: 1px;
      padding: 0 5px; overflow: hidden;
      background: var(--ctl-bg);
      box-shadow: inset 0 0 0 1px var(--ctl-border);
      border-radius: var(--r-ctl);
    }
    .fnd-crumb {
      padding: 3px 8px; border-radius: 6px;
      font-size: 12.5px; font-weight: 500; color: var(--text-2);
      white-space: nowrap; cursor: default; flex: none;
    }
    .fnd-crumb:hover { background: var(--hover); color: var(--text); }
    .fnd-crumb.cur { color: var(--text); font-weight: 700; }
    .fnd-crumb-sep { color: var(--text-3); font-size: 12px; flex: none; user-select: none; }

    .fnd-search { width: 165px; flex: none; }

    .fnd-body { flex: 1; display: flex; min-height: 0; }
    .fnd-side { display: flex; flex-direction: column; }
    .fnd-side-gap { height: 12px; flex: none; }

    .fnd-main {
      flex: 1; min-width: 0; overflow: auto; outline: none;
      background: var(--content-bg);
      display: flex; flex-direction: column;
      position: relative;
    }

    /* --- сетка --- */
    .fnd-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(102px, 1fr));
      gap: 4px; padding: 12px; align-content: start;
    }
    .fnd-gitem {
      display: flex; flex-direction: column; align-items: center; gap: 7px;
      padding: 11px 6px 9px; border-radius: 10px;
      user-select: none; cursor: default;
    }
    .fnd-gitem:hover { background: var(--hover); }
    .fnd-gitem.sel { background: var(--accent-soft); }
    .fnd-gitem .fnd-ico { line-height: 0; }
    .fnd-gitem .fnd-ico svg { width: 52px; height: 52px; }
    .fnd-gitem .fnd-name {
      font-size: 12.5px; line-height: 1.25; text-align: center;
      color: var(--text); word-break: break-word;
      max-height: 2.6em; overflow: hidden; width: 100%;
    }

    /* --- список --- */
    .fnd-list { padding: 4px 10px 12px; }
    .fnd-lhead, .fnd-lrow {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 178px 108px;
      gap: 12px; align-items: center;
    }
    .fnd-lhead {
      position: sticky; top: 0; z-index: 1;
      padding: 7px 10px 6px;
      font-size: 11px; font-weight: 700; letter-spacing: .3px;
      text-transform: uppercase; color: var(--text-3);
      background: var(--content-bg);
      border-bottom: 1px solid var(--divider);
    }
    .fnd-lrow {
      padding: 5.5px 10px; border-radius: 7px;
      font-size: 13px; user-select: none; cursor: default;
    }
    .fnd-lrow:hover { background: var(--hover); }
    .fnd-lrow.sel { background: var(--accent); color: var(--on-accent); }
    .fnd-lrow .fnd-dim { color: var(--text-2); font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .fnd-lrow.sel .fnd-dim { color: inherit; opacity: .8; }
    .fnd-lname { display: flex; align-items: center; gap: 9px; min-width: 0; }
    .fnd-lname svg { width: 21px; height: 21px; flex: none; }
    .fnd-lname > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    /* --- переименование --- */
    .fnd-ren {
      width: 100%; box-sizing: border-box;
      padding: 2px 6px; font-size: 12.5px;
      text-align: center;
    }
    .fnd-lname .fnd-ren { text-align: left; }

    /* --- строка статуса --- */
    .fnd-status {
      flex: none; padding: 5px 14px;
      border-top: 1px solid var(--divider);
      font-size: 11.5px; color: var(--text-3);
      text-align: center; white-space: nowrap;
      overflow: hidden; text-overflow: ellipsis;
    }
  `);

  /* ============================================================ */

  function render(win, ctx) {
    const vfs = OS.vfs;
    const esc = OS.esc;

    const st = {
      cwd: '/Documents',
      hist: [], hi: -1,
      view: OS.settings.get('finderView', 'grid'),
      sel: new Set(),
      q: '',
      shown: [],
      renaming: false,
    };
    win._fnd = st;

    /* стартовый путь */
    const argPath = ctx && ctx.args && ctx.args.path;
    if (argPath && vfs.exists(argPath)) {
      const s = vfs.stat(argPath);
      st.cwd = s.type === 'dir' ? vfs.normalize(argPath) : vfs.parentOf(argPath);
    }

    /* ---------- каркас ---------- */
    win.content.innerHTML = `
      <div class="fnd-root">
        <div class="ui-toolbar fnd-toolbar">
          <div class="fnd-nav">
            <button class="ui-btn icon-only fnd-back" title="Назад">${OS.icons.chevronL}</button>
            <button class="ui-btn icon-only fnd-fwd" title="Вперёд">${OS.icons.chevronR}</button>
          </div>
          <div class="fnd-crumbs"></div>
          <button class="ui-btn fnd-empty-trash hidden">Очистить корзину</button>
          <input class="ui-input fnd-search" type="text" placeholder="Поиск" spellcheck="false">
          <div class="ui-seg fnd-seg">
            <button class="seg-btn fnd-seg-grid" title="Сетка">${OS.icons.grid}</button>
            <button class="seg-btn fnd-seg-list" title="Список">${SIDE.listGlyph}</button>
          </div>
        </div>
        <div class="fnd-body">
          <div class="ui-sidebar fnd-side"></div>
          <div class="fnd-main" tabindex="0"></div>
        </div>
        <div class="fnd-status"></div>
      </div>`;

    const root = win.content.querySelector('.fnd-root');
    const btnBack = root.querySelector('.fnd-back');
    const btnFwd = root.querySelector('.fnd-fwd');
    const crumbsEl = root.querySelector('.fnd-crumbs');
    const btnEmptyTrash = root.querySelector('.fnd-empty-trash');
    const searchEl = root.querySelector('.fnd-search');
    const segGrid = root.querySelector('.fnd-seg-grid');
    const segList = root.querySelector('.fnd-seg-list');
    const sideEl = root.querySelector('.fnd-side');
    const mainEl = root.querySelector('.fnd-main');
    const statusEl = root.querySelector('.fnd-status');

    const inTrash = () => st.cwd === '/Trash' || st.cwd.startsWith('/Trash/');
    const firstSel = () => st.sel.values().next().value;

    /* ---------- навигация ---------- */
    function goTo(path, push) {
      path = vfs.normalize(path);
      if (!vfs.exists(path)) { OS.dialog.alert('Файлы', 'Нет такого пути: ' + path); return; }
      st.cwd = path;
      st.sel.clear();
      st.q = '';
      searchEl.value = '';
      if (push !== false) {
        st.hist = st.hist.slice(0, st.hi + 1);
        st.hist.push(path);
        st.hi = st.hist.length - 1;
      }
      refresh();
    }
    function goBack() { if (st.hi > 0) { st.hi--; st.cwd = st.hist[st.hi]; st.sel.clear(); st.q = ''; searchEl.value = ''; refresh(); } }
    function goFwd() { if (st.hi < st.hist.length - 1) { st.hi++; st.cwd = st.hist[st.hi]; st.sel.clear(); st.q = ''; searchEl.value = ''; refresh(); } }

    /* ---------- отрисовка ---------- */
    function renderCrumbs() {
      const parts = st.cwd.split('/').filter(Boolean);
      let html = `<span class="fnd-crumb${parts.length ? '' : ' cur'}" data-path="/">hinomaOS</span>`;
      let acc = '';
      parts.forEach((p, i) => {
        acc += '/' + p;
        const cur = i === parts.length - 1;
        html += `<span class="fnd-crumb-sep">›</span>`;
        html += `<span class="fnd-crumb${cur ? ' cur' : ''}" data-path="${esc(acc)}">${esc(dispName(acc))}</span>`;
      });
      crumbsEl.innerHTML = html;
    }

    function renderSidebar() {
      let html = `<div class="ui-side-title">Избранное</div>`;
      for (const f of FAVS) {
        html += `<div class="ui-side-item${st.cwd === f.path ? ' on' : ''}" data-path="${esc(f.path)}">${f.icon}<span>${esc(f.label)}</span></div>`;
      }
      const tc = vfs.trashCount();
      html += `<div class="fnd-side-gap"></div><div class="ui-side-title">Система</div>`;
      html += `<div class="ui-side-item${inTrash() ? ' on' : ''}" data-path="/Trash">${SIDE.trash}<span>Корзина${tc ? ` (${tc})` : ''}</span></div>`;
      sideEl.innerHTML = html;
    }

    function renderView() {
      let items = [];
      try { items = vfs.list(st.cwd); } catch (e) { items = []; }
      if (st.q) {
        const q = st.q.toLowerCase();
        items = items.filter(i => i.name.toLowerCase().includes(q));
      }
      st.shown = items;
      for (const p of Array.from(st.sel)) {
        if (!items.some(i => i.path === p)) st.sel.delete(p);
      }

      if (!items.length) {
        const msg = st.q ? 'Ничего не найдено' : (inTrash() ? 'Корзина пуста' : 'Папка пуста');
        mainEl.innerHTML = `<div class="ui-empty">${inTrash() ? OS.icons.trashEmpty : OS.icons.folder}<div>${msg}</div></div>`;
        return;
      }

      if (st.view === 'grid') {
        let html = `<div class="fnd-grid">`;
        for (const it of items) {
          html += `<div class="fnd-item fnd-gitem${st.sel.has(it.path) ? ' sel' : ''}" data-path="${esc(it.path)}" data-type="${it.type}">
            <div class="fnd-ico">${OS.fileIcon(it)}</div>
            <div class="fnd-name">${esc(it.name)}</div>
          </div>`;
        }
        mainEl.innerHTML = html + `</div>`;
      } else {
        let html = `<div class="fnd-list">
          <div class="fnd-lhead"><div>Имя</div><div>Дата изменения</div><div>Размер</div></div>`;
        for (const it of items) {
          const size = it.type === 'dir' ? objWord(it.size) : OS.fmtBytes(it.size);
          html += `<div class="fnd-item fnd-lrow${st.sel.has(it.path) ? ' sel' : ''}" data-path="${esc(it.path)}" data-type="${it.type}">
            <div class="fnd-lname">${OS.fileIcon(it)}<span class="fnd-name">${esc(it.name)}</span></div>
            <div class="fnd-dim">${esc(OS.fmtDate(it.modified))}</div>
            <div class="fnd-dim">${esc(size)}</div>
          </div>`;
        }
        mainEl.innerHTML = html + `</div>`;
      }
    }

    function applySel() {
      mainEl.querySelectorAll('.fnd-item').forEach(n => n.classList.toggle('sel', st.sel.has(n.dataset.path)));
    }

    function updateStatus() {
      let text = objWord(st.shown.length);
      if (st.sel.size) text += ` · выбрано ${st.sel.size}`;
      if (clip.paths.length) text += ` · в буфере: ${clip.paths.length}`;
      statusEl.textContent = text;
    }

    function updateChrome() {
      btnBack.disabled = st.hi <= 0;
      btnFwd.disabled = st.hi >= st.hist.length - 1;
      segGrid.classList.toggle('on', st.view === 'grid');
      segList.classList.toggle('on', st.view === 'list');
      const t = inTrash();
      btnEmptyTrash.classList.toggle('hidden', !t);
      btnEmptyTrash.disabled = vfs.trashCount() === 0;
      win.setTitle(dispName(st.cwd) + ' — Файлы');
    }

    function refresh() {
      renderCrumbs();
      renderSidebar();
      renderView();
      updateStatus();
      updateChrome();
    }

    /* ---------- операции ---------- */
    function openItem(it) {
      if (it.type === 'dir') goTo(it.path);
      else OS.openFile(it.path);
    }
    function openSelection() {
      const items = st.shown.filter(i => st.sel.has(i.path));
      if (items.length === 1) { openItem(items[0]); return; }
      for (const it of items) OS.openFile(it.path);
    }

    function newFolder() {
      if (inTrash()) return;
      try {
        const name = vfs.uniqueName(st.cwd, 'Новая папка');
        const p = vfs.mkdir(vfs.join(st.cwd, name));
        st.sel = new Set([p]);
        refresh();
        startRename(p);
      } catch (e) { OS.dialog.alert('Файлы', e.message); }
    }
    function newDoc() {
      if (inTrash()) return;
      try {
        const name = vfs.uniqueName(st.cwd, 'Новый документ.txt');
        const p = vfs.write(vfs.join(st.cwd, name), '');
        st.sel = new Set([p]);
        refresh();
        startRename(p);
      } catch (e) { OS.dialog.alert('Файлы', e.message); }
    }

    function copySelection(mode) {
      if (!st.sel.size) return;
      clip.mode = mode;
      clip.paths = Array.from(st.sel);
      updateStatus();
    }

    function pasteHere() {
      if (!clip.paths.length || inTrash()) return;
      for (const p of clip.paths) {
        if (!vfs.exists(p)) continue;
        if (clip.mode === 'cut' && vfs.parentOf(p) === st.cwd) continue;
        try {
          const dest = vfs.join(st.cwd, vfs.uniqueName(st.cwd, vfs.nameOf(p)));
          if (clip.mode === 'cut') vfs.mv(p, dest);
          else vfs.cp(p, dest);
        } catch (e) { OS.dialog.alert('Файлы', e.message); }
      }
      if (clip.mode === 'cut') { clip.mode = null; clip.paths = []; }
      refresh();
    }

    function duplicateSelection() {
      for (const p of Array.from(st.sel)) {
        if (!vfs.exists(p)) continue;
        try {
          const name = vfs.nameOf(p);
          const dot = name.lastIndexOf('.');
          const base = dot > 0 ? `${name.slice(0, dot)} копия${name.slice(dot)}` : `${name} копия`;
          const dir = vfs.parentOf(p);
          vfs.cp(p, vfs.join(dir, vfs.uniqueName(dir, base)));
        } catch (e) { OS.dialog.alert('Файлы', e.message); }
      }
      refresh();
    }

    function trashSelection() {
      for (const p of Array.from(st.sel)) {
        try { vfs.rm(p, { toTrash: true }); } catch (e) { OS.dialog.alert('Файлы', e.message); }
      }
      st.sel.clear();
      refresh();
    }

    async function deleteForever() {
      const n = st.sel.size;
      if (!n) return;
      const ok = await OS.dialog.confirm('Удалить навсегда?',
        `${plural(n, 'Объект будет удалён', 'Объекта будут удалены', 'Объектов будет удалено')}: ${n}. Это действие нельзя отменить.`,
        { okLabel: 'Удалить', danger: true });
      if (!ok) return;
      for (const p of Array.from(st.sel)) {
        try { vfs.rm(p); } catch (e) { OS.dialog.alert('Файлы', e.message); }
      }
      st.sel.clear();
      refresh();
    }

    function restoreSelection() {
      for (const p of Array.from(st.sel)) {
        try { vfs.restore(p); } catch (e) { OS.dialog.alert('Файлы', e.message); }
      }
      st.sel.clear();
      refresh();
    }

    async function emptyTrash() {
      const n = vfs.trashCount();
      if (!n) return;
      const ok = await OS.dialog.confirm('Очистить корзину?',
        `Безвозвратно удалить все объекты (${n}) из корзины?`,
        { okLabel: 'Очистить', danger: true });
      if (ok) { vfs.emptyTrash(); refresh(); }
    }

    function setView(v) {
      st.view = v;
      OS.settings.set('finderView', v);
      renderView();
      updateChrome();
      updateStatus();
    }

    /* ---------- инлайн-переименование ---------- */
    function startRename(path) {
      const item = mainEl.querySelector(`.fnd-item[data-path="${CSS.escape(path)}"]`);
      if (!item) return;
      const nameEl = item.querySelector('.fnd-name');
      if (!nameEl) return;
      const old = vfs.nameOf(path);
      st.renaming = true;
      nameEl.innerHTML = '';
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.spellcheck = false;
      inp.className = 'ui-input fnd-ren';
      inp.value = old;
      nameEl.appendChild(inp);
      inp.focus();
      const dot = old.lastIndexOf('.');
      try { inp.setSelectionRange(0, dot > 0 ? dot : old.length); } catch (e) { /* ок */ }

      let done = false;
      const finish = (commit) => {
        if (done) return;
        done = true;
        st.renaming = false;
        const nn = inp.value.trim();
        if (commit && nn && nn !== old && !nn.includes('/')) {
          try {
            const dest = vfs.join(vfs.parentOf(path), nn);
            vfs.mv(path, dest);
            st.sel.delete(path);
            st.sel.add(dest);
          } catch (e) { OS.dialog.alert('Файлы', e.message); }
        }
        refresh();
        mainEl.focus();
      };
      inp.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') finish(true);
        else if (e.key === 'Escape') finish(false);
      });
      inp.addEventListener('blur', () => finish(true));
      inp.addEventListener('pointerdown', (e) => e.stopPropagation());
      inp.addEventListener('click', (e) => e.stopPropagation());
      inp.addEventListener('dblclick', (e) => e.stopPropagation());
    }

    /* ---------- контекстные меню ---------- */
    function itemMenu(e) {
      const single = st.sel.size === 1;
      const items = st.shown.filter(i => st.sel.has(i.path));
      if (inTrash()) {
        const canRestore = items.some(i => i.meta && i.meta.origPath);
        OS.contextMenu([
          { label: 'Открыть', action: openSelection },
          { sep: true },
          { label: 'Восстановить', disabled: !canRestore, action: restoreSelection },
          { label: 'Удалить навсегда', hotkey: 'Del', action: deleteForever },
        ], e.clientX, e.clientY);
        return;
      }
      OS.contextMenu([
        { label: 'Открыть', action: openSelection },
        { sep: true },
        { label: 'Переименовать', hotkey: 'F2', disabled: !single, action: () => startRename(firstSel()) },
        { label: 'Дублировать', action: duplicateSelection },
        { sep: true },
        { label: 'Копировать', hotkey: 'Ctrl+C', action: () => copySelection('copy') },
        { label: 'Вырезать', hotkey: 'Ctrl+X', action: () => copySelection('cut') },
        { sep: true },
        { label: 'Переместить в корзину', hotkey: 'Del', action: trashSelection },
      ], e.clientX, e.clientY);
    }

    function emptyMenu(e) {
      if (inTrash()) {
        OS.contextMenu([
          { label: 'Очистить корзину', disabled: vfs.trashCount() === 0, action: emptyTrash },
          { sep: true },
          { label: 'Обновить', action: refresh },
        ], e.clientX, e.clientY);
        return;
      }
      OS.contextMenu([
        { label: 'Новая папка', hotkey: 'Ctrl+Shift+N', action: newFolder },
        { label: 'Новый документ', action: newDoc },
        { sep: true },
        { label: 'Вставить', hotkey: 'Ctrl+V', disabled: !clip.paths.length, action: pasteHere },
        { sep: true },
        { label: 'Обновить', action: refresh },
      ], e.clientX, e.clientY);
    }

    /* ---------- события ---------- */
    btnBack.addEventListener('click', goBack);
    btnFwd.addEventListener('click', goFwd);
    btnEmptyTrash.addEventListener('click', emptyTrash);
    segGrid.addEventListener('click', () => setView('grid'));
    segList.addEventListener('click', () => setView('list'));

    searchEl.addEventListener('input', () => {
      st.q = searchEl.value.trim();
      renderView();
      updateStatus();
    });
    searchEl.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { searchEl.value = ''; st.q = ''; renderView(); updateStatus(); mainEl.focus(); }
      e.stopPropagation();
    });

    crumbsEl.addEventListener('click', (e) => {
      const c = e.target.closest('.fnd-crumb');
      if (c && c.dataset.path !== st.cwd) goTo(c.dataset.path);
    });

    sideEl.addEventListener('click', (e) => {
      const it = e.target.closest('.ui-side-item');
      if (it && it.dataset.path !== st.cwd) goTo(it.dataset.path);
    });

    mainEl.addEventListener('click', (e) => {
      if (e.target.closest('.fnd-ren')) return;
      const item = e.target.closest('.fnd-item');
      if (!item) { st.sel.clear(); applySel(); updateStatus(); return; }
      const p = item.dataset.path;
      if (e.ctrlKey || e.metaKey) {
        if (st.sel.has(p)) st.sel.delete(p); else st.sel.add(p);
      } else {
        st.sel.clear();
        st.sel.add(p);
      }
      applySel();
      updateStatus();
    });

    mainEl.addEventListener('dblclick', (e) => {
      if (e.target.closest('.fnd-ren')) return;
      const item = e.target.closest('.fnd-item');
      if (!item) return;
      const it = st.shown.find(i => i.path === item.dataset.path);
      if (it) openItem(it);
    });

    mainEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (e.target.closest('.fnd-ren')) return;
      const item = e.target.closest('.fnd-item');
      if (item) {
        const p = item.dataset.path;
        if (!st.sel.has(p)) { st.sel.clear(); st.sel.add(p); applySel(); updateStatus(); }
        itemMenu(e);
      } else {
        emptyMenu(e);
      }
    });

    mainEl.addEventListener('keydown', (e) => {
      if (st.renaming) return;
      const k = e.key.toLowerCase();
      if (e.ctrlKey || e.metaKey) {
        if (k === 'c') { e.preventDefault(); copySelection('copy'); }
        else if (k === 'x') { e.preventDefault(); if (!inTrash()) copySelection('cut'); }
        else if (k === 'v') { e.preventDefault(); pasteHere(); }
        else if (k === 'a') {
          e.preventDefault();
          st.sel = new Set(st.shown.map(i => i.path));
          applySel();
          updateStatus();
        }
      } else if (e.key === 'F2') {
        e.preventDefault();
        if (st.sel.size === 1) startRename(firstSel());
      } else if (e.key === 'Delete') {
        e.preventDefault();
        if (!st.sel.size) return;
        if (inTrash()) deleteForever(); else trashSelection();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (st.sel.size) openSelection();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        if (st.cwd !== '/') goTo(vfs.parentOf(st.cwd));
      }
    });

    /* ---------- vfs:change с debounce ---------- */
    const onVfsChange = OS.debounce(() => {
      if (st.renaming) return;
      if (!vfs.exists(st.cwd)) { goTo('/'); return; }
      refresh();
    }, 120);
    const unVfs = OS.on('vfs:change', onVfsChange);
    win.on('close', () => unVfs());

    /* API для menus(win) */
    st.api = { newFolder, newDoc, setView };

    /* старт */
    goTo(st.cwd, true);
    setTimeout(() => mainEl.focus(), 0);
  }

  /* ---------- регистрация ---------- */
  OS.registerApp({
    id: 'finder',
    name: 'Файлы',
    icon: ICON,
    width: 900, height: 560,
    minWidth: 560, minHeight: 360,
    singleton: false,
    render,
    menus(win) {
      const st = win._fnd || {};
      const api = st.api || {};
      return [
        {
          title: 'Файл',
          items: [
            { label: 'Новая папка', hotkey: 'Ctrl+Shift+N', action: () => api.newFolder && api.newFolder() },
            { label: 'Новый документ', action: () => api.newDoc && api.newDoc() },
            { sep: true },
            { label: 'Новое окно', hotkey: 'Ctrl+N', action: () => OS.launch('finder', { path: st.cwd || '/Documents' }) },
            { sep: true },
            { label: 'Закрыть', hotkey: 'Ctrl+W', action: () => win.close() },
          ],
        },
        {
          title: 'Вид',
          items: [
            { label: 'Сетка', checked: st.view === 'grid', action: () => api.setView && api.setView('grid') },
            { label: 'Список', checked: st.view === 'list', action: () => api.setView && api.setView('list') },
          ],
        },
      ];
    },
  });
})();
