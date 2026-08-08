/* ============================================================
   Hiko OS · assistant — шина ассистента
   Встроенный текстовый помощник + точка подключения внешнего
   голосового ассистента: OS.assistant.registerProvider({...}).
   Контракт — docs/ASSISTANT_API.md.
   ============================================================ */
(function () {
  'use strict';
  const { el, esc } = OS;

  OS.injectStyle('core-assistant', `
    #assistant-panel {
      position: fixed;
      top: calc(var(--menubar-h) + 8px);
      right: 10px;
      width: 360px;
      height: min(560px, calc(100vh - 130px));
      display: flex;
      flex-direction: column;
      background: var(--glass-strong);
      backdrop-filter: blur(50px) saturate(180%);
      -webkit-backdrop-filter: blur(50px) saturate(180%);
      border: 1px solid var(--glass-border);
      border-radius: var(--r-panel);
      box-shadow: var(--shadow-panel);
      z-index: 9200;
      animation: menu-in .18s var(--ease-out);
      overflow: hidden;
    }
    .as-head { flex: none; display: flex; align-items: center; gap: 9px; padding: 12px 14px 10px; }
    .as-head .as-orb {
      width: 30px; height: 30px; border-radius: 50%;
      background: linear-gradient(135deg, var(--accent), var(--accent-2));
      display: flex; align-items: center; justify-content: center;
      color: var(--on-accent); flex: none;
    }
    .as-head .as-orb svg { width: 16px; height: 16px; }
    .as-head .as-title { font-size: 14px; font-weight: 800; }
    .as-head .as-sub { font-size: 11px; color: var(--text-3); }
    .as-msgs { flex: 1; min-height: 0; overflow-y: auto; padding: 6px 12px; display: flex; flex-direction: column; gap: 8px; }
    .as-msg { max-width: 86%; padding: 8px 12px; border-radius: 14px; font-size: 13px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; animation: menu-in .18s var(--ease-out); user-select: text; }
    .as-msg.me { align-self: flex-end; background: var(--accent); color: var(--on-accent); border-bottom-right-radius: 5px; }
    .as-msg.bot { align-self: flex-start; background: var(--ctl-bg); color: var(--text); border-bottom-left-radius: 5px; }
    .as-msg.thinking { color: var(--text-3); }
    .as-chips { flex: none; display: flex; gap: 6px; padding: 4px 12px 8px; flex-wrap: wrap; }
    .as-chip { padding: 4px 11px; border-radius: 999px; background: var(--ctl-bg); font-size: 12px; cursor: default; color: var(--text-2); }
    .as-chip:hover { background: var(--ctl-bg-hover); color: var(--text); }
    .as-input-row { flex: none; display: flex; gap: 7px; padding: 10px 12px 12px; border-top: 1px solid var(--divider); }
    .as-input-row input { flex: 1; }
    .as-mic.listening { background: #FF6B5E !important; color: #fff !important; animation: as-pulse 1.2s infinite; }
    @keyframes as-pulse { 50% { box-shadow: 0 0 0 7px rgba(255,107,94,.25); } }
  `);

  /* ==================== командная шина ==================== */

  const commands = new Map();
  function registerCommand(id, def) { commands.set(id, def); }
  function run(id, params) {
    const c = commands.get(id);
    if (!c) throw new Error('Неизвестная команда: ' + id);
    return c.run(params || {});
  }
  const commandList = () => Array.from(commands.entries()).map(([id, c]) => ({ id, desc: c.desc, params: c.params || null }));

  function findApp(raw) {
    const q = String(raw || '').trim().toLowerCase();
    if (!q) return null;
    const apps = OS.allApps();
    const tries = [q, q.replace(/[уюа]$/, 'а'), q.slice(0, -1), q.slice(0, -2)];
    for (const t of tries) {
      if (!t) continue;
      const hit = apps.find(a => a.id === t || a.name.toLowerCase() === t) ||
                  apps.find(a => a.name.toLowerCase().startsWith(t)) ||
                  apps.find(a => a.name.toLowerCase().includes(t));
      if (hit) return hit;
    }
    return null;
  }

  registerCommand('open-app', {
    desc: 'Открыть приложение', params: '{ name }',
    run({ name }) {
      const app = findApp(name);
      if (!app) throw new Error(`Не нашёл приложение «${name}»`);
      OS.launch(app.id);
      return `Открываю «${app.name}»`;
    },
  });
  registerCommand('close-all', { desc: 'Закрыть все окна', run() { OS.wm.closeAll(); return 'Все окна закрыты'; } });
  registerCommand('show-desktop', { desc: 'Показать рабочий стол', run() { OS.wm.showDesktop(); return 'Готово'; } });
  registerCommand('overview', { desc: 'Обзор всех окон', run() { OS.wm.missionToggle(); return 'Обзор окон'; } });
  registerCommand('set-theme', {
    desc: 'Сменить тему', params: "{ theme: 'dark'|'light' }",
    run({ theme }) {
      OS.settings.set('theme', theme === 'light' ? 'light' : 'dark');
      return theme === 'light' ? 'Включил светлую тему' : 'Включил тёмную тему';
    },
  });
  registerCommand('set-wallpaper', {
    desc: 'Сменить обои', params: '{ id? } — без id: случайные',
    run({ id }) {
      const cur = OS.settings.get('wallpaper');
      let wp = id ? OS.wallpapers.get(id) : null;
      if (!wp) {
        const rest = OS.wallpapers.presets.filter(p => p.id !== cur);
        wp = rest[Math.floor(Math.random() * rest.length)];
      }
      OS.settings.set('wallpaper', wp.id);
      return `Обои: «${wp.name}»`;
    },
  });
  registerCommand('create-note', {
    desc: 'Создать заметку', params: '{ text }',
    run({ text }) {
      const name = OS.vfs.uniqueName('/Documents', 'Заметка.txt');
      OS.vfs.write('/Documents/' + name, String(text || '') + '\n');
      OS.launch('textedit', { path: '/Documents/' + name });
      return `Заметка создана: ${name}`;
    },
  });
  registerCommand('search', {
    desc: 'Поиск файлов и приложений', params: '{ query }',
    run({ query }) {
      const files = OS.vfs.search(String(query || ''), 6).filter(f => !f.path.startsWith('/Trash'));
      const app = findApp(query);
      return { app: app ? { id: app.id, name: app.name } : null, files };
    },
  });
  registerCommand('get-time', {
    desc: 'Текущее время',
    run() {
      const d = new Date();
      return `Сейчас ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    },
  });
  registerCommand('get-date', {
    desc: 'Сегодняшняя дата',
    run() {
      return 'Сегодня ' + new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    },
  });
  registerCommand('volume', {
    desc: 'Громкость системы', params: '{ value: 0–100 }',
    run({ value }) {
      OS.settings.set('volume', OS.clamp(+value || 0, 0, 100));
      OS.beep(660, .1);
      return `Громкость ${OS.clamp(+value || 0, 0, 100)}%`;
    },
  });
  registerCommand('notify', {
    desc: 'Показать уведомление', params: '{ title, body }',
    run({ title, body }) { OS.notify({ title: title || 'Ассистент', body: body || '', appId: 'system' }); return 'Показал'; },
  });
  registerCommand('lock', { desc: 'Заблокировать экран', run() { setTimeout(() => OS.emit('session:lock'), 300); return 'Блокирую…'; } });
  registerCommand('shutdown', { desc: 'Выключить (с подтверждением)', run() { OS.emit('session:shutdown'); return 'Спрашиваю подтверждение…'; } });

  /* ==================== голос (Web Speech, если есть) ==================== */

  function say(text) {
    try {
      if (!window.speechSynthesis) return false;
      const u = new SpeechSynthesisUtterance(String(text));
      u.lang = 'ru-RU';
      u.volume = OS.settings.get('volume', 70) / 100;
      const ru = speechSynthesis.getVoices().find(v => v.lang && v.lang.startsWith('ru'));
      if (ru) u.voice = ru;
      speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  }

  function systemListen() {
    return new Promise((resolve, reject) => {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { reject(new Error('Распознавание речи недоступно в этом браузере')); return; }
      const rec = new SR();
      rec.lang = 'ru-RU';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (e) => resolve(e.results[0][0].transcript);
      rec.onerror = (e) => reject(new Error(e.error === 'not-allowed' ? 'Нет доступа к микрофону' : 'Не расслышал'));
      rec.onend = () => reject(new Error('Не расслышал'));
      rec.start();
    });
  }

  /* ==================== встроенный обработчик ==================== */

  function builtinHandle(text) {
    const q = String(text || '').trim().toLowerCase().replace(/[!?.]+$/, '');
    let m;
    if ((m = q.match(/^(?:открой|запусти|включи)\s+(.+)/))) return run('open-app', { name: m[1] });
    if (/^(закрой все|закрой всё|сверни вс)/.test(q)) return run('close-all');
    if (/покажи (рабочий )?стол/.test(q)) return run('show-desktop');
    if (/^(обзор( окон)?|все окна)$/.test(q)) return run('overview');
    if (/(тёмн|темн|ночн)/.test(q) && /(тем|режим)/.test(q)) return run('set-theme', { theme: 'dark' });
    if (/светл/.test(q) && /(тем|режим)/.test(q)) return run('set-theme', { theme: 'light' });
    if (/(смени|поменяй|другие|случайные)\s+обои|обои\s+(смени|поменяй)/.test(q)) return run('set-wallpaper', {});
    if (/который час|сколько времени|^время$/.test(q)) return run('get-time');
    if (/какой сегодня день|какое.*число|^дата$/.test(q)) return run('get-date');
    if ((m = q.match(/^(?:создай заметку|запиши|заметка)[:,]?\s*(.*)/))) return run('create-note', { text: m[1] || 'Новая заметка' });
    if ((m = q.match(/^громкость\s+(\d+)/))) return run('volume', { value: +m[1] });
    if (/^заблокируй/.test(q)) return run('lock');
    if (/^выключи(сь| компьютер| систему)?$/.test(q)) return run('shutdown');
    if ((m = q.match(/^(?:найди|поиск)\s+(.+)/))) {
      const r = run('search', { query: m[1] });
      const parts = [];
      if (r.app) { OS.launch(r.app.id); parts.push(`Открываю «${r.app.name}»`); }
      if (r.files.length) parts.push('Нашёл: ' + r.files.map(f => f.name).join(', '));
      return parts.length ? parts.join('\n') : 'Ничего не нашёл';
    }
    if ((m = q.match(/^посчитай\s+(.+)/)) || /^[\d\s+\-*/().,%]+$/.test(q)) {
      const expr = (m ? m[1] : q).replace(/,/g, '.').replace(/[×х]/g, '*').replace(/[÷:]/g, '/').replace(/\s+/g, '');
      if (/^[\d+\-*/().%]+$/.test(expr) && /\d/.test(expr)) {
        try {
          const val = Function('"use strict";return (' + expr + ')')();
          if (isFinite(val)) return 'Будет ' + String(+val.toPrecision(12)).replace('.', ',');
        } catch (e) { /* не выражение */ }
      }
    }
    if (/кто ты|как тебя зовут/.test(q)) return 'Я встроенный помощник Hiko. Когда подключишь своего голосового ассистента (docs/ASSISTANT_API.md) — я уступлю ему место.';
    if (/помощь|что (ты )?умеешь|команды/.test(q)) {
      return 'Умею: «открой <приложение>», «найди <что-то>», «создай заметку <текст>», «тёмная/светлая тема», «смени обои», «который час», «какой сегодня день», «громкость 50», «посчитай 22*3», «покажи стол», «обзор окон», «закрой все», «заблокируй», «выключи».';
    }
    return 'Пока не понимаю. Скажи «помощь» — покажу, что умею.';
  }

  /* ==================== провайдер ==================== */

  let provider = null;
  const history = [];

  function registerProvider(p) {
    if (!p || typeof p.handle !== 'function') {
      console.error('[assistant] провайдеру нужен handle(text, ctx)');
      return false;
    }
    provider = p;
    OS.emit('assistant:provider', { id: p.id, name: p.name });
    OS.notify({ title: 'Ассистент', body: `«${p.name || p.id}» подключён 🎙`, appId: 'system' });
    const head = document.querySelector('#assistant-panel .as-sub');
    if (head) head.textContent = p.name || p.id;
    return true;
  }

  async function ask(text) {
    const ctx = { run, commands: commandList(), say, history: history.slice(-20), findApp };
    let res;
    if (provider) res = await provider.handle(text, ctx);
    else res = builtinHandle(text);
    if (res == null) res = 'Готово';
    if (typeof res !== 'object' || Array.isArray(res)) res = { text: typeof res === 'string' ? res : JSON.stringify(res) };
    if (res.speak) say(typeof res.speak === 'string' ? res.speak : res.text);
    return res;
  }

  /* ==================== панель ==================== */

  let panel = null;

  function addMsg(kind, text) {
    if (!panel) return null;
    const box = panel.querySelector('.as-msgs');
    const msg = el('div', 'as-msg ' + kind, esc(text));
    box.appendChild(msg);
    box.scrollTop = box.scrollHeight;
    return msg;
  }

  async function submit(text) {
    text = String(text || '').trim();
    if (!text || !panel) return;
    history.push({ role: 'user', text });
    addMsg('me', text);
    const thinking = addMsg('bot thinking', '…');
    try {
      const res = await ask(text);
      history.push({ role: 'assistant', text: res.text });
      if (thinking) { thinking.classList.remove('thinking'); thinking.textContent = res.text; }
    } catch (e) {
      if (thinking) { thinking.classList.remove('thinking'); thinking.textContent = '⚠ ' + (e.message || e); }
    }
    const box = panel.querySelector('.as-msgs');
    if (box) box.scrollTop = box.scrollHeight;
  }

  function open() {
    if (panel) return;
    panel = el('div');
    panel.id = 'assistant-panel';
    const provName = provider ? (provider.name || provider.id) : 'встроенный помощник';
    panel.innerHTML = `
      <div class="as-head">
        <div class="as-orb">${OS.icons.spark}</div>
        <div><div class="as-title">Ассистент</div><div class="as-sub">${esc(provName)}</div></div>
      </div>
      <div class="as-msgs"></div>
      <div class="as-chips">
        <div class="as-chip">Который час?</div>
        <div class="as-chip">Открой Змейку</div>
        <div class="as-chip">Смени обои</div>
        <div class="as-chip">Что ты умеешь?</div>
      </div>
      <div class="as-input-row">
        <input class="ui-input" placeholder="Напиши или скажи…" spellcheck="false">
        <button class="ui-btn icon-only as-mic" title="Голосовой ввод">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11 C5 15 8 17.5 12 17.5 C16 17.5 19 15 19 11 M12 17.5 L12 21"/>
          </svg>
        </button>
      </div>`;
    document.body.appendChild(panel);

    const hello = provider && provider.hello
      ? provider.hello
      : 'Привет! Я помогу открыть приложение, найти файл, сменить тему или посчитать. Скажи «помощь».';
    addMsg('bot', hello);

    const input = panel.querySelector('input');
    input.focus();
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { submit(input.value); input.value = ''; }
      if (e.key === 'Escape') close();
    });
    panel.querySelectorAll('.as-chip').forEach(c => c.addEventListener('click', () => submit(c.textContent)));

    const mic = panel.querySelector('.as-mic');
    mic.addEventListener('click', async () => {
      mic.classList.add('listening');
      try {
        const heard = provider && provider.listen ? await provider.listen() : await systemListen();
        mic.classList.remove('listening');
        if (heard) submit(heard);
      } catch (e) {
        mic.classList.remove('listening');
        addMsg('bot', '🎙 ' + (e.message || 'Не получилось послушать'));
      }
    });

    setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
  }
  function outside(e) {
    if (panel && !panel.contains(e.target) && !e.target.closest('#mb-assist')) close();
  }
  function close() {
    if (!panel) return;
    const p = panel;
    panel = null;
    document.removeEventListener('pointerdown', outside, true);
    p.classList.add('panel-out');
    setTimeout(() => p.remove(), 170);
  }
  function toggle() { if (panel) close(); else open(); }

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.altKey && e.code === 'KeyH') {
      e.preventDefault();
      toggle();
    }
  });

  OS.assistant = {
    registerProvider,
    registerCommand,
    run,
    commands: commandList,
    ask,
    say,
    open, close, toggle,
    get provider() { return provider ? { id: provider.id, name: provider.name } : null; },
  };
})();
