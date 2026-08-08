/* hinomaOS · Терминал — командная строка над OS.vfs */
(function () {
  'use strict';
  const { el, esc } = OS;

  const ICON = OS.appTile(
    { from: '#3A3A3E', to: '#131316' },
    `<path d="M -30 -16 L -12 0 L -30 16" fill="none" stroke="#30d158" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
     <path d="M -2 18 L 28 18" stroke="#fff" stroke-width="8" stroke-linecap="round"/>`
  );

  OS.injectStyle('app-terminal', `
    .term-root { flex:1; min-height:0; display:flex; flex-direction:column; background:#101014; color:#e8e8ec;
      font-family: var(--font-mono); font-size:13px; line-height:1.5; padding:10px 12px; overflow-y:auto; cursor:text; }
    .term-root .t-line { white-space:pre-wrap; word-break:break-all; }
    .term-root .t-prompt { color:#30d158; font-weight:700; }
    .term-root .t-err { color:#ff6961; }
    .term-root .t-dir { color:#6eb5ff; font-weight:700; }
    .term-root .t-dim { color:#8e8e99; }
    .term-root .t-accent { color:#bf5af2; }
    .term-input-row { display:flex; flex-wrap:wrap; }
    .term-input-row .t-typed { white-space:pre; }
    .term-caret { display:inline-block; width:8px; height:16px; background:#e8e8ec; vertical-align:text-bottom;
      animation: term-blink 1.1s step-end infinite; }
    @keyframes term-blink { 50% { opacity: 0; } }
    .term-hidden-input { position:absolute; opacity:0; pointer-events:none; width:1px; height:1px; }
  `);

  function shortPath(p) {
    if (p === '/') return '~';
    return '~' + p;
  }

  OS.registerApp({
    id: 'terminal',
    name: 'Терминал',
    icon: ICON,
    width: 720, height: 460,
    minWidth: 400, minHeight: 240,
    render(win) {
      let cwd = '/';
      const history = [];
      let histIdx = -1;
      let histDraft = '';

      const root = el('div', 'term-root');
      const input = el('input', 'term-hidden-input');
      input.setAttribute('autocomplete', 'off');
      win.content.appendChild(root);
      win.content.appendChild(input);
      win.content.style.position = 'relative';

      const inputRow = el('div', 't-line term-input-row');
      const renderInputRow = () => {
        inputRow.innerHTML = `<span class="t-prompt">user@hinoma</span><span>&nbsp;</span><span class="t-dir">${esc(shortPath(cwd))}</span><span>&nbsp;%&nbsp;</span><span class="t-typed">${esc(input.value)}</span><span class="term-caret"></span>`;
      };

      const print = (html, cls) => {
        const line = el('div', 't-line' + (cls ? ' ' + cls : ''));
        line.innerHTML = html;
        root.insertBefore(line, inputRow);
      };
      const echoLine = (text, cls) => print(esc(text), cls);
      const scroll = () => { root.scrollTop = root.scrollHeight; };

      root.appendChild(inputRow);
      print(`hinomaOS ${esc(OS.VERSION)} «${esc(OS.CODENAME)}» — Терминал`, 't-dim');
      print(`Набери <span class="t-accent">help</span> для списка команд.`, 't-dim');
      renderInputRow();

      const resolve = (p) => {
        if (!p) return cwd;
        if (p.startsWith('~')) p = p.slice(1) || '/';
        return p.startsWith('/') ? OS.vfs.normalize(p) : OS.vfs.join(cwd, p);
      };

      function tokenize(str) {
        const out = [];
        let cur = '', q = null;
        for (const ch of str) {
          if (q) { if (ch === q) q = null; else cur += ch; }
          else if (ch === '"' || ch === "'") q = ch;
          else if (ch === ' ') { if (cur) { out.push(cur); cur = ''; } }
          else cur += ch;
        }
        if (cur) out.push(cur);
        return out;
      }

      const COMMANDS = {
        help() {
          print([
            ['help', 'список команд'], ['ls [путь]', 'содержимое папки'], ['cd <путь>', 'сменить папку'],
            ['pwd', 'текущий путь'], ['cat <файл>', 'показать файл'], ['mkdir <имя>', 'создать папку'],
            ['touch <имя>', 'создать файл'], ['rm <путь>', 'удалить'], ['mv <а> <б>', 'переместить'],
            ['cp <а> <б>', 'копировать'], ['echo <текст> [> файл]', 'вывод / запись в файл'],
            ['open <путь|app>', 'открыть файл или приложение'], ['apps', 'список приложений'],
            ['install [url|файл]', 'установить приложение'],
            ['theme dark|light', 'сменить тему'], ['neofetch', 'информация о системе'],
            ['history', 'история команд'], ['date', 'дата и время'], ['whoami', 'кто я'], ['clear', 'очистить экран'],
          ].map(([c, d]) => `<span class="t-accent">${c.padEnd(24)}</span><span class="t-dim">${d}</span>`).join('\n'));
        },
        ls(args) {
          const items = OS.vfs.list(resolve(args[0]));
          if (!items.length) { print('<span class="t-dim">(пусто)</span>'); return; }
          print(items.map(i => i.type === 'dir' ? `<span class="t-dir">${esc(i.name)}/</span>` : esc(i.name)).join('  '));
        },
        cd(args) {
          const p = resolve(args[0] || '/');
          const st = OS.vfs.stat(p);
          if (!st) throw new Error('нет такого пути: ' + (args[0] || p));
          if (st.type !== 'dir') throw new Error('не папка: ' + args[0]);
          cwd = p;
        },
        pwd() { echoLine(cwd); },
        cat(args) {
          if (!args[0]) throw new Error('cat: укажи файл');
          const content = OS.vfs.read(resolve(args[0]));
          echoLine(content.length > 20000 ? content.slice(0, 20000) + '\n… (обрезано)' : content);
        },
        mkdir(args) { if (!args[0]) throw new Error('mkdir: укажи имя'); OS.vfs.mkdir(resolve(args[0])); },
        touch(args) {
          if (!args[0]) throw new Error('touch: укажи имя');
          const p = resolve(args[0]);
          if (!OS.vfs.exists(p)) OS.vfs.write(p, '');
        },
        rm(args) {
          const target = args.filter(a => !a.startsWith('-'))[0];
          if (!target) throw new Error('rm: укажи путь');
          OS.vfs.rm(resolve(target));
        },
        mv(args) { if (args.length < 2) throw new Error('mv: нужно два аргумента'); OS.vfs.mv(resolve(args[0]), resolve(args[1])); },
        cp(args) { if (args.length < 2) throw new Error('cp: нужно два аргумента'); OS.vfs.cp(resolve(args[0]), resolve(args[1])); },
        echo(args, raw) {
          const m = raw.match(/^echo\s+([\s\S]*?)\s*(>>|>)\s*(\S+)\s*$/);
          if (m) {
            const text = m[1].replace(/^["']|["']$/g, '');
            const p = resolve(m[3]);
            const prev = m[2] === '>>' && OS.vfs.exists(p) ? OS.vfs.read(p) : '';
            OS.vfs.write(p, prev + text + '\n');
          } else {
            echoLine(args.join(' '));
          }
        },
        open(args) {
          if (!args[0]) throw new Error('open: укажи путь или приложение');
          if (OS.getApp(args[0])) { OS.launch(args[0]); return; }
          const p = resolve(args[0]);
          if (!OS.vfs.exists(p)) throw new Error('не найдено: ' + args[0]);
          OS.openFile(p);
        },
        apps() {
          print(OS.allApps().map(a => `<span class="t-accent">${esc(a.id.padEnd(14))}</span>${esc(a.name)}`).join('\n'));
        },
        install(args) {
          if (!args[0]) { OS.launch('installer'); return; }
          if (/^https?:/.test(args[0])) { OS.installer.installFromUrl(args[0]); return; }
          const p = resolve(args[0]);
          if (!OS.vfs.exists(p)) throw new Error('не найдено: ' + args[0]);
          OS.installer.installCode(OS.vfs.read(p), OS.vfs.nameOf(p));
        },
        theme(args) {
          if (args[0] !== 'dark' && args[0] !== 'light') throw new Error('theme: dark или light');
          OS.settings.set('theme', args[0]);
          echoLine('тема: ' + (args[0] === 'dark' ? 'тёмная' : 'светлая'));
        },
        history() { history.forEach((h, i) => echoLine(`${String(i + 1).padStart(4)}  ${h}`)); },
        date() { echoLine(new Date().toLocaleString('ru-RU')); },
        whoami() { echoLine(OS.settings.get('userName')); },
        clear() { root.querySelectorAll('.t-line').forEach(n => { if (n !== inputRow) n.remove(); }); },
        neofetch() {
          const up = Math.floor(performance.now() / 1000);
          const uptime = `${Math.floor(up / 3600)} ч ${Math.floor(up / 60) % 60} мин`;
          const art = [
            '    ╱╲╱╲    ',
            '   ╱      ╲   ',
            '  │  ├──┤  │  ',
            '  │  │  │  │  ',
            '   ╲      ╱   ',
            '    ╲╱╲╱    ',
          ];
          const info = [
            ['', `<span class="t-prompt">${esc(OS.settings.get('userName'))}@hinoma</span>`],
            ['', '─────────────'],
            ['OS', `hinomaOS ${OS.VERSION} «${OS.CODENAME}»`],
            ['Ядро', 'browser-js 1.0'],
            ['Аптайм', uptime],
            ['Приложений', String(OS.allApps().length)],
            ['Оболочка', 'hsh 1.0'],
            ['Тема', document.documentElement.getAttribute('data-theme') === 'dark' ? 'тёмная' : 'светлая'],
            ['Акцент', OS.settings.get('accent')],
            ['Память', OS.fmtBytes(OS.vfs.usage()) + ' / ~5 МБ'],
          ];
          const lines = [];
          for (let i = 0; i < Math.max(art.length, info.length); i++) {
            const a = `<span class="t-accent">${esc((art[i] || '').padEnd(14))}</span>`;
            const inf = info[i] ? (info[i][0] ? `<span class="t-prompt">${esc(info[i][0])}</span><span class="t-dim">: </span>${info[i][1]}` : info[i][1]) : '';
            lines.push(a + ' ' + inf);
          }
          const sw = ['#ff453a', '#ff9f0a', '#ffd60a', '#30d158', '#0a84ff', '#bf5af2', '#ff375f', '#e8e8ec']
            .map(c => `<span style="background:${c};color:${c}">██</span>`).join('');
          print(lines.join('\n') + '\n\n' + ' '.repeat(15) + sw);
        },
      };

      function run(raw) {
        const trimmed = raw.trim();
        print(`<span class="t-prompt">user@hinoma</span> <span class="t-dir">${esc(shortPath(cwd))}</span> % ${esc(raw)}`);
        if (!trimmed) return;
        history.push(trimmed);
        const args = tokenize(trimmed);
        const cmd = args.shift();
        const fn = COMMANDS[cmd];
        if (!fn) { print(`<span class="t-err">команда не найдена: ${esc(cmd)}</span> <span class="t-dim">— набери help</span>`); return; }
        try { fn(args, trimmed); }
        catch (e) { print(`<span class="t-err">${esc(e.message)}</span>`); }
      }

      function complete() {
        const val = input.value;
        const m = val.match(/(\S*)$/);
        const frag = m ? m[1] : '';
        const slash = frag.lastIndexOf('/');
        const dirPart = slash >= 0 ? frag.slice(0, slash + 1) : '';
        const namePart = slash >= 0 ? frag.slice(slash + 1) : frag;
        let items;
        try { items = OS.vfs.list(resolve(dirPart || '.')); } catch (e) { return; }
        const matches = items.filter(i => i.name.toLowerCase().startsWith(namePart.toLowerCase()));
        if (matches.length === 1) {
          const add = matches[0].name.slice(namePart.length) + (matches[0].type === 'dir' ? '/' : '');
          input.value = val + add;
        } else if (matches.length > 1) {
          print(matches.map(i => i.type === 'dir' ? `<span class="t-dir">${esc(i.name)}/</span>` : esc(i.name)).join('  '));
        }
        renderInputRow();
        scroll();
      }

      input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          const v = input.value;
          input.value = '';
          histIdx = -1;
          run(v);
          renderInputRow();
          scroll();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (!history.length) return;
          if (histIdx === -1) { histDraft = input.value; histIdx = history.length - 1; }
          else if (histIdx > 0) histIdx--;
          input.value = history[histIdx];
          renderInputRow();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (histIdx === -1) return;
          histIdx++;
          if (histIdx >= history.length) { histIdx = -1; input.value = histDraft; }
          else input.value = history[histIdx];
          renderInputRow();
        } else if (e.key === 'Tab') {
          e.preventDefault();
          complete();
        } else if (e.key === 'c' && e.ctrlKey) {
          print(`<span class="t-prompt">user@hinoma</span> <span class="t-dir">${esc(shortPath(cwd))}</span> % ${esc(input.value)}^C`);
          input.value = '';
          renderInputRow();
          scroll();
        }
      });
      input.addEventListener('input', () => { renderInputRow(); scroll(); });

      const focusInput = () => setTimeout(() => input.focus(), 0);
      win.content.addEventListener('pointerup', () => {
        if (!window.getSelection().toString()) focusInput();
      });
      win.on('focus', focusInput);
      focusInput();
    },
  });
})();
