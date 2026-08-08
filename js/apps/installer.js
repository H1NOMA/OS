/* Hiko OS · Установщик — установка приложений из файла и из интернета */
(function () {
  'use strict';
  const { el, esc } = OS;

  const ICON = OS.appTile(
    { from: '#38C6FF', to: '#2E5BE6' },
    `<g fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round">
      <path d="M 0 -28 L 0 8" stroke-width="8"/>
      <path d="M -14 -6 L 0 9 L 14 -6" stroke-width="8"/>
      <path d="M -26 16 L -26 22 C -26 26 -23 28 -19 28 L 19 28 C 23 28 26 26 26 22 L 26 16" stroke-width="7"/>
    </g>`
  );

  OS.injectStyle('app-installer', `
    .ins-root { flex:1; min-height:0; display:flex; flex-direction:column; }
    .ins-body { flex:1; min-height:0; overflow-y:auto; padding:14px 16px; }
    .ins-card { background:var(--ctl-bg); border-radius:12px; padding:13px 15px; margin-bottom:12px; }
    .ins-card h3 { font-size:13.5px; margin-bottom:3px; }
    .ins-card .sub { font-size:12px; color:var(--text-2); line-height:1.45; }
    .ins-row { display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:9px; }
    .ins-row:hover { background:var(--hover); }
    .ins-row .ic { width:30px; height:30px; flex:none; }
    .ins-row .ic svg { width:100%; height:100%; }
    .ins-row .nm { font-weight:600; font-size:13.5px; }
    .ins-row .meta { font-size:11.5px; color:var(--text-3); }
    .ins-row .sp { flex:1; }
    .ins-empty { text-align:center; color:var(--text-3); font-size:13px; padding:14px 0 6px; }
    .ins-warn { display:flex; gap:9px; align-items:flex-start; background:rgba(255,180,84,.12);
      border-radius:10px; padding:10px 12px; font-size:12px; color:var(--text-2); line-height:1.45; }
    .ins-warn svg { width:22px; height:22px; flex:none; margin-top:1px; }
  `);

  /* ---------- демо-приложение «Кости» (устанавливается одной кнопкой) ---------- */
  const DEMO_CODE = [
    "(function () {",
    "  'use strict';",
    "  var ICON = OS.appTile({ from: '#FF9F5C', to: '#E04E4E' },",
    "    '<g><rect x=\"-26\" y=\"-26\" width=\"52\" height=\"52\" rx=\"12\" fill=\"#fff\"/>' +",
    "    '<circle cx=\"-11\" cy=\"-11\" r=\"5.5\" fill=\"#E04E4E\"/><circle cx=\"11\" cy=\"-11\" r=\"5.5\" fill=\"#E04E4E\"/>' +",
    "    '<circle cx=\"0\" cy=\"0\" r=\"5.5\" fill=\"#E04E4E\"/>' +",
    "    '<circle cx=\"-11\" cy=\"11\" r=\"5.5\" fill=\"#E04E4E\"/><circle cx=\"11\" cy=\"11\" r=\"5.5\" fill=\"#E04E4E\"/></g>');",
    "  OS.injectStyle('app-dice',",
    "    '.dice-root { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; }' +",
    "    '.dice-row { font-size:84px; letter-spacing:10px; line-height:1; user-select:none; }' +",
    "    '.dice-row.rolling { animation: dice-sh .45s ease; }' +",
    "    '@keyframes dice-sh { 25% { transform: rotate(-8deg) scale(1.06); } 75% { transform: rotate(8deg) scale(1.06); } }' +",
    "    '.dice-sum { font-size:15px; color:var(--text-2); }');",
    "  var FACES = ['\\u2680', '\\u2681', '\\u2682', '\\u2683', '\\u2684', '\\u2685'];",
    "  OS.registerApp({",
    "    id: 'dice', name: 'Кости', icon: ICON,",
    "    width: 340, height: 330, minWidth: 280, minHeight: 260, singleton: true,",
    "    render: function (win) {",
    "      var rolls = 0;",
    "      win.content.innerHTML = '<div class=\"dice-root\">' +",
    "        '<div class=\"dice-row\">' + FACES[3] + ' ' + FACES[5] + '</div>' +",
    "        '<div class=\"dice-sum\">Бросков: 0</div>' +",
    "        '<button class=\"ui-btn primary\">Бросить!</button></div>';",
    "      var row = win.content.querySelector('.dice-row');",
    "      var sum = win.content.querySelector('.dice-sum');",
    "      win.content.querySelector('button').addEventListener('click', function () {",
    "        row.classList.remove('rolling'); void row.offsetWidth; row.classList.add('rolling');",
    "        var n = 0;",
    "        var t = setInterval(function () {",
    "          var a = Math.floor(Math.random() * 6), b = Math.floor(Math.random() * 6);",
    "          row.textContent = FACES[a] + ' ' + FACES[b];",
    "          if (++n >= 8) {",
    "            clearInterval(t);",
    "            rolls++;",
    "            sum.textContent = 'Выпало: ' + (a + 1 + b + 1) + ' · бросков: ' + rolls;",
    "            OS.beep(500 + (a + b) * 40, .08);",
    "          }",
    "        }, 55);",
    "      });",
    "    },",
    "  });",
    "})();",
  ].join('\n');

  /* ---------- установка ---------- */

  const metaOf = (code) => ({
    id: (code.match(/id:\s*['"]([\w-]+)['"]/) || [])[1] || null,
    name: (code.match(/name:\s*['"]([^'"]+)['"]/) || [])[1] || null,
  });

  function execute(code) {
    new Function(code)(); // бросит исключение, если код невалиден
  }

  /** Установка с подтверждением. Возвращает true при успехе. */
  async function installCode(code, fileName, sourceUrl) {
    code = String(code || '');
    if (!code.trim()) { OS.dialog.alert('Установщик', 'Файл пустой.'); return false; }
    if (code.length > 400 * 1024) { OS.dialog.alert('Установщик', 'Файл больше 400 КБ — слишком крупный для приложения.'); return false; }
    const meta = metaOf(code);
    const isNet = code.includes('OS.net.registerProvider');
    const isVoice = code.includes('OS.assistant.registerProvider');
    const looksLikeApp = code.includes('OS.registerApp') || code.includes('OS.widgets.register') || isNet || isVoice;
    const kind = isNet ? 'модуль обхода блокировок' : isVoice ? 'голосовой ассистент' : null;
    const ok = await OS.dialog.confirm(
      isNet ? 'Установить модуль обхода?' : isVoice ? 'Установить ассистента?' : 'Установить приложение?',
      `${meta.name ? `«${meta.name}»` : fileName}${kind ? `\nтип: ${kind}` : ''}${sourceUrl ? `\nисточник: ${sourceUrl.slice(0, 60)}` : ''}\n\n⚠ Код получит полный доступ к Hiko OS (файлы, настройки, сеть). Устанавливай только то, чему доверяешь.${looksLikeApp ? (isNet ? '\n\nПосле установки переключатель появится в Центре управления.' : '') : '\n\nВнимание: в коде не видно точки подключения Hiko OS — возможно, это не модуль Hiko.'}`,
      { okLabel: 'Установить', danger: !looksLikeApp }
    );
    if (!ok) return false;
    return installTrusted(code, fileName, sourceUrl);
  }

  /** Установка без вопросов (для демо и программного API). */
  function installTrusted(code, fileName, sourceUrl) {
    try {
      execute(code);
    } catch (e) {
      OS.dialog.alert('Не удалось установить', 'Код приложения сломан: ' + e.message);
      return false;
    }
    try {
      const meta = metaOf(code);
      let name = fileName || ((meta.id || 'app') + '.js');
      if (!name.endsWith('.js')) name += '.js';
      // перезапись файла того же приложения, иначе — уникальное имя
      if (!OS.vfs.exists('/Apps/' + name)) name = OS.vfs.uniqueName('/Apps', name);
      OS.vfs.write('/Apps/' + name, code, { sourceUrl: sourceUrl || null, installedAt: Date.now(), appId: meta.id });
      OS.notify({ title: 'Установщик', body: `«${meta.name || name}» установлено ✓`, appId: 'installer' });
      return true;
    } catch (e) {
      OS.dialog.alert('Приложение запущено, но не сохранилось', e.message);
      return false;
    }
  }

  async function installFromUrl(url) {
    url = String(url || '').trim();
    if (!/^https?:\/\//i.test(url)) { OS.dialog.alert('Установщик', 'Нужна полная ссылка (https://…) на .js-файл.'); return; }
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 12000);
      const r = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const code = await r.text();
      const fileName = decodeURIComponent(url.split('/').pop().split('?')[0] || 'app.js');
      await installCode(code, fileName, url);
    } catch (e) {
      OS.dialog.alert('Не удалось скачать',
        (e.name === 'AbortError' ? 'Время ожидания вышло.' : e.message) +
        '\n\nПодойдут ссылки, которые разрешают загрузку из браузера (CORS): raw.githubusercontent.com, gist, jsdelivr, unpkg.');
    }
  }

  OS.installer = { installCode, installTrusted, installFromUrl, demoCode: DEMO_CODE };

  /* ---------- интерфейс ---------- */

  OS.registerApp({
    id: 'installer',
    name: 'Установщик',
    icon: ICON,
    width: 620, height: 520,
    minWidth: 480, minHeight: 380,
    singleton: true,
    render(win) {
      const root = el('div', 'ins-root');
      root.innerHTML = `
        <div class="ui-toolbar">
          <button class="ui-btn primary ins-file">Установить из файла…</button>
          <button class="ui-btn ins-url">По ссылке…</button>
          <span style="flex:1"></span>
          <button class="ui-btn ins-demo">🎲 Демо «Кости»</button>
        </div>
        <div class="ins-body">
          <div class="ins-warn">${OS.icons.warn}<div>Приложение — это .js-файл в формате Hiko OS (см. docs/APP_API.md в репозитории).
            Установленный код получает полный доступ к системе — ставь только из доверенных источников.
            Файлы хранятся в папке <b>/Apps</b> и загружаются при каждом старте.</div></div>
          <div class="ins-card" style="margin-top:12px">
            <h3>Установленные приложения</h3>
            <div class="ins-list"></div>
          </div>
        </div>`;
      win.content.appendChild(root);
      const listEl = root.querySelector('.ins-list');

      const fileIn = el('input');
      fileIn.type = 'file';
      fileIn.accept = '.js,text/javascript';
      fileIn.style.display = 'none';
      root.appendChild(fileIn);

      function renderList() {
        let items = [];
        try { items = OS.vfs.list('/Apps').filter(i => i.type === 'file' && i.name.endsWith('.js')); } catch (e) { /* — */ }
        if (!items.length) {
          listEl.innerHTML = `<div class="ins-empty">Пока ничего не установлено.<br>Попробуй демо «Кости» — кнопка сверху.</div>`;
          return;
        }
        listEl.innerHTML = items.map(f => {
          let code = '';
          try { code = OS.vfs.read(f.path); } catch (e) { /* — */ }
          const meta = metaOf(code);
          const app = meta.id ? OS.getApp(meta.id) : null;
          const src = f.meta && f.meta.sourceUrl;
          return `<div class="ins-row" data-path="${esc(f.path)}" data-app="${esc(meta.id || '')}">
            <div class="ic">${app && app.icon ? app.icon : OS.icons.fileGeneric}</div>
            <div><div class="nm">${esc(meta.name || f.name)}</div>
              <div class="meta">${esc(f.name)} · ${OS.fmtBytes(f.size)}${src ? ' · из интернета' : ''}</div></div>
            <span class="sp"></span>
            ${app ? `<button class="ui-btn ins-open">Открыть</button>` : ''}
            <button class="ui-btn danger ins-del">Удалить</button>
          </div>`;
        }).join('');

        listEl.querySelectorAll('.ins-row').forEach(row => {
          const path = row.dataset.path;
          const appId = row.dataset.app;
          const openBtn = row.querySelector('.ins-open');
          if (openBtn) openBtn.addEventListener('click', () => OS.launch(appId));
          row.querySelector('.ins-del').addEventListener('click', async () => {
            const ok = await OS.dialog.confirm('Удалить приложение?',
              `${OS.vfs.nameOf(path)} будет удалено. Иконка исчезнет после перезагрузки системы.`,
              { okLabel: 'Удалить', danger: true });
            if (!ok) return;
            try {
              OS.vfs.rm(path);
              if (appId) {
                const pinned = OS.settings.get('dockPinned', []);
                if (pinned.includes(appId)) OS.settings.set('dockPinned', pinned.filter(x => x !== appId));
                OS.wm.windowsOf(appId).forEach(w => w.close());
              }
              OS.notify({ title: 'Установщик', body: 'Удалено. Полностью исчезнет после перезагрузки.', appId: 'installer' });
            } catch (e) { OS.dialog.alert('Не получилось', e.message); }
          });
        });
      }

      root.querySelector('.ins-file').addEventListener('click', () => fileIn.click());
      fileIn.addEventListener('change', () => {
        const f = fileIn.files && fileIn.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => installCode(reader.result, f.name);
        reader.readAsText(f);
        fileIn.value = '';
      });

      root.querySelector('.ins-url').addEventListener('click', async () => {
        const url = await OS.dialog.prompt('Установка по ссылке', 'Прямая ссылка на .js-файл приложения:', 'https://');
        if (url) installFromUrl(url);
      });

      root.querySelector('.ins-demo').addEventListener('click', async () => {
        const ok = await OS.dialog.confirm('Установить демо «Кости»?', 'Маленькое встроенное приложение — показать, как работает установка.', { okLabel: 'Установить' });
        if (ok) {
          installTrusted(DEMO_CODE, 'dice.js');
          OS.launch('dice');
        }
      });

      const un = OS.on('vfs:change', OS.debounce(({ path }) => {
        if (path.startsWith('/Apps')) renderList();
      }, 150));
      win.on('close', () => un());

      renderList();
    },
  });
})();
