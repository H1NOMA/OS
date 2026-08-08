/* Hiko OS · Браузер — мини-браузер на iframe */
(function () {
  'use strict';
  const { el, esc } = OS;

  const ICON = OS.appTile(
    { from: '#5B8CFF', to: '#7C4DE8' },
    `<g>
      <circle cx="0" cy="0" r="19" fill="none" stroke="#fff" stroke-width="6.5"/>
      <path d="M -19 -2 C -8 -9 8 -9 19 -2" fill="none" stroke="#fff" stroke-width="4" opacity=".65"/>
      <ellipse cx="0" cy="2" rx="33" ry="10" fill="none" stroke="#fff" stroke-width="4.5" transform="rotate(-18)" opacity=".9"/>
      <circle cx="26" cy="-16" r="3.4" fill="#fff"/>
    </g>`
  );

  OS.injectStyle('app-browser', `
    .br-root { flex:1; min-height:0; display:flex; flex-direction:column; }
    .br-bar .ui-input { flex:1; border-radius:999px; padding:6px 14px; }
    .br-stage { flex:1; min-height:0; position:relative; background:var(--content-bg); }
    .br-stage iframe { width:100%; height:100%; border:none; background:#fff; }
    .br-home { position:absolute; inset:0; overflow-y:auto; display:flex; flex-direction:column;
      align-items:center; padding:7vh 24px 24px; background:
      radial-gradient(1000px 500px at 20% -10%, var(--accent-soft), transparent),
      var(--content-bg); }
    .br-home .br-clock { font-size:56px; font-weight:800; letter-spacing:-1px; color:var(--text); font-variant-numeric:tabular-nums; }
    .br-home .br-date { color:var(--text-2); margin-bottom:4vh; }
    .br-home .br-search { width:min(560px, 90%); display:flex; align-items:center; gap:10px;
      padding:12px 20px; border-radius:999px; background:var(--ctl-bg);
      box-shadow: inset 0 0 0 1px var(--ctl-border); margin-bottom:5vh; }
    .br-home .br-search:focus-within { box-shadow: 0 0 0 3px var(--accent-soft), inset 0 0 0 1px var(--accent); }
    .br-home .br-search svg { width:18px; height:18px; opacity:.5; flex:none; }
    .br-home .br-search input { flex:1; border:none; outline:none; background:transparent;
      font-size:16px; font-family:var(--font); color:var(--text); }
    .br-tiles { display:grid; grid-template-columns:repeat(auto-fit, 108px); justify-content:center; gap:16px; width:min(600px, 95%); }
    .br-tile { display:flex; flex-direction:column; align-items:center; gap:8px; padding:12px 6px;
      border-radius:14px; cursor:default; }
    .br-tile:hover { background:var(--hover); }
    .br-tile .br-fav { width:52px; height:52px; border-radius:14px; display:flex; align-items:center;
      justify-content:center; font-size:24px; font-weight:800; color:#fff; box-shadow:0 4px 14px rgba(0,0,0,.18); }
    .br-tile span { font-size:12.5px; color:var(--text); }
    .br-blocked { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center;
      justify-content:center; gap:12px; background:var(--content-bg); text-align:center; padding:24px; }
    .br-blocked .b-ic { width:56px; height:56px; opacity:.4; color:var(--text-2); }
    .br-blocked h3 { font-size:16px; color:var(--text); }
    .br-blocked p { font-size:13px; color:var(--text-2); max-width:380px; line-height:1.5; }
    .br-about { max-width:640px; margin:0 auto; padding:40px 28px; color:var(--text); line-height:1.6; }
    .br-about h1 { display:flex; align-items:center; gap:14px; margin-bottom:14px; }
    .br-about h1 .lg { width:44px; height:44px; color:var(--accent); }
    .br-about p { margin:10px 0; color:var(--text-2); }
    .br-about .tag { display:inline-block; background:var(--accent-soft); color:var(--accent);
      border-radius:6px; padding:2px 9px; font-size:12.5px; font-weight:600; margin-right:6px; }
  `);

  const BOOKMARKS = [
    { name: 'Википедия', url: 'https://ru.wikipedia.org', bg: '#5c5c66', label: 'W' },
    { name: 'Bing', url: 'https://www.bing.com', bg: '#3AA6FF', label: 'b' },
    { name: 'Карты OSM', url: 'https://www.openstreetmap.org/export/embed.html?bbox=37.35,55.55,37.85,55.92', bg: '#23D1A8', label: '◈' },
    { name: 'О Hiko OS', url: 'about:hiko', bg: '#8B78FF', label: 'h' },
  ];

  OS.registerApp({
    id: 'browser',
    name: 'Браузер',
    icon: ICON,
    width: 1000, height: 640,
    minWidth: 480, minHeight: 320,
    render(win) {
      let stack = ['home'];
      let pos = 0;
      let loadTimer = null;

      const root = el('div', 'br-root');
      root.innerHTML = `
        <div class="ui-toolbar br-bar">
          <button class="ui-btn icon-only br-back" title="Назад">${OS.icons.chevronL}</button>
          <button class="ui-btn icon-only br-fwd" title="Вперёд">${OS.icons.chevronR}</button>
          <button class="ui-btn icon-only br-reload" title="Обновить"><svg viewBox="0 0 24 24" width="15" height="15"><path d="M 20 12 A 8 8 0 1 1 17.7 6.3 M 18 2 L 18 7 L 13 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <button class="ui-btn icon-only br-home-btn" title="Домой"><svg viewBox="0 0 24 24" width="15" height="15"><path d="M 3 11 L 12 3 L 21 11 M 6 9.5 L 6 20 L 18 20 L 18 9.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <input class="ui-input br-url" placeholder="Введи адрес или запрос…" spellcheck="false">
        </div>
        <div class="br-stage"></div>`;
      win.content.appendChild(root);

      const stage = root.querySelector('.br-stage');
      const urlIn = root.querySelector('.br-url');

      function current() { return stack[pos]; }
      function updateNav() {
        root.querySelector('.br-back').disabled = pos <= 0;
        root.querySelector('.br-fwd').disabled = pos >= stack.length - 1;
      }

      function navigate(target, push) {
        if (push !== false) {
          stack = stack.slice(0, pos + 1);
          stack.push(target);
          pos = stack.length - 1;
        }
        show(target);
        updateNav();
      }

      function show(target) {
        clearTimeout(loadTimer);
        stage.innerHTML = '';
        if (target === 'home') {
          urlIn.value = '';
          win.setTitle('Новая вкладка');
          renderHome();
          return;
        }
        if (target === 'about:hiko') {
          urlIn.value = target;
          win.setTitle('О Hiko OS');
          renderAbout();
          return;
        }
        urlIn.value = target;
        try { win.setTitle(new URL(target).host); } catch (e) { win.setTitle(target); }

        const iframe = el('iframe');
        iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');
        stage.appendChild(iframe);

        let loaded = false;
        iframe.addEventListener('load', () => {
          loaded = true;
          clearTimeout(loadTimer);
          const blocked = stage.querySelector('.br-blocked');
          if (blocked) blocked.remove();
        });
        loadTimer = setTimeout(() => { if (!loaded) showBlocked(target); }, 4500);
        iframe.src = target;
      }

      function showBlocked(url) {
        const b = el('div', 'br-blocked');
        b.innerHTML = `
          <div class="b-ic">${OS.icons.warn}</div>
          <h3>Сайт не открывается во встроенном окне</h3>
          <p>Многие сайты запрещают встраивание (X-Frame-Options). Это ограничение браузера, а не Hiko OS.</p>
          <button class="ui-btn primary">Открыть в новой вкладке</button>`;
        b.querySelector('button').addEventListener('click', () => window.open(url, '_blank'));
        stage.appendChild(b);
      }

      function renderHome() {
        const home = el('div', 'br-home');
        home.innerHTML = `
          <div class="br-clock"></div>
          <div class="br-date"></div>
          <div class="br-search">${OS.icons.search}<input placeholder="Поиск в интернете" spellcheck="false"></div>
          <div class="br-tiles">
            ${BOOKMARKS.map((b, i) => `
              <div class="br-tile" data-i="${i}">
                <div class="br-fav" style="background:${b.bg}">${b.label}</div>
                <span>${esc(b.name)}</span>
              </div>`).join('')}
          </div>`;
        stage.appendChild(home);

        const tickC = () => {
          const cEl = home.querySelector('.br-clock');
          if (!cEl || !cEl.isConnected) return;
          const d = new Date();
          cEl.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
          home.querySelector('.br-date').textContent = d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
          setTimeout(tickC, 5000);
        };
        tickC();

        const si = home.querySelector('.br-search input');
        si.addEventListener('keydown', (e) => {
          e.stopPropagation();
          if (e.key === 'Enter' && si.value.trim()) go(si.value.trim());
        });
        home.querySelectorAll('.br-tile').forEach(t => t.addEventListener('click', () => {
          navigate(BOOKMARKS[+t.dataset.i].url);
        }));
      }

      function renderAbout() {
        const a = el('div');
        a.style.cssText = 'position:absolute;inset:0;overflow-y:auto;background:var(--content-bg)';
        a.innerHTML = `<div class="br-about">
          <h1><span class="lg">${OS.icons.logo}</span> Hiko OS ${esc(OS.VERSION)} «${esc(OS.CODENAME)}»</h1>
          <p><span class="tag">свой визуал</span><span class="tag">привычная логика</span><span class="tag">0 зависимостей</span></p>
          <p>Персональная операционная система в браузере. Оконный менеджер со снэпом,
          виртуальная файловая система, Spotlight, Mission Control, док с магнификацией —
          всё написано на чистом JavaScript без единого фреймворка.</p>
          <p>Приложений установлено: ${OS.allApps().length}. Занято хранилища: ${OS.fmtBytes(OS.vfs.usage())}.</p>
          <p>Исходники живут в папках <code>js/core</code> и <code>js/apps</code>.
          Своё приложение — это один файл на ~100 строк, см. <code>docs/APP_API.md</code>.</p>
        </div>`;
        stage.appendChild(a);
      }

      function go(input) {
        let target;
        if (input === 'about:hiko') target = input;
        else if (/^https?:\/\//i.test(input)) target = input;
        else if (/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(input)) target = 'https://' + input;
        else target = 'https://www.bing.com/search?q=' + encodeURIComponent(input);
        navigate(target);
      }

      urlIn.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter' && urlIn.value.trim()) go(urlIn.value.trim());
      });
      root.querySelector('.br-back').addEventListener('click', () => { if (pos > 0) { pos--; show(current()); updateNav(); } });
      root.querySelector('.br-fwd').addEventListener('click', () => { if (pos < stack.length - 1) { pos++; show(current()); updateNav(); } });
      root.querySelector('.br-reload').addEventListener('click', () => show(current()));
      root.querySelector('.br-home-btn').addEventListener('click', () => navigate('home'));

      win.on('close', () => clearTimeout(loadTimer));
      show('home');
      updateNav();
    },
  });
})();
