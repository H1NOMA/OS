/* «Заметки» — текстовый редактор Hiko OS */
(function () {
  'use strict';

  /* ---------- иконка приложения: карандаш и линии текста ---------- */
  const GLYPH = `
    <g stroke="#fff" stroke-width="7" stroke-linecap="round" fill="none">
      <path d="M -34 -24 L 6 -24"/>
      <path d="M -34 -8 L -2 -8"/>
      <path d="M -34 8 L -10 8"/>
      <path d="M -34 24 L -16 24"/>
    </g>
    <g transform="translate(15 2) rotate(45)">
      <rect x="-8" y="-33" width="16" height="8" rx="3.5" fill="#fff"/>
      <rect x="-8" y="-21.5" width="16" height="36" rx="3" fill="#fff"/>
      <path d="M -8 17 L 0 30 L 8 17 Z" fill="#fff"/>
    </g>`;
  const ICON = OS.appTile({ from: '#FFD75E', to: '#FF9F0A' }, GLYPH);

  /* ---------- маленькие глифы тулбара (currentColor) ---------- */
  const I = {
    newDoc: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-6"/><path d="M18.4 3.6a2 2 0 0 1 2.8 2.8L13 14.6l-4 1 1-4z"/></svg>`,
    open: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`,
    save: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v10"/><path d="M8 9.5l4 4 4-4"/><path d="M4 16.5V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.5"/></svg>`,
    saveAs: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3v9"/><path d="M6 8.5l4 4 4-4"/><path d="M4 16.5V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.5"/><path d="M19 3v6M16 6h6"/></svg>`,
    close: `<svg viewBox="0 0 100 100"><path d="M 28 28 L 72 72 M 72 28 L 28 72" stroke="currentColor" stroke-width="11" stroke-linecap="round" fill="none"/></svg>`,
  };

  const TEXT_EXTS = ['txt', 'md', 'json', 'js', 'css', 'html', 'csv', 'log', 'xml', 'sh'];
  const MONO_EXTS = ['json', 'js', 'css', 'html', 'csv', 'log', 'xml', 'sh'];
  const extOf = (p) => (p ? (OS.vfs.nameOf(p).split('.').pop() || '').toLowerCase() : '');

  function plural(n, one, few, many) {
    const m = Math.abs(n) % 100, d = m % 10;
    if (m > 10 && m < 20) return many;
    if (d === 1) return one;
    if (d >= 2 && d <= 4) return few;
    return many;
  }

  /* ---------- мини-рендерер Markdown (экранирование ДО разметки) ---------- */
  function mdToHtml(src) {
    const stash = [];
    const inline = (s) => {
      s = OS.esc(s);
      s = s.replace(/`([^`]+)`/g, (m, c) => {
        stash.push('<code>' + c + '</code>');
        return '\u0000' + (stash.length - 1) + '\u0000';
      });
      s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
      s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<span class="te-md-link">$1</span>');
      s = s.replace(/\u0000(\d+)\u0000/g, (m, i) => stash[+i]);
      return s;
    };
    const out = [];
    let para = [], list = null, quote = [], code = null;
    const flushPara = () => { if (para.length) { out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; } };
    const flushList = () => { if (list) { out.push('<ul>' + list.map((x) => '<li>' + inline(x) + '</li>').join('') + '</ul>'); list = null; } };
    const flushQuote = () => { if (quote.length) { out.push('<blockquote>' + quote.map(inline).join('<br>') + '</blockquote>'); quote = []; } };
    const flushAll = () => { flushPara(); flushList(); flushQuote(); };

    for (const line of String(src).split('\n')) {
      if (code !== null) {
        if (/^```/.test(line.trim())) { out.push('<pre>' + OS.esc(code.join('\n')) + '</pre>'); code = null; }
        else code.push(line);
        continue;
      }
      if (/^```/.test(line.trim())) { flushAll(); code = []; continue; }
      let m;
      if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
        flushAll();
        const lvl = Math.min(m[1].length, 6);
        out.push('<h' + lvl + '>' + inline(m[2]) + '</h' + lvl + '>');
      } else if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        flushAll();
        out.push('<hr>');
      } else if ((m = line.match(/^>\s?(.*)$/))) {
        flushPara(); flushList();
        quote.push(m[1]);
      } else if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
        flushPara(); flushQuote();
        (list = list || []).push(m[1]);
      } else if (/^\s*$/.test(line)) {
        flushAll();
      } else {
        flushList(); flushQuote();
        para.push(line);
      }
    }
    if (code !== null) out.push('<pre>' + OS.esc(code.join('\n')) + '</pre>');
    flushAll();
    return out.join('\n') || '<p class="te-md-hint">Пусто. Начните писать в режиме «Правка».</p>';
  }

  /* ---------- стили ---------- */
  OS.injectStyle('app-textedit', `
    .te-root { display: flex; flex-direction: column; flex: 1; min-height: 0; position: relative; background: var(--content-bg); }
    .te-bar { flex-wrap: nowrap; }
    .te-sep { width: 1px; height: 18px; background: var(--divider); margin: 0 3px; flex: none; }
    .te-count { margin-left: auto; padding-left: 10px; font-size: 12px; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
    .te-count.flash { color: var(--accent); font-weight: 600; }
    .te-seg { display: none; flex: none; }
    .te-seg.show { display: inline-flex; }
    .te-body { flex: 1; min-height: 0; display: flex; }
    .te-editor { flex: 1; min-width: 0; border: none; outline: none; resize: none; background: var(--content-bg); color: var(--text); padding: 14px 18px; font: 14px/1.6 var(--font); tab-size: 2; }
    .te-editor.mono { font: 13px/1.6 var(--font-mono); }
    .te-root.preview .te-editor { display: none; }
    .te-preview { display: none; flex: 1; min-width: 0; overflow-y: auto; padding: 18px 24px 28px; font: 14px/1.65 var(--font); color: var(--text); }
    .te-root.preview .te-preview { display: block; }
    .te-preview h1 { font-size: 23px; font-weight: 800; letter-spacing: -.3px; margin: 16px 0 8px; }
    .te-preview h2 { font-size: 19px; font-weight: 700; margin: 14px 0 7px; }
    .te-preview h3 { font-size: 16px; font-weight: 700; margin: 12px 0 6px; }
    .te-preview h4, .te-preview h5, .te-preview h6 { font-size: 14px; font-weight: 700; margin: 10px 0 5px; }
    .te-preview :first-child { margin-top: 0; }
    .te-preview p { margin: 0 0 10px; }
    .te-preview ul { margin: 0 0 10px; padding-left: 24px; }
    .te-preview li { margin: 2.5px 0; }
    .te-preview blockquote { margin: 0 0 10px; padding: 2px 0 2px 12px; border-left: 3px solid var(--accent); color: var(--text-2); }
    .te-preview code { font-family: var(--font-mono); font-size: .88em; background: var(--ctl-bg); border-radius: 4px; padding: 1.5px 5px; }
    .te-preview pre { margin: 0 0 10px; padding: 10px 12px; background: var(--ctl-bg); border-radius: 8px; overflow-x: auto; font: 12.5px/1.55 var(--font-mono); }
    .te-preview hr { border: none; border-top: 1px solid var(--divider); margin: 14px 0; }
    .te-md-link { color: var(--accent); text-decoration: underline; text-underline-offset: 2px; }
    .te-md-hint { color: var(--text-3); }
    .te-modal { position: absolute; inset: 0; z-index: 40; background: rgba(0,0,0,.28); display: flex; align-items: center; justify-content: center; outline: none; }
    .te-panel { width: min(480px, calc(100% - 36px)); height: min(430px, calc(100% - 36px)); background: var(--content-bg); border: 1px solid var(--divider); border-radius: 12px; box-shadow: 0 18px 50px rgba(0,0,0,.35); display: flex; flex-direction: column; overflow: hidden; }
    .te-p-head { display: flex; align-items: center; gap: 8px; padding: 9px 10px; border-bottom: 1px solid var(--divider); flex: none; }
    .te-p-title { flex: 1; text-align: center; font-size: 13.5px; font-weight: 700; }
    .te-p-places { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-bottom: 1px solid var(--divider); flex: none; flex-wrap: wrap; }
    .te-p-path { flex: 1; min-width: 90px; text-align: right; font: 11.5px var(--font-mono); color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; direction: rtl; }
    .te-p-list { flex: 1; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; }
    .te-p-list .ui-list-row { flex: none; }
    .te-p-list .ui-list-row svg { width: 20px; height: 20px; flex: none; }
    .te-row-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .te-row-meta { flex: none; font-size: 11.5px; color: var(--text-3); font-variant-numeric: tabular-nums; }
    .te-p-list .ui-empty { min-height: 120px; }
  `);

  /* ---------- регистрация ---------- */
  OS.registerApp({
    id: 'textedit',
    name: 'Заметки',
    icon: ICON,
    width: 760,
    height: 540,
    minWidth: 420,
    minHeight: 300,
    singleton: false,

    render(win, ctx) {
      let path = null;      // текущий путь файла или null
      let dirty = false;    // есть несохранённые изменения
      let mode = 'edit';    // 'edit' | 'preview' (только для .md)

      win.content.innerHTML = `
        <div class="te-root">
          <div class="ui-toolbar te-bar">
            <button class="ui-btn icon-only te-b-new" title="Создать (Ctrl+N)">${I.newDoc}</button>
            <button class="ui-btn icon-only te-b-open" title="Открыть… (Ctrl+O)">${I.open}</button>
            <div class="te-sep"></div>
            <button class="ui-btn icon-only te-b-save" title="Сохранить (Ctrl+S)">${I.save}</button>
            <button class="ui-btn icon-only te-b-saveas" title="Сохранить как… (Ctrl+Shift+S)">${I.saveAs}</button>
            <div class="ui-seg te-seg">
              <button class="seg-btn on" data-mode="edit">Правка</button>
              <button class="seg-btn" data-mode="preview">Просмотр</button>
            </div>
            <div class="te-count"></div>
          </div>
          <div class="te-body">
            <textarea class="te-editor" spellcheck="false" placeholder="Начните писать…"></textarea>
            <div class="te-preview"></div>
          </div>
        </div>`;

      const root = win.content.querySelector('.te-root');
      const ta = root.querySelector('.te-editor');
      const preview = root.querySelector('.te-preview');
      const seg = root.querySelector('.te-seg');
      const countEl = root.querySelector('.te-count');

      const docName = () => (path ? OS.vfs.nameOf(path) : 'Без имени');

      let flashTimer = null;
      function updateCount(flashText) {
        if (flashTimer) { clearTimeout(flashTimer); flashTimer = null; }
        if (flashText) {
          countEl.textContent = flashText;
          countEl.classList.add('flash');
          flashTimer = setTimeout(() => { countEl.classList.remove('flash'); updateCount(); }, 1400);
          return;
        }
        countEl.classList.remove('flash');
        const text = ta.value;
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const chars = text.length;
        countEl.textContent =
          words + ' ' + plural(words, 'слово', 'слова', 'слов') + ' · ' +
          chars + ' ' + plural(chars, 'символ', 'символа', 'символов');
      }

      function refreshUI() {
        win.setTitle(docName() + (dirty ? ' *' : ''));
        const ext = extOf(path);
        ta.classList.toggle('mono', MONO_EXTS.includes(ext));
        const isMd = ext === 'md';
        seg.classList.toggle('show', isMd);
        if (!isMd && mode !== 'edit') setMode('edit');
        updateCount();
      }

      function setMode(m) {
        mode = m;
        seg.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
        root.classList.toggle('preview', m === 'preview');
        if (m === 'preview') preview.innerHTML = mdToHtml(ta.value);
        else ta.focus();
      }

      function setDoc(p, content) {
        path = p;
        ta.value = content || '';
        dirty = false;
        setMode('edit');
        refreshUI();
        ta.focus();
      }

      /* --- сохранение --- */
      function writeTo(target) {
        try {
          OS.vfs.write(target, ta.value);
        } catch (e) {
          OS.dialog.alert('Ошибка сохранения', e && e.message ? e.message : String(e));
          return false;
        }
        path = target;
        dirty = false;
        refreshUI();
        updateCount('Сохранено ✓');
        return true;
      }

      async function saveAs() {
        let name = await OS.dialog.prompt('Сохранить как', 'Имя файла (папка «Документы»):', docName() + (path ? '' : '.txt'));
        if (name === null) return false;
        name = name.trim().replace(/\//g, '');
        if (!name) return false;
        if (!/\.[A-Za-z0-9]+$/.test(name)) name += '.txt';
        const target = '/Documents/' + name;
        if (target !== path && OS.vfs.exists(target)) {
          const ok = await OS.dialog.confirm('Файл уже существует', 'Заменить «' + name + '»?', { okLabel: 'Заменить', danger: true });
          if (!ok) return false;
        }
        return writeTo(target);
      }

      async function save() {
        return path ? writeTo(path) : saveAs();
      }

      /* --- несохранённые изменения --- */
      async function ensureSaved() {
        if (!dirty) return true;
        const wantSave = await OS.dialog.confirm('Несохранённые изменения', 'Сохранить изменения в «' + docName() + '»?', { okLabel: 'Сохранить' });
        if (wantSave) return await save();
        const discard = await OS.dialog.confirm('Не сохранять?', 'Изменения будут потеряны без возможности восстановления.', { okLabel: 'Не сохранять', danger: true });
        return discard; // Отмена → false, остаёмся
      }

      /* --- открытие --- */
      function loadPath(p) {
        try {
          const content = OS.vfs.read(p);
          setDoc(p, content);
        } catch (e) {
          OS.dialog.alert('Не удалось открыть файл', e && e.message ? e.message : String(e));
        }
      }

      async function newDoc() {
        if (!(await ensureSaved())) return;
        setDoc(null, '');
      }

      /* --- мини-браузер файлов --- */
      async function openDialog() {
        if (!(await ensureSaved())) return;
        const old = root.querySelector('.te-modal');
        if (old) old.remove();

        let dir = '/Documents';
        const overlay = OS.el('div', 'te-modal');
        overlay.tabIndex = -1;
        overlay.innerHTML = `
          <div class="te-panel">
            <div class="te-p-head">
              <button class="ui-btn icon-only te-back" title="Наверх">${OS.icons.chevronL}</button>
              <div class="te-p-title">Открыть файл</div>
              <button class="ui-btn icon-only te-x" title="Закрыть">${I.close}</button>
            </div>
            <div class="te-p-places">
              <div class="ui-seg">
                <button class="seg-btn" data-root="/Documents">Документы</button>
                <button class="seg-btn" data-root="/Desktop">Рабочий стол</button>
                <button class="seg-btn" data-root="/Downloads">Загрузки</button>
              </div>
              <div class="te-p-path"></div>
            </div>
            <div class="te-p-list"></div>
          </div>`;

        const listEl = overlay.querySelector('.te-p-list');
        const pathEl = overlay.querySelector('.te-p-path');
        const backBtn = overlay.querySelector('.te-back');
        const closeModal = () => overlay.remove();

        function renderList() {
          pathEl.textContent = dir;
          backBtn.disabled = dir === '/';
          overlay.querySelectorAll('.seg-btn[data-root]').forEach((b) => {
            const r = b.dataset.root;
            b.classList.toggle('on', dir === r || dir.indexOf(r + '/') === 0);
          });
          let items = [];
          try { items = OS.vfs.list(dir); } catch (e) { items = []; }
          items = items.filter((it) => {
            if (it.type === 'dir') return true;
            const ext = (it.name.split('.').pop() || '').toLowerCase();
            return it.name.indexOf('.') === -1 || TEXT_EXTS.includes(ext);
          });
          if (!items.length) {
            listEl.innerHTML = `<div class="ui-empty">${OS.icons.fileText}<div>Здесь нет текстовых файлов</div></div>`;
            return;
          }
          listEl.innerHTML = items.map((it) => `
            <div class="ui-list-row" data-path="${OS.esc(it.path)}" data-type="${it.type}">
              ${OS.fileIcon(it)}
              <span class="te-row-name">${OS.esc(it.name)}</span>
              <span class="te-row-meta">${it.type === 'dir' ? '›' : OS.fmtBytes(it.size || 0)}</span>
            </div>`).join('');
          listEl.querySelectorAll('.ui-list-row').forEach((row) => {
            row.addEventListener('click', () => {
              if (row.dataset.type === 'dir') { dir = row.dataset.path; renderList(); }
              else { closeModal(); loadPath(row.dataset.path); }
            });
          });
        }

        backBtn.addEventListener('click', () => { if (dir !== '/') { dir = OS.vfs.parentOf(dir); renderList(); } });
        overlay.querySelector('.te-x').addEventListener('click', closeModal);
        overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) closeModal(); });
        overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeModal(); } });
        overlay.querySelectorAll('.seg-btn[data-root]').forEach((b) => {
          b.addEventListener('click', () => { dir = b.dataset.root; renderList(); });
        });

        renderList();
        root.appendChild(overlay);
        overlay.focus();
      }

      /* --- события редактора --- */
      ta.addEventListener('input', () => {
        if (!dirty) { dirty = true; win.setTitle(docName() + ' *'); }
        debouncedCount();
      });
      const debouncedCount = OS.debounce(() => updateCount(), 150);

      ta.addEventListener('keydown', (e) => {
        if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
          e.preventDefault();
          let ok = false;
          try { ok = document.execCommand('insertText', false, '  '); } catch (err) { ok = false; }
          if (!ok) {
            ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end');
            if (!dirty) { dirty = true; win.setTitle(docName() + ' *'); }
            debouncedCount();
          }
        }
      });

      root.addEventListener('keydown', (e) => {
        if (!(e.ctrlKey || e.metaKey)) return;
        const k = e.key.toLowerCase();
        if (k === 's') {
          e.preventDefault(); e.stopPropagation();
          if (e.shiftKey) saveAs(); else save();
        } else if (k === 'o' && !e.shiftKey) {
          e.preventDefault(); e.stopPropagation();
          openDialog();
        } else if (k === 'n' && !e.shiftKey && !e.altKey) {
          e.preventDefault(); e.stopPropagation();
          newDoc();
        }
      });

      seg.querySelectorAll('.seg-btn').forEach((b) => {
        b.addEventListener('click', () => setMode(b.dataset.mode));
      });
      root.querySelector('.te-b-new').addEventListener('click', newDoc);
      root.querySelector('.te-b-open').addEventListener('click', openDialog);
      root.querySelector('.te-b-save').addEventListener('click', () => { save(); });
      root.querySelector('.te-b-saveas').addEventListener('click', () => { saveAs(); });

      win.on('beforeclose', async () => {
        if (!dirty) return true;
        win.focus();
        return await ensureSaved(); // false при «Отмена» — окно остаётся
      });

      /* API для menus(win) */
      win._te = { newDoc, openDialog, save, saveAs };

      /* --- старт: аргументы запуска --- */
      if (ctx && ctx.args && ctx.args.path) loadPath(ctx.args.path);
      else { refreshUI(); ta.focus(); }
    },

    menus(win) {
      const api = () => win._te || {};
      return [{
        title: 'Файл',
        items: [
          { label: 'Создать', hotkey: 'Ctrl+N', action: () => api().newDoc && api().newDoc() },
          { label: 'Открыть…', hotkey: 'Ctrl+O', action: () => api().openDialog && api().openDialog() },
          { sep: true },
          { label: 'Сохранить', hotkey: 'Ctrl+S', action: () => api().save && api().save() },
          { label: 'Сохранить как…', hotkey: 'Ctrl+Shift+S', action: () => api().saveAs && api().saveAs() },
          { sep: true },
          { label: 'Закрыть', hotkey: 'Ctrl+W', action: () => win.close() },
        ],
      }];
    },
  });
})();
