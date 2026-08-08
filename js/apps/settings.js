/* hinomaOS · Настройки — системные настройки */
(function () {
  'use strict';
  const { el, esc } = OS;

  const ICON = OS.appTile(
    { from: '#8E8E93', to: '#59595E' },
    `<g>
      ${Array.from({ length: 8 }, (_, i) => `<rect x="-5" y="-34" width="10" height="12" rx="3" fill="#E4E4E8" transform="rotate(${i * 45})"/>`).join('')}
      <circle cx="0" cy="0" r="24" fill="#E4E4E8"/>
      <circle cx="0" cy="0" r="12" fill="#59595E"/>
    </g>`
  );

  OS.injectStyle('app-settings', `
    .st-root { flex:1; min-height:0; display:flex; }
    .st-main { flex:1; min-width:0; overflow-y:auto; padding:18px 20px; }
    .st-main h2 { font-size:19px; margin-bottom:14px; color:var(--text); }
    .st-card { background:var(--content-bg); border:1px solid var(--divider); border-radius:12px;
      padding:14px 16px; margin-bottom:14px; }
    .st-row { display:flex; align-items:center; gap:12px; padding:8px 0; }
    .st-row + .st-row { border-top:1px solid var(--divider); }
    .st-row .lbl { font-size:13.5px; color:var(--text); }
    .st-row .sub { font-size:12px; color:var(--text-3); margin-top:1px; }
    .st-row .sp { flex:1; }
    .st-theme-tiles { display:flex; gap:12px; }
    .st-theme-tile { flex:1; cursor:default; text-align:center; font-size:12.5px; color:var(--text-2); }
    .st-theme-tile .prev { height:64px; border-radius:10px; margin-bottom:6px; border:2.5px solid transparent;
      position:relative; overflow:hidden; }
    .st-theme-tile.on .prev { border-color:var(--accent); }
    .st-theme-tile .prev .mini { position:absolute; left:10px; top:12px; right:34%; bottom:10px;
      border-radius:6px 6px 0 0; }
    .st-accents { display:flex; gap:11px; flex-wrap:wrap; }
    .st-acc { width:26px; height:26px; border-radius:50%; cursor:default; position:relative; }
    .st-acc.on::after { content:""; position:absolute; inset:-5px; border:2.5px solid var(--accent); border-radius:50%; }
    .st-wp-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(130px, 1fr)); gap:10px; }
    .st-wp { aspect-ratio:16/10; border-radius:9px; overflow:hidden; cursor:default; border:2.5px solid transparent; position:relative; }
    .st-wp img { width:100%; height:100%; object-fit:cover; display:block; }
    .st-wp.on { border-color:var(--accent); }
    .st-wp .nm { position:absolute; left:0; right:0; bottom:0; padding:10px 8px 4px; font-size:11px; color:#fff;
      background:linear-gradient(transparent, rgba(0,0,0,.6)); }
    .st-avatar { width:74px; height:74px; border-radius:50%; display:flex; align-items:center; justify-content:center;
      font-size:30px; font-weight:800; color:#fff; background:linear-gradient(135deg, var(--accent), var(--accent-2)); flex:none; }
    .st-pin-item { display:flex; align-items:center; gap:9px; padding:5px 8px; border-radius:8px; }
    .st-pin-item:hover { background:var(--hover); }
    .st-pin-item .ic { width:24px; height:24px; flex:none; }
    .st-pin-item .ic svg { width:100%; height:100%; }
    .st-pin-item .x { margin-left:auto; opacity:.5; cursor:default; padding:2px 7px; border-radius:5px; }
    .st-pin-item .x:hover { opacity:1; background:var(--ctl-bg-hover); }
    .st-storage-bar { height:8px; border-radius:5px; background:var(--ctl-bg-hover); overflow:hidden; margin-top:8px; }
    .st-storage-bar > div { height:100%; background:var(--accent); border-radius:5px; }
  `);

  const ACCENTS = [
    { c: '#23D1A8', n: 'Мята' },
    { c: '#8B78FF', n: 'Ирис' },
    { c: '#FF6B5E', n: 'Коралл' },
    { c: '#FFB454', n: 'Янтарь' },
    { c: '#3AA6FF', n: 'Лазурь' },
    { c: '#FF7DA8', n: 'Роза' },
    { c: '#9ADB4F', n: 'Лайм' },
    { c: '#93A0B4', n: 'Сталь' },
  ];
  const SECTIONS = [
    { id: 'appearance', name: 'Внешний вид', ic: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 3 A 9 9 0 0 1 12 21 Z" fill="currentColor"/></svg>' },
    { id: 'wallpaper', name: 'Обои', ic: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 15 L8 10 L13 15 L16 12 L21 17" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="16" cy="9" r="1.6" fill="currentColor"/></svg>' },
    { id: 'dock', name: 'Панель', ic: '<svg viewBox="0 0 24 24"><rect x="3" y="14" width="18" height="6" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8" cy="17" r="1.4" fill="currentColor"/><circle cx="12" cy="17" r="1.4" fill="currentColor"/><circle cx="16" cy="17" r="1.4" fill="currentColor"/></svg>' },
    { id: 'user', name: 'Пользователь', ic: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4.5 20 C 5.5 15.5 8.5 14 12 14 C 15.5 14 18.5 15.5 19.5 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' },
    { id: 'corners', name: 'Горячие углы', ic: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 9 L9 9 L9 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="6.5" cy="6.5" r="1.2" fill="currentColor"/></svg>' },
    { id: 'data', name: 'Данные', ic: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="6" rx="7" ry="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 6 L5 18 C5 19.7 8.1 21 12 21 C15.9 21 19 19.7 19 18 L19 6 M5 12 C5 13.7 8.1 15 12 15 C15.9 15 19 13.7 19 12" fill="none" stroke="currentColor" stroke-width="2"/></svg>' },
    { id: 'notif', name: 'Уведомления', ic: '<svg viewBox="0 0 24 24"><path d="M6 16 L6 10 A 6 6 0 0 1 18 10 L 18 16 L 20 18 L 4 18 Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M10 21 C 10.5 22 13.5 22 14 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>' },
    { id: 'about', name: 'О системе', ic: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 11 L12 16.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="7.8" r="1.4" fill="currentColor"/></svg>' },
    { id: 'reset', name: 'Сброс', ic: '<svg viewBox="0 0 24 24"><path d="M4 12 A 8 8 0 1 1 6.3 17.7 M 4 20 L 4 14 L 10 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
  ];

  OS.registerApp({
    id: 'settings',
    name: 'Настройки',
    icon: ICON,
    width: 780, height: 560,
    minWidth: 560, minHeight: 400,
    singleton: true,
    render(win, ctx) {
      let section = (ctx.args && ctx.args.section) || 'appearance';

      const root = el('div', 'st-root');
      root.innerHTML = `
        <div class="ui-sidebar" style="width:185px">
          <div class="ui-side-title">Настройки</div>
          ${SECTIONS.map(s => `<div class="ui-side-item ${s.id === section ? 'on' : ''}" data-s="${s.id}">${s.ic}<span>${esc(s.name)}</span></div>`).join('')}
        </div>
        <div class="st-main"></div>`;
      win.content.appendChild(root);
      const main = root.querySelector('.st-main');

      root.querySelectorAll('[data-s]').forEach(item => item.addEventListener('click', () => {
        section = item.dataset.s;
        root.querySelectorAll('[data-s]').forEach(x => x.classList.toggle('on', x === item));
        render();
      }));

      const mkSwitch = (on, cb) => {
        const sw = el('div', 'ui-switch' + (on ? ' on' : ''));
        sw.addEventListener('click', () => {
          sw.classList.toggle('on');
          cb(sw.classList.contains('on'));
        });
        return sw;
      };

      function render() {
        const s = OS.settings;
        main.innerHTML = '';
        const sec = SECTIONS.find(x => x.id === section);
        main.appendChild(el('h2', null, esc(sec.name)));

        if (section === 'appearance') {
          const card1 = el('div', 'st-card');
          card1.innerHTML = `<div class="lbl" style="font-weight:700;margin-bottom:10px">Тема оформления</div>
            <div class="st-theme-tiles">
              ${[['light', 'Светлая', '#e8e8ee', '#fff'], ['dark', 'Тёмная', '#1a1a1e', '#2c2c30'], ['auto', 'Авто', 'linear-gradient(90deg,#e8e8ee 50%,#1a1a1e 50%)', '#8e8e93']].map(([id, nm, bg, mini]) => `
                <div class="st-theme-tile ${s.get('theme') === id ? 'on' : ''}" data-th="${id}">
                  <div class="prev" style="background:${bg}"><div class="mini" style="background:${mini}"></div></div>${nm}
                </div>`).join('')}
            </div>`;
          card1.querySelectorAll('[data-th]').forEach(t => t.addEventListener('click', () => {
            s.set('theme', t.dataset.th);
            render();
          }));
          main.appendChild(card1);

          const card2 = el('div', 'st-card');
          card2.innerHTML = `<div class="lbl" style="font-weight:700;margin-bottom:10px">Акцентный цвет</div>
            <div class="st-accents">
              ${ACCENTS.map(a => `<div class="st-acc ${s.get('accent') === a.c ? 'on' : ''}" data-c="${a.c}" title="${a.n}" style="background:${a.c}"></div>`).join('')}
            </div>`;
          card2.querySelectorAll('[data-c]').forEach(a => a.addEventListener('click', () => {
            s.set('accent', a.dataset.c);
            render();
          }));
          main.appendChild(card2);

          const card3 = el('div', 'st-card');
          const row = el('div', 'st-row');
          row.innerHTML = `<div><div class="lbl">Тёплый свет</div><div class="sub">Мягкий тёплый оттенок экрана вечером</div></div><div class="sp"></div>`;
          row.appendChild(mkSwitch(s.get('nightLight'), v => s.set('nightLight', v)));
          card3.appendChild(row);
          main.appendChild(card3);
        }

        else if (section === 'wallpaper') {
          const card = el('div', 'st-card');
          card.innerHTML = `<div class="st-wp-grid">
            ${OS.wallpapers.presets.map(w => `
              <div class="st-wp ${s.get('wallpaper') === w.id ? 'on' : ''}" data-wp="${w.id}">
                <img src="${w.uri}" alt=""><div class="nm">${esc(w.name)}</div>
              </div>`).join('')}
          </div>`;
          card.querySelectorAll('[data-wp]').forEach(w => w.addEventListener('click', () => {
            s.set('wallpaper', w.dataset.wp);
            render();
          }));
          main.appendChild(card);
        }

        else if (section === 'dock') {
          const card = el('div', 'st-card');
          const r1 = el('div', 'st-row');
          r1.innerHTML = `<div class="lbl">Размер значков</div><div class="sp"></div>
            <input class="ui-slider" type="range" min="44" max="72" value="${s.get('dockSize')}" style="width:170px">`;
          r1.querySelector('input').addEventListener('input', (e) => s.set('dockSize', +e.target.value));
          card.appendChild(r1);
          const r2 = el('div', 'st-row');
          r2.innerHTML = `<div><div class="lbl">Магнификация</div><div class="sub">Увеличение значков под курсором</div></div><div class="sp"></div>`;
          r2.appendChild(mkSwitch(s.get('dockMagnify'), v => s.set('dockMagnify', v)));
          card.appendChild(r2);
          main.appendChild(card);

          const card2 = el('div', 'st-card');
          card2.innerHTML = `<div class="lbl" style="font-weight:700;margin-bottom:8px">Закреплённые приложения</div>`;
          const pinned = s.get('dockPinned', []);
          pinned.forEach(id => {
            const app = OS.getApp(id);
            if (!app) return;
            const row = el('div', 'st-pin-item');
            row.innerHTML = `<div class="ic">${app.icon}</div><span>${esc(app.name)}</span><span class="x" title="Открепить">✕</span>`;
            row.querySelector('.x').addEventListener('click', () => {
              s.set('dockPinned', pinned.filter(p => p !== id));
              render();
            });
            card2.appendChild(row);
          });
          const unpinned = OS.allApps().filter(a => !pinned.includes(a.id));
          if (unpinned.length) {
            const addRow = el('div', 'st-row');
            addRow.innerHTML = `<select class="ui-select" style="flex:1">${unpinned.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select>`;
            const btn = el('button', 'ui-btn', 'Закрепить');
            btn.addEventListener('click', () => {
              s.set('dockPinned', [...pinned, addRow.querySelector('select').value]);
              render();
            });
            addRow.appendChild(btn);
            card2.appendChild(addRow);
          }
          main.appendChild(card2);
        }

        else if (section === 'user') {
          const card = el('div', 'st-card');
          const name = s.get('userName');
          card.innerHTML = `
            <div class="st-row">
              <div class="st-avatar">${esc(name.slice(0, 1).toUpperCase())}</div>
              <div style="flex:1">
                <div class="lbl" style="font-weight:700;margin-bottom:6px">Имя пользователя</div>
                <input class="ui-input st-name" style="width:100%" value="${esc(name)}" spellcheck="false">
                <div class="sub" style="margin-top:6px">Показывается на экране блокировки и в терминале</div>
              </div>
            </div>`;
          const input = card.querySelector('.st-name');
          const commit = () => {
            const v = input.value.trim();
            if (v && v !== s.get('userName')) { s.set('userName', v); render(); }
          };
          input.addEventListener('blur', commit);
          input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') commit(); });
          main.appendChild(card);

          // пароль экрана блокировки
          const hasPass = !!s.get('passHash');
          const card2 = el('div', 'st-card');
          const prow = el('div', 'st-row');
          prow.innerHTML = `<div><div class="lbl">Пароль экрана блокировки</div>
            <div class="sub">${hasPass ? 'Установлен — запрашивается при входе' : 'Не установлен. Простая защита от посторонних глаз'}</div></div><div class="sp"></div>`;
          const pbtn = el('button', 'ui-btn' + (hasPass ? ' danger' : ' primary'), hasPass ? 'Убрать' : 'Установить…');
          pbtn.addEventListener('click', async () => {
            if (hasPass) {
              const cur = await OS.dialog.prompt('Убрать пароль', 'Введи текущий пароль:', '', { password: true });
              if (cur === null) return;
              if (OS.hashPass(cur) !== s.get('passHash')) { OS.dialog.alert('Неверный пароль', 'Попробуй ещё раз.'); return; }
              s.set('passHash', '');
              render();
              return;
            }
            const p1 = await OS.dialog.prompt('Новый пароль', 'Придумай пароль (мин. 3 символа):', '', { password: true });
            if (p1 === null) return;
            if (String(p1).length < 3) { OS.dialog.alert('Слишком короткий', 'Нужно хотя бы 3 символа.'); return; }
            const p2 = await OS.dialog.prompt('Повтори пароль', 'Ещё раз, для надёжности:', '', { password: true });
            if (p2 === null) return;
            if (p1 !== p2) { OS.dialog.alert('Пароли не совпали', 'Попробуй заново.'); return; }
            s.set('passHash', OS.hashPass(p1));
            OS.notify({ title: 'Настройки', body: 'Пароль установлен 🔒', appId: 'settings' });
            render();
          });
          prow.appendChild(pbtn);
          card2.appendChild(prow);
          main.appendChild(card2);
        }

        else if (section === 'corners') {
          const NAMES = { tl: 'Левый верхний', tr: 'Правый верхний', bl: 'Левый нижний', br: 'Правый нижний' };
          const OPTS = [
            ['', 'Выключено'], ['mission', 'Обзор окон'], ['desktop', 'Показать стол'],
            ['search', 'Поиск'], ['apps', 'Все приложения'], ['lock', 'Заблокировать'],
          ];
          const hc = { tl: '', tr: '', bl: '', br: '', ...s.get('hotCorners', {}) };
          const card = el('div', 'st-card');
          card.innerHTML = `<div class="sub" style="padding:2px 0 8px">Прикоснись курсором к углу экрана — сработает действие.</div>`;
          Object.keys(NAMES).forEach(k => {
            const row = el('div', 'st-row');
            row.innerHTML = `<div class="lbl">${NAMES[k]}</div><div class="sp"></div>
              <select class="ui-select">${OPTS.map(([v, n]) => `<option value="${v}" ${hc[k] === v ? 'selected' : ''}>${n}</option>`).join('')}</select>`;
            row.querySelector('select').addEventListener('change', (e) => {
              const cur = { ...s.get('hotCorners', {}) };
              cur[k] = e.target.value;
              s.set('hotCorners', cur);
            });
            card.appendChild(row);
          });
          main.appendChild(card);
        }

        else if (section === 'data') {
          const card = el('div', 'st-card');
          const r1 = el('div', 'st-row');
          r1.innerHTML = `<div><div class="lbl">Экспорт системы</div><div class="sub">Файлы, настройки и виджеты — в один JSON-файл</div></div><div class="sp"></div>`;
          const exBtn = el('button', 'ui-btn primary', 'Экспортировать');
          exBtn.addEventListener('click', () => {
            try {
              const dump = {
                hinoma: OS.VERSION,
                exported: new Date().toISOString(),
                settings: JSON.parse(localStorage.getItem('hinoma.settings.v1') || '{}'),
                vfs: JSON.parse(localStorage.getItem('hinoma.vfs.v1') || 'null'),
                notifications: JSON.parse(localStorage.getItem('hinoma.notifications.v1') || '[]'),
              };
              const blob = new Blob([JSON.stringify(dump)], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `hinomaOS-backup-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(a.href), 5000);
              OS.notify({ title: 'Данные', body: 'Резервная копия сохранена в загрузки браузера', appId: 'settings' });
            } catch (e) { OS.dialog.alert('Не удалось экспортировать', e.message); }
          });
          r1.appendChild(exBtn);
          card.appendChild(r1);

          const r2 = el('div', 'st-row');
          r2.innerHTML = `<div><div class="lbl">Импорт системы</div><div class="sub">Восстановление из JSON-файла (заменит текущие данные)</div></div><div class="sp"></div>`;
          const imBtn = el('button', 'ui-btn', 'Импортировать…');
          const fileIn = el('input');
          fileIn.type = 'file';
          fileIn.accept = '.json,application/json';
          fileIn.style.display = 'none';
          fileIn.addEventListener('change', () => {
            const f = fileIn.files && fileIn.files[0];
            if (!f) return;
            const reader = new FileReader();
            reader.onload = async () => {
              try {
                const dump = JSON.parse(reader.result);
                if (!dump || !dump.hinoma || !dump.vfs) throw new Error('Это не файл резервной копии hinomaOS');
                const ok = await OS.dialog.confirm('Импортировать данные?',
                  `Копия от ${dump.exported ? dump.exported.slice(0, 10) : '—'}. Текущие файлы и настройки будут заменены.`,
                  { okLabel: 'Импортировать', danger: true });
                if (!ok) return;
                localStorage.setItem('hinoma.settings.v1', JSON.stringify(dump.settings || {}));
                localStorage.setItem('hinoma.vfs.v1', JSON.stringify(dump.vfs));
                localStorage.setItem('hinoma.notifications.v1', JSON.stringify(dump.notifications || []));
                location.reload();
              } catch (e) { OS.dialog.alert('Не удалось импортировать', e.message); }
            };
            reader.readAsText(f);
            fileIn.value = '';
          });
          imBtn.addEventListener('click', () => fileIn.click());
          r2.appendChild(imBtn);
          r2.appendChild(fileIn);
          card.appendChild(r2);
          main.appendChild(card);

          const bak = OS.vfs.backupInfo();
          const card2 = el('div', 'st-card');
          const r3 = el('div', 'st-row');
          r3.innerHTML = `<div><div class="lbl">Автокопия файловой системы</div>
            <div class="sub">${bak ? `Есть, ${OS.fmtBytes(bak.size)} — обновляется автоматически` : 'Ещё не создана'}</div></div><div class="sp"></div>`;
          const rsBtn = el('button', 'ui-btn', 'Восстановить');
          rsBtn.disabled = !bak;
          rsBtn.addEventListener('click', async () => {
            const ok = await OS.dialog.confirm('Восстановить файлы из автокопии?', 'Текущее содержимое файловой системы будет заменено.', { okLabel: 'Восстановить', danger: true });
            if (!ok) return;
            try { OS.vfs.restoreFromBackup(); } catch (e) { OS.dialog.alert('Не получилось', e.message); }
          });
          r3.appendChild(rsBtn);
          card2.appendChild(r3);
          main.appendChild(card2);
        }

        else if (section === 'notif') {
          const card = el('div', 'st-card');
          const r1 = el('div', 'st-row');
          r1.innerHTML = `<div><div class="lbl">Не беспокоить</div><div class="sub">Скрывать всплывающие уведомления</div></div><div class="sp"></div>`;
          r1.appendChild(mkSwitch(s.get('dnd'), v => s.set('dnd', v)));
          card.appendChild(r1);
          const r2 = el('div', 'st-row');
          r2.innerHTML = `<div><div class="lbl">История уведомлений</div><div class="sub">Сохранено: ${OS.getNotifications().length}</div></div><div class="sp"></div>`;
          const clearBtn = el('button', 'ui-btn', 'Очистить');
          clearBtn.addEventListener('click', () => { OS.clearNotifications(); render(); });
          r2.appendChild(clearBtn);
          card.appendChild(r2);
          main.appendChild(card);
        }

        else if (section === 'about') {
          const used = OS.vfs.usage();
          const total = 5 * 1024 * 1024;
          const card = el('div', 'st-card');
          card.innerHTML = `
            <div style="display:flex;align-items:center;gap:16px;padding:6px 0 14px">
              <div style="width:64px;height:64px;color:var(--accent)">${OS.icons.logo}</div>
              <div>
                <div style="font-size:20px;font-weight:800">hinomaOS ${esc(OS.VERSION)}</div>
                <div class="sub">кодовое имя «${esc(OS.CODENAME)}» · веб-десктоп</div>
              </div>
            </div>
            <div class="st-row"><div class="lbl">Браузер</div><div class="sp"></div><div class="sub">${esc((navigator.userAgent.match(/(Chrome|Firefox|Safari|Edg)\/[\d.]+/) || ['—'])[0])}</div></div>
            <div class="st-row"><div class="lbl">Экран</div><div class="sp"></div><div class="sub">${screen.width} × ${screen.height}</div></div>
            <div class="st-row"><div class="lbl">Приложений</div><div class="sp"></div><div class="sub">${OS.allApps().length}</div></div>
            <div class="st-row" style="display:block">
              <div style="display:flex"><div class="lbl">Хранилище</div><div class="sp"></div><div class="sub">${OS.fmtBytes(used)} из ~5 МБ</div></div>
              <div class="st-storage-bar"><div style="width:${Math.min(100, used / total * 100).toFixed(1)}%"></div></div>
            </div>`;
          const hkRow = el('div', 'st-row');
          const hkBtn = el('button', 'ui-btn', 'Горячие клавиши');
          hkBtn.addEventListener('click', () => OS.menubar.showHotkeys());
          hkRow.innerHTML = `<div class="sp"></div>`;
          hkRow.insertBefore(hkBtn, hkRow.firstChild);
          card.appendChild(hkRow);
          main.appendChild(card);
        }

        else if (section === 'reset') {
          const card = el('div', 'st-card');
          card.innerHTML = `
            <div class="st-row">
              <div style="width:40px;height:40px;flex:none">${OS.icons.warn}</div>
              <div>
                <div class="lbl" style="font-weight:700">Полный сброс hinomaOS</div>
                <div class="sub">Удалит все файлы, настройки и уведомления. Система вернётся к заводскому состоянию.</div>
              </div>
            </div>`;
          const btn = el('button', 'ui-btn danger', 'Сбросить hinomaOS…');
          btn.style.marginTop = '10px';
          btn.addEventListener('click', async () => {
            const ok = await OS.dialog.confirm('Сбросить систему?', 'Все данные будут удалены безвозвратно. Точно?', { okLabel: 'Сбросить', danger: true });
            if (ok) OS.settings.reset();
          });
          card.appendChild(btn);
          main.appendChild(card);
        }
      }

      render();
    },
    onReopen(win, args) {
      if (args && args.section) {
        const item = win.content.querySelector(`[data-s="${args.section}"]`);
        if (item) item.click();
      }
    },
  });
})();
