/* Hiko OS · Сапёр — классический Minesweeper */
(function () {
  'use strict';
  const { el, esc } = OS;

  const ICON = OS.appTile(
    { from: '#8E8E93', to: '#48484A' },
    `<g>
      <g stroke="#fff" stroke-width="6" stroke-linecap="round">
        <path d="M 0 -32 L 0 -22"/><path d="M 0 22 L 0 32"/><path d="M -32 0 L -22 0"/><path d="M 22 0 L 32 0"/>
        <path d="M -23 -23 L -16 -16"/><path d="M 16 16 L 23 23"/><path d="M 23 -23 L 16 -16"/><path d="M -16 16 L -23 23"/>
      </g>
      <circle cx="0" cy="0" r="18" fill="#1d1d1f"/>
      <circle cx="-6" cy="-6" r="5" fill="rgba(255,255,255,.55)"/>
    </g>`
  );

  OS.injectStyle('app-minesweeper', `
    .ms-root { flex:1; min-height:0; display:flex; flex-direction:column; background:var(--content-bg); }
    .ms-top { display:flex; align-items:center; justify-content:center; gap:10px; padding:10px 14px 4px; }
    .ms-panel { display:flex; align-items:center; justify-content:space-between; gap:12px; margin:8px 14px;
      padding:8px 14px; background:var(--ctl-bg); border-radius:10px; }
    .ms-lcd { font-family:var(--font-mono); font-size:22px; font-weight:700; color:#ff453a; background:#1a1a1c;
      padding:2px 10px; border-radius:7px; min-width:74px; text-align:center; letter-spacing:2px; }
    .ms-face { width:44px; height:44px; border:none; border-radius:10px; background:var(--ctl-bg-hover);
      font-size:24px; cursor:default; transition: transform .08s; }
    .ms-face:active { transform:scale(.92); }
    .ms-best { text-align:center; font-size:11.5px; color:var(--text-3); padding-bottom:4px; }
    .ms-board-wrap { flex:1; display:flex; align-items:center; justify-content:center; padding:4px 14px 14px; overflow:auto; }
    .ms-board { display:grid; gap:2px; background:var(--divider); padding:3px; border-radius:8px; user-select:none; }
    .ms-cell { width:26px; height:26px; display:flex; align-items:center; justify-content:center;
      font-family:var(--font-mono); font-size:14.5px; font-weight:800; border-radius:4px; cursor:default;
      background:linear-gradient(135deg, var(--ctl-bg-hover), var(--ctl-bg));
      box-shadow: inset 1px 1px 0 rgba(255,255,255,.22), inset -1px -1px 0 rgba(0,0,0,.18); }
    .ms-cell:hover { filter:brightness(1.12); }
    .ms-cell.open { background:var(--content-bg); box-shadow: inset 0 0 0 1px var(--divider); filter:none; }
    .ms-cell.boom { background:#ff453a !important; }
    .ms-c1{color:#0a84ff}.ms-c2{color:#30d158}.ms-c3{color:#ff453a}.ms-c4{color:#5e5ce6}
    .ms-c5{color:#a2845e}.ms-c6{color:#64d2ff}.ms-c7{color:var(--text)}.ms-c8{color:#8e8e93}
  `);

  const LEVELS = {
    beginner: { name: 'Новичок', w: 9, h: 9, mines: 10 },
    amateur: { name: 'Любитель', w: 16, h: 16, mines: 40 },
    pro: { name: 'Профи', w: 22, h: 16, mines: 80 },
  };

  OS.registerApp({
    id: 'minesweeper',
    name: 'Сапёр',
    icon: ICON,
    width: 420, height: 560,
    minWidth: 340, minHeight: 420,
    singleton: true,
    render(win) {
      let level = 'beginner';
      let grid, opened, flags, mines, started, over, timer, seconds, minesLeft;

      const root = el('div', 'ms-root');
      root.innerHTML = `
        <div class="ms-top"><div class="ui-seg">
          ${Object.entries(LEVELS).map(([k, v]) => `<button class="seg-btn ${k === level ? 'on' : ''}" data-lvl="${k}">${v.name}</button>`).join('')}
        </div></div>
        <div class="ms-panel">
          <div class="ms-lcd ms-mines">010</div>
          <button class="ms-face">🙂</button>
          <div class="ms-lcd ms-time">000</div>
        </div>
        <div class="ms-best"></div>
        <div class="ms-board-wrap"><div class="ms-board"></div></div>`;
      win.content.appendChild(root);

      const boardEl = root.querySelector('.ms-board');
      const faceEl = root.querySelector('.ms-face');
      const minesEl = root.querySelector('.ms-mines');
      const timeEl = root.querySelector('.ms-time');
      const bestEl = root.querySelector('.ms-best');

      root.querySelectorAll('[data-lvl]').forEach(b => b.addEventListener('click', () => {
        level = b.dataset.lvl;
        root.querySelectorAll('[data-lvl]').forEach(x => x.classList.toggle('on', x === b));
        resizeWin();
        reset();
      }));
      faceEl.addEventListener('click', reset);

      function resizeWin() {
        const L = LEVELS[level];
        const r = win.rect();
        const w = Math.max(340, L.w * 28 + 60);
        const h = Math.max(420, L.h * 28 + 220);
        win.setRect({ x: Math.max(8, Math.min(r.x, innerWidth - w - 8)), y: Math.max(38, Math.min(r.y, innerHeight - h - 8)), w, h }, true);
      }

      const lcd = (n) => String(Math.max(-99, Math.min(999, n))).padStart(3, '0');
      const bestKey = () => 'minesweeper.best.' + level;
      const showBest = () => {
        const b = OS.settings.get(bestKey());
        bestEl.textContent = b ? `Рекорд (${LEVELS[level].name.toLowerCase()}): ${b} сек` : 'Рекорда пока нет — вперёд!';
      };

      function reset() {
        const L = LEVELS[level];
        clearInterval(timer);
        timer = null;
        seconds = 0;
        started = false;
        over = false;
        minesLeft = L.mines;
        grid = [];
        opened = 0;
        flags = new Set();
        mines = new Set();
        faceEl.textContent = '🙂';
        minesEl.textContent = lcd(minesLeft);
        timeEl.textContent = '000';
        showBest();

        boardEl.style.gridTemplateColumns = `repeat(${L.w}, 26px)`;
        boardEl.innerHTML = '';
        for (let y = 0; y < L.h; y++) {
          grid.push([]);
          for (let x = 0; x < L.w; x++) {
            const c = el('div', 'ms-cell');
            c.dataset.x = x; c.dataset.y = y;
            grid[y].push({ el: c, mine: false, open: false, flag: 0, n: 0 });
            boardEl.appendChild(c);
          }
        }
      }

      function plantMines(sx, sy) {
        const L = LEVELS[level];
        const forbidden = new Set();
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) forbidden.add((sy + dy) * L.w + (sx + dx));
        let planted = 0;
        while (planted < L.mines) {
          const i = Math.floor(Math.random() * L.w * L.h);
          if (mines.has(i) || forbidden.has(i)) continue;
          mines.add(i);
          grid[Math.floor(i / L.w)][i % L.w].mine = true;
          planted++;
        }
        for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
          let n = 0;
          eachNb(x, y, (c) => { if (c.mine) n++; });
          grid[y][x].n = n;
        }
      }

      function eachNb(x, y, fn) {
        const L = LEVELS[level];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < L.w && ny < L.h) fn(grid[ny][nx], nx, ny);
        }
      }

      function startTimer() {
        timer = setInterval(() => {
          seconds++;
          timeEl.textContent = lcd(seconds);
        }, 1000);
      }

      function openCell(x, y) {
        const c = grid[y][x];
        if (c.open || c.flag === 1 || over) return;
        if (!started) { plantMines(x, y); started = true; startTimer(); }
        c.open = true;
        opened++;
        c.el.classList.add('open');
        if (c.mine) { lose(c); return; }
        if (c.n) {
          c.el.textContent = c.n;
          c.el.classList.add('ms-c' + c.n);
        } else {
          // flood fill без рекурсии
          const stack = [[x, y]];
          while (stack.length) {
            const [cx, cy] = stack.pop();
            eachNb(cx, cy, (nc, nx, ny) => {
              if (nc.open || nc.flag === 1 || nc.mine) return;
              nc.open = true;
              opened++;
              nc.el.classList.add('open');
              if (nc.n) { nc.el.textContent = nc.n; nc.el.classList.add('ms-c' + nc.n); }
              else stack.push([nx, ny]);
            });
          }
        }
        checkWin();
      }

      function chord(x, y) {
        const c = grid[y][x];
        if (!c.open || !c.n || over) return;
        let f = 0;
        eachNb(x, y, (nc) => { if (nc.flag === 1) f++; });
        if (f !== c.n) return;
        eachNb(x, y, (nc, nx, ny) => { if (!nc.open && nc.flag !== 1) openCell(nx, ny); });
      }

      function toggleFlag(x, y) {
        const c = grid[y][x];
        if (c.open || over) return;
        c.flag = (c.flag + 1) % 3;
        c.el.textContent = c.flag === 1 ? '🚩' : c.flag === 2 ? '?' : '';
        minesLeft += c.flag === 1 ? -1 : c.flag === 2 ? 1 : 0;
        minesEl.textContent = lcd(minesLeft);
      }

      function lose(boomCell) {
        over = true;
        clearInterval(timer);
        faceEl.textContent = '💀';
        const L = LEVELS[level];
        for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
          const c = grid[y][x];
          if (c.mine) { c.el.classList.add('open'); c.el.textContent = '💣'; }
        }
        boomCell.el.classList.add('boom');
        OS.beep(140, .3);
      }

      function checkWin() {
        const L = LEVELS[level];
        if (opened !== L.w * L.h - L.mines || over) return;
        over = true;
        clearInterval(timer);
        faceEl.textContent = '😎';
        const best = OS.settings.get(bestKey());
        const isRecord = !best || seconds < best;
        if (isRecord) OS.settings.set(bestKey(), seconds);
        showBest();
        OS.beep(880, .18);
        OS.notify({ title: 'Сапёр', body: `Победа за ${seconds} сек!${isRecord ? ' 🏆 Новый рекорд!' : ''}`, appId: 'minesweeper' });
      }

      boardEl.addEventListener('pointerdown', (e) => {
        const cell = e.target.closest('.ms-cell');
        if (!cell || over) return;
        if (e.button === 0) faceEl.textContent = '😮';
      });
      window.addEventListener('pointerup', restoreFace);
      function restoreFace() { if (!over) faceEl.textContent = '🙂'; }

      boardEl.addEventListener('click', (e) => {
        const cell = e.target.closest('.ms-cell');
        if (!cell) return;
        const x = +cell.dataset.x, y = +cell.dataset.y;
        if (grid[y][x].open) chord(x, y);
        else openCell(x, y);
      });
      boardEl.addEventListener('dblclick', (e) => {
        const cell = e.target.closest('.ms-cell');
        if (!cell) return;
        chord(+cell.dataset.x, +cell.dataset.y);
      });
      boardEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const cell = e.target.closest('.ms-cell');
        if (!cell) return;
        toggleFlag(+cell.dataset.x, +cell.dataset.y);
      });

      win.on('close', () => {
        clearInterval(timer);
        window.removeEventListener('pointerup', restoreFace);
      });

      reset();
    },
  });
})();
