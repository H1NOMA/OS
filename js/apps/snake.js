/* hinomaOS · Змейка — классика на canvas */
(function () {
  'use strict';
  const { el } = OS;

  const ICON = OS.appTile(
    { from: '#9ADB4F', to: '#1F8A4C' },
    `<g fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round">
      <path d="M -28 22 L 6 22 C 14 22 14 6 6 6 L -6 6 C -14 6 -14 -10 -6 -10 L 28 -10"/>
    </g>
    <circle cx="28" cy="-10" r="7" fill="#fff"/>
    <circle cx="30" cy="-12" r="2" fill="#1F8A4C"/>
    <circle cx="-28" cy="-24" r="5.5" fill="#FF6B5E"/>`
  );

  OS.injectStyle('app-snake', `
    .sn-root { flex:1; min-height:0; display:flex; flex-direction:column; background:var(--content-bg); outline:none; }
    .sn-hud { flex:none; display:flex; align-items:center; gap:16px; padding:10px 16px; font-size:13px; }
    .sn-hud b { font-size:17px; font-variant-numeric:tabular-nums; }
    .sn-hud .dim { color:var(--text-3); font-size:12px; }
    .sn-stage { flex:1; min-height:0; display:flex; align-items:center; justify-content:center; padding:0 14px 14px; position:relative; }
    .sn-stage canvas { max-width:100%; max-height:100%; border-radius:12px;
      box-shadow: 0 0 0 1px var(--divider), 0 8px 30px rgba(0,0,0,.18); }
    .sn-overlay { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center;
      justify-content:center; gap:10px; text-align:center; pointer-events:none; }
    .sn-overlay .big { font-size:26px; font-weight:800; text-shadow:0 2px 12px rgba(0,0,0,.4); color:#fff; }
    .sn-overlay .small { font-size:13px; color:rgba(255,255,255,.85); text-shadow:0 1px 6px rgba(0,0,0,.4); }
  `);

  const COLS = 22, ROWS = 15, CELL = 26;

  OS.registerApp({
    id: 'snake',
    name: 'Змейка',
    icon: ICON,
    width: 640, height: 520,
    minWidth: 480, minHeight: 400,
    singleton: true,
    render(win) {
      let snake, dir, nextDir, food, score, speed, timer = null, state = 'idle'; // idle|run|pause|over
      let best = OS.settings.get('snake.best', 0);

      const root = el('div', 'sn-root');
      root.tabIndex = 0;
      root.innerHTML = `
        <div class="sn-hud">
          <span>Счёт <b class="sn-score">0</b></span>
          <span>Рекорд <b class="sn-best">${best}</b></span>
          <span class="dim sn-speed"></span>
          <span style="flex:1"></span>
          <span class="dim">стрелки / WASD · пробел — пауза</span>
        </div>
        <div class="sn-stage">
          <canvas width="${COLS * CELL}" height="${ROWS * CELL}"></canvas>
          <div class="sn-overlay"></div>
        </div>`;
      win.content.appendChild(root);

      const canvas = root.querySelector('canvas');
      const cx = canvas.getContext('2d');
      const scoreEl = root.querySelector('.sn-score');
      const bestEl = root.querySelector('.sn-best');
      const speedEl = root.querySelector('.sn-speed');
      const overlay = root.querySelector('.sn-overlay');

      const accent = () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#23D1A8';

      function reset() {
        snake = [{ x: 6, y: 7 }, { x: 5, y: 7 }, { x: 4, y: 7 }];
        dir = { x: 1, y: 0 };
        nextDir = dir;
        score = 0;
        speed = 150;
        placeFood();
        scoreEl.textContent = '0';
        speedEl.textContent = 'скорость 1';
      }

      function placeFood() {
        do {
          food = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
        } while (snake.some(s => s.x === food.x && s.y === food.y));
      }

      function setState(st, msgBig, msgSmall) {
        state = st;
        overlay.innerHTML = msgBig ? `<div class="big">${msgBig}</div><div class="small">${msgSmall || ''}</div>` : '';
      }

      function start() {
        reset();
        setState('run');
        clearInterval(timer);
        timer = setInterval(tick, speed);
      }

      function tick() {
        dir = nextDir;
        const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
        // столкновения
        if (head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS ||
            snake.some(s => s.x === head.x && s.y === head.y)) {
          gameOver();
          return;
        }
        snake.unshift(head);
        if (head.x === food.x && head.y === food.y) {
          score += 10;
          scoreEl.textContent = score;
          OS.beep(720 + Math.min(500, score * 4), .05, .3);
          placeFood();
          // ускорение каждые 50 очков
          const level = Math.floor(score / 50);
          const newSpeed = Math.max(70, 150 - level * 14);
          if (newSpeed !== speed) {
            speed = newSpeed;
            speedEl.textContent = 'скорость ' + (level + 1);
            clearInterval(timer);
            timer = setInterval(tick, speed);
          }
        } else {
          snake.pop();
        }
        draw();
      }

      function gameOver() {
        clearInterval(timer);
        timer = null;
        OS.beep(150, .3);
        if (score > best) {
          best = score;
          OS.settings.set('snake.best', best);
          bestEl.textContent = best;
          OS.notify({ title: 'Змейка', body: `Новый рекорд: ${best}! 🏆`, appId: 'snake' });
        }
        setState('over', 'Игра окончена', `Счёт: ${score} · Enter — ещё раз`);
        draw(true);
      }

      function rr(x, y, w, h, r) {
        cx.beginPath();
        cx.roundRect(x, y, w, h, r);
        cx.fill();
      }

      function draw(dead) {
        const dark = document.documentElement.getAttribute('data-theme') === 'dark';
        // поле в шашечку
        cx.fillStyle = dark ? '#141620' : '#f2efe8';
        cx.fillRect(0, 0, canvas.width, canvas.height);
        cx.fillStyle = dark ? 'rgba(255,255,255,.025)' : 'rgba(0,0,0,.03)';
        for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
          if ((x + y) % 2) cx.fillRect(x * CELL, y * CELL, CELL, CELL);
        }
        // еда
        cx.fillStyle = '#FF6B5E';
        cx.beginPath();
        cx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2 + 1, CELL * 0.34, 0, Math.PI * 2);
        cx.fill();
        cx.fillStyle = '#2E8B57';
        rr(food.x * CELL + CELL / 2 - 1.5, food.y * CELL + 3, 3, 6, 2);
        // змейка
        const ac = accent();
        snake.forEach((s, i) => {
          const t = i / Math.max(1, snake.length - 1);
          cx.fillStyle = dead ? '#8e8e96' : ac;
          cx.globalAlpha = 1 - t * 0.45;
          const pad = 2 + t * 1.5;
          rr(s.x * CELL + pad, s.y * CELL + pad, CELL - pad * 2, CELL - pad * 2, 7 - t * 3);
        });
        cx.globalAlpha = 1;
        // глаза
        if (!dead && snake.length) {
          const h = snake[0];
          cx.fillStyle = '#fff';
          const ex = h.x * CELL + CELL / 2 + dir.x * 4, ey = h.y * CELL + CELL / 2 + dir.y * 4;
          const off = dir.x !== 0 ? [0, 4.5] : [4.5, 0];
          cx.beginPath(); cx.arc(ex - off[0], ey - off[1], 2.6, 0, 7); cx.fill();
          cx.beginPath(); cx.arc(ex + off[0], ey + off[1], 2.6, 0, 7); cx.fill();
        }
      }

      function togglePause() {
        if (state === 'run') {
          clearInterval(timer);
          timer = null;
          setState('pause', 'Пауза', 'пробел — продолжить');
        } else if (state === 'pause') {
          setState('run');
          timer = setInterval(tick, speed);
        }
      }

      const onKey = (e) => {
        if (OS.wm.focused !== win) return;
        const map = {
          ArrowUp: { x: 0, y: -1 }, KeyW: { x: 0, y: -1 },
          ArrowDown: { x: 0, y: 1 }, KeyS: { x: 0, y: 1 },
          ArrowLeft: { x: -1, y: 0 }, KeyA: { x: -1, y: 0 },
          ArrowRight: { x: 1, y: 0 }, KeyD: { x: 1, y: 0 },
        };
        if (map[e.code]) {
          e.preventDefault();
          if (state === 'idle') { start(); return; }
          if (state !== 'run') return;
          const d = map[e.code];
          if (d.x !== -dir.x || d.y !== -dir.y) nextDir = d; // нельзя развернуться на месте
        } else if (e.code === 'Space') {
          e.preventDefault();
          if (state === 'idle') start(); else togglePause();
        } else if (e.code === 'Enter' && (state === 'over' || state === 'idle')) {
          e.preventDefault();
          start();
        }
      };
      document.addEventListener('keydown', onKey);
      canvas.addEventListener('click', () => { if (state !== 'run') start(); root.focus(); });

      win.on('focus', () => setTimeout(() => root.focus(), 0));
      win.on('close', () => {
        clearInterval(timer);
        document.removeEventListener('keydown', onKey);
      });

      reset();
      draw();
      setState('idle', 'Змейка', 'нажми стрелку или пробел');
      setTimeout(() => root.focus(), 60);
    },
  });
})();
