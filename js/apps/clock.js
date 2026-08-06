/* hinomaOS · Часы — мировое время, секундомер, таймер */
(function () {
  'use strict';
  const { el, esc } = OS;

  const ICON = OS.appTile(
    { from: '#32D74B', to: '#0E8F2F' },
    `<g>
      <circle cx="0" cy="0" r="30" fill="#101014"/>
      <circle cx="0" cy="0" r="30" fill="none" stroke="rgba(255,255,255,.9)" stroke-width="4"/>
      <g fill="#fff"><circle cx="0" cy="-24" r="2"/><circle cx="24" cy="0" r="2"/><circle cx="0" cy="24" r="2"/><circle cx="-24" cy="0" r="2"/></g>
      <path d="M 0 0 L 0 -17" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/>
      <path d="M 0 0 L 12 8" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/>
      <path d="M 0 3 L -8 -14" stroke="#ff9f0a" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="0" cy="0" r="3" fill="#ff9f0a"/>
    </g>`
  );

  OS.injectStyle('app-clock', `
    .ck-root { flex:1; min-height:0; display:flex; flex-direction:column; }
    .ck-body { flex:1; min-height:0; overflow-y:auto; padding:16px; display:flex; flex-direction:column; align-items:center; gap:14px; }
    .ck-big { font-size:46px; font-weight:800; font-variant-numeric:tabular-nums; letter-spacing:-1px; color:var(--text); }
    .ck-face { filter: drop-shadow(0 6px 18px rgba(0,0,0,.25)); }
    .ck-cities { width:100%; display:flex; flex-direction:column; gap:6px; }
    .ck-city { display:flex; align-items:center; gap:11px; padding:9px 13px; background:var(--ctl-bg); border-radius:11px; }
    .ck-city .cc-ic { width:20px; height:20px; color:var(--text-2); flex:none; }
    .ck-city .nm { font-weight:600; color:var(--text); }
    .ck-city .off { font-size:12px; color:var(--text-3); }
    .ck-city .tm { margin-left:auto; font-size:19px; font-weight:700; font-variant-numeric:tabular-nums; color:var(--text); }
    .ck-btnrow { display:flex; gap:12px; }
    .ck-round { width:74px; height:74px; border-radius:50%; border:none; font-size:14px; font-weight:700;
      font-family:var(--font); cursor:default; transition: filter .1s, transform .1s; }
    .ck-round:active { transform:scale(.94); }
    .ck-round.go { background:rgba(48,209,88,.22); color:#30d158; }
    .ck-round.stop { background:rgba(255,69,58,.22); color:#ff453a; }
    .ck-round.neutral { background:var(--ctl-bg-hover); color:var(--text); }
    .ck-round:disabled { opacity:.35; }
    .ck-laps { width:100%; display:flex; flex-direction:column-reverse; gap:4px; }
    .ck-lap { display:flex; justify-content:space-between; padding:7px 13px; border-radius:9px;
      background:var(--ctl-bg); font-variant-numeric:tabular-nums; font-size:13.5px; color:var(--text); }
    .ck-lap.best { color:#30d158; } .ck-lap.worst { color:#ff453a; }
    .ck-timer-set { display:flex; align-items:center; gap:8px; }
    .ck-timer-set .ui-input { width:64px; text-align:center; font-size:17px; font-variant-numeric:tabular-nums; }
    .ck-presets { display:flex; gap:8px; }
    .ck-ring-wrap { position:relative; width:210px; height:210px; }
    .ck-ring-wrap svg { transform:rotate(-90deg); }
    .ck-ring-wrap .ck-remain { position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
      font-size:36px; font-weight:800; font-variant-numeric:tabular-nums; color:var(--text); }
  `);

  const CITIES = [
    { name: 'Москва', tz: 'Europe/Moscow' },
    { name: 'Лондон', tz: 'Europe/London' },
    { name: 'Нью-Йорк', tz: 'America/New_York' },
    { name: 'Токио', tz: 'Asia/Tokyo' },
    { name: 'Дубай', tz: 'Asia/Dubai' },
    { name: 'Сидней', tz: 'Australia/Sydney' },
  ];

  OS.registerApp({
    id: 'clock',
    name: 'Часы',
    icon: ICON,
    width: 460, height: 560,
    minWidth: 380, minHeight: 420,
    singleton: true,
    render(win) {
      let tab = 'world';
      let raf = null, worldTimer = null, timerInt = null;
      // секундомер
      let swRunning = false, swStart = 0, swAcc = 0, laps = [];
      // таймер
      let tmTotal = 300, tmLeft = 300, tmRunning = false, tmLastTick = 0;

      const root = el('div', 'ck-root');
      root.innerHTML = `
        <div class="ui-toolbar" style="justify-content:center">
          <div class="ui-seg">
            <button class="seg-btn on" data-tab="world">Мир</button>
            <button class="seg-btn" data-tab="sw">Секундомер</button>
            <button class="seg-btn" data-tab="timer">Таймер</button>
          </div>
        </div>
        <div class="ck-body"></div>`;
      win.content.appendChild(root);
      const body = root.querySelector('.ck-body');

      root.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {
        tab = b.dataset.tab;
        root.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('on', x === b));
        stopLoops();
        render();
      }));

      function stopLoops() {
        cancelAnimationFrame(raf);
        clearInterval(worldTimer);
      }

      /* ---------- Мир ---------- */
      function renderWorld() {
        body.innerHTML = `
          <svg class="ck-face" width="190" height="190" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="95" fill="var(--content-bg)" stroke="var(--divider)" stroke-width="2"/>
            ${Array.from({ length: 12 }, (_, i) => {
              const a = i * 30 * Math.PI / 180;
              const r1 = i % 3 === 0 ? 80 : 86, r2 = 91;
              return `<line x1="${100 + r1 * Math.sin(a)}" y1="${100 - r1 * Math.cos(a)}" x2="${100 + r2 * Math.sin(a)}" y2="${100 - r2 * Math.cos(a)}" stroke="var(--text-3)" stroke-width="${i % 3 === 0 ? 3 : 1.5}" stroke-linecap="round"/>`;
            }).join('')}
            <line class="ck-h" x1="100" y1="100" x2="100" y2="52" stroke="var(--text)" stroke-width="6" stroke-linecap="round"/>
            <line class="ck-m" x1="100" y1="100" x2="100" y2="34" stroke="var(--text)" stroke-width="4" stroke-linecap="round"/>
            <line class="ck-s" x1="100" y1="112" x2="100" y2="26" stroke="#ff453a" stroke-width="2" stroke-linecap="round"/>
            <circle cx="100" cy="100" r="4.5" fill="#ff453a"/>
            <circle cx="100" cy="100" r="2" fill="var(--content-bg)"/>
          </svg>
          <div class="ck-big ck-digital"></div>
          <div class="ck-cities">
            ${CITIES.map(c => `<div class="ck-city" data-tz="${c.tz}">
              <div class="cc-ic"></div>
              <div><div class="nm">${esc(c.name)}</div><div class="off"></div></div>
              <div class="tm"></div>
            </div>`).join('')}
          </div>`;

        const hH = body.querySelector('.ck-h'), mH = body.querySelector('.ck-m'), sH = body.querySelector('.ck-s');
        const dig = body.querySelector('.ck-digital');

        const spin = () => {
          if (tab !== 'world' || !hH.isConnected) return;
          const d = new Date();
          const ms = d.getMilliseconds();
          const s = d.getSeconds() + ms / 1000;
          const m = d.getMinutes() + s / 60;
          const h = (d.getHours() % 12) + m / 60;
          sH.setAttribute('transform', `rotate(${s * 6} 100 100)`);
          mH.setAttribute('transform', `rotate(${m * 6} 100 100)`);
          hH.setAttribute('transform', `rotate(${h * 30} 100 100)`);
          dig.textContent = d.toLocaleTimeString('ru-RU');
          raf = requestAnimationFrame(spin);
        };
        spin();

        const updateCities = () => {
          if (tab !== 'world') return;
          const now = new Date();
          body.querySelectorAll('.ck-city').forEach(row => {
            const tz = row.dataset.tz;
            const fmt = new Intl.DateTimeFormat('ru-RU', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
            row.querySelector('.tm').textContent = fmt.format(now);
            // смещение от локального
            const remote = new Date(now.toLocaleString('en-US', { timeZone: tz }));
            const local = new Date(now.toLocaleString('en-US'));
            const diff = Math.round((remote - local) / 3600000);
            row.querySelector('.off').textContent = diff === 0 ? 'как у тебя' : (diff > 0 ? `+${diff} ч` : `${diff} ч`);
            const hour = +new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(now);
            row.querySelector('.cc-ic').innerHTML = (hour >= 7 && hour < 21) ? OS.icons.sun : OS.icons.moon;
          });
        };
        updateCities();
        worldTimer = setInterval(updateCities, 10000);
      }

      /* ---------- Секундомер ---------- */
      const swNow = () => swAcc + (swRunning ? performance.now() - swStart : 0);
      const swFmt = (ms) => {
        const m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60, cs = Math.floor(ms / 10) % 100;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(cs).padStart(2, '0')}`;
      };

      function renderSw() {
        body.innerHTML = `
          <div class="ck-big" style="font-size:56px;margin-top:20px">${swFmt(swNow())}</div>
          <div class="ck-btnrow">
            <button class="ck-round neutral ck-lapreset">${swRunning ? 'Круг' : 'Сброс'}</button>
            <button class="ck-round ${swRunning ? 'stop' : 'go'} ck-startstop">${swRunning ? 'Стоп' : 'Старт'}</button>
          </div>
          <div class="ck-laps"></div>`;
        const big = body.querySelector('.ck-big');
        const lapsEl = body.querySelector('.ck-laps');

        const drawLaps = () => {
          if (!laps.length) { lapsEl.innerHTML = ''; return; }
          const deltas = laps.map((v, i) => v - (laps[i - 1] || 0));
          const best = Math.min(...deltas), worst = Math.max(...deltas);
          lapsEl.innerHTML = laps.map((v, i) => {
            const d = deltas[i];
            const cls = deltas.length > 1 ? (d === best ? 'best' : d === worst ? 'worst' : '') : '';
            return `<div class="ck-lap ${cls}"><span>Круг ${i + 1}</span><span>${swFmt(d)}</span></div>`;
          }).join('');
        };
        drawLaps();

        const loop = () => {
          if (tab !== 'sw' || !big.isConnected) return;
          big.textContent = swFmt(swNow());
          raf = requestAnimationFrame(loop);
        };
        loop();

        body.querySelector('.ck-startstop').addEventListener('click', () => {
          if (swRunning) { swAcc = swNow(); swRunning = false; }
          else { swStart = performance.now(); swRunning = true; }
          renderSw();
        });
        body.querySelector('.ck-lapreset').addEventListener('click', () => {
          if (swRunning) { laps.push(swNow()); drawLaps(); }
          else { swAcc = 0; laps = []; renderSw(); }
        });
      }

      /* ---------- Таймер ---------- */
      const tmFmt = (s) => {
        s = Math.max(0, Math.ceil(s));
        const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, sec = s % 60;
        return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
      };

      function renderTimer() {
        const R = 92, C = 2 * Math.PI * R;
        body.innerHTML = `
          <div class="ck-ring-wrap">
            <svg width="210" height="210" viewBox="0 0 210 210">
              <circle cx="105" cy="105" r="${R}" fill="none" stroke="var(--ctl-bg-hover)" stroke-width="9"/>
              <circle class="ck-ring" cx="105" cy="105" r="${R}" fill="none" stroke="var(--accent)" stroke-width="9"
                stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="0"/>
            </svg>
            <div class="ck-remain">${tmFmt(tmLeft)}</div>
          </div>
          <div class="ck-timer-set ${tmRunning ? 'hidden' : ''}">
            <input class="ui-input tm-h" type="number" min="0" max="23" value="${Math.floor(tmTotal / 3600)}"> ч
            <input class="ui-input tm-m" type="number" min="0" max="59" value="${Math.floor(tmTotal / 60) % 60}"> мин
            <input class="ui-input tm-s" type="number" min="0" max="59" value="${tmTotal % 60}"> с
          </div>
          <div class="ck-presets ${tmRunning ? 'hidden' : ''}">
            <button class="ui-btn" data-p="60">1 мин</button>
            <button class="ui-btn" data-p="300">5 мин</button>
            <button class="ui-btn" data-p="600">10 мин</button>
          </div>
          <div class="ck-btnrow">
            <button class="ck-round neutral ck-tm-reset">Сброс</button>
            <button class="ck-round ${tmRunning ? 'stop' : 'go'} ck-tm-go">${tmRunning ? 'Пауза' : 'Старт'}</button>
          </div>`;

        const ring = body.querySelector('.ck-ring');
        const remain = body.querySelector('.ck-remain');
        const upd = () => {
          remain.textContent = tmFmt(tmLeft);
          ring.style.strokeDashoffset = String(C * (1 - (tmTotal ? tmLeft / tmTotal : 0)));
        };
        upd();

        const readInputs = () => {
          const h = +body.querySelector('.tm-h').value || 0;
          const m = +body.querySelector('.tm-m').value || 0;
          const s = +body.querySelector('.tm-s').value || 0;
          tmTotal = Math.max(1, h * 3600 + m * 60 + s);
          tmLeft = tmTotal;
          upd();
        };
        body.querySelectorAll('.tm-h,.tm-m,.tm-s').forEach(i => i.addEventListener('change', readInputs));
        body.querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => {
          tmTotal = tmLeft = +b.dataset.p;
          renderTimer();
        }));

        body.querySelector('.ck-tm-go').addEventListener('click', () => {
          if (tmRunning) { tmRunning = false; clearInterval(timerInt); }
          else {
            if (tmLeft <= 0) tmLeft = tmTotal;
            tmRunning = true;
            tmLastTick = performance.now();
            timerInt = setInterval(() => {
              const now = performance.now();
              tmLeft -= (now - tmLastTick) / 1000;
              tmLastTick = now;
              if (tmLeft <= 0) {
                tmLeft = 0;
                tmRunning = false;
                clearInterval(timerInt);
                OS.notify({ title: 'Часы', body: 'Таймер завершён! ⏰', appId: 'clock' });
                OS.beep(880, .22); setTimeout(() => OS.beep(880, .22), 350); setTimeout(() => OS.beep(1100, .3), 700);
                renderTimer();
                return;
              }
              upd();
            }, 200);
          }
          renderTimer();
        });
        body.querySelector('.ck-tm-reset').addEventListener('click', () => {
          tmRunning = false;
          clearInterval(timerInt);
          tmLeft = tmTotal;
          renderTimer();
        });
      }

      function render() {
        if (tab === 'world') renderWorld();
        else if (tab === 'sw') renderSw();
        else renderTimer();
      }

      win.on('close', () => {
        stopLoops();
        clearInterval(timerInt);
      });

      render();
    },
  });
})();
