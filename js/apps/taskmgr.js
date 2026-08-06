/* hinomaOS · Диспетчер задач — процессы и производительность */
(function () {
  'use strict';
  const { el, esc } = OS;

  const ICON = OS.appTile(
    { from: '#5AC8FA', to: '#2C7CD6' },
    `<g>
      <rect x="-30" y="-24" width="60" height="42" rx="6" fill="none" stroke="#fff" stroke-width="6"/>
      <path d="M -22 6 L -12 -6 L -4 2 L 8 -12 L 22 -2" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M -12 30 L 12 30" stroke="#fff" stroke-width="6" stroke-linecap="round"/>
    </g>`
  );

  OS.injectStyle('app-taskmgr', `
    .tm-root { flex:1; min-height:0; display:flex; flex-direction:column; }
    .tm-body { flex:1; min-height:0; overflow-y:auto; padding:10px 12px; }
    .tm-table { width:100%; border-collapse:collapse; font-size:13px; }
    .tm-table th { text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:.4px;
      color:var(--text-3); padding:6px 10px; border-bottom:1px solid var(--divider); font-weight:700; }
    .tm-table th.num, .tm-table td.num { text-align:right; font-variant-numeric:tabular-nums; }
    .tm-table td { padding:7px 10px; border-radius:0; cursor:default; }
    .tm-table tr.proc:hover td { background:var(--hover); }
    .tm-table tr.proc.sel td { background:var(--accent); color:#fff; }
    .tm-table tr.proc.sel .tm-dim { color:rgba(255,255,255,.7); }
    .tm-name { display:flex; align-items:center; gap:9px; font-weight:600; }
    .tm-name .tm-ic { width:22px; height:22px; flex:none; }
    .tm-name .tm-ic svg { width:100%; height:100%; }
    .tm-dim { color:var(--text-2); font-weight:400; }
    .tm-foot { flex:none; display:flex; align-items:center; gap:14px; padding:9px 14px;
      border-top:1px solid var(--divider); font-size:12.5px; color:var(--text-2); }
    .tm-foot .ui-btn { margin-left:auto; }
    .tm-perf { display:flex; flex-direction:column; gap:14px; }
    .tm-card { background:var(--ctl-bg); border-radius:12px; padding:12px 14px; }
    .tm-card h3 { font-size:13px; margin-bottom:2px; }
    .tm-card .tm-val { font-size:22px; font-weight:800; color:var(--accent); margin-bottom:6px; }
    .tm-card canvas { width:100%; height:110px; display:block; border-radius:8px; }
  `);

  OS.registerApp({
    id: 'taskmgr',
    name: 'Диспетчер задач',
    icon: ICON,
    width: 660, height: 500,
    minWidth: 480, minHeight: 360,
    singleton: true,
    render(win) {
      let tab = 'proc';
      let selId = null;
      const procStats = new Map(); // winId -> {cpu, mem}
      const cpuHist = new Array(60).fill(0);
      const memHist = new Array(60).fill(0);

      const root = el('div', 'tm-root');
      root.innerHTML = `
        <div class="ui-toolbar">
          <div class="ui-seg">
            <button class="seg-btn on" data-tab="proc">Процессы</button>
            <button class="seg-btn" data-tab="perf">Производительность</button>
          </div>
        </div>
        <div class="tm-body"></div>
        <div class="tm-foot">
          <span class="tm-count"></span><span class="tm-uptime"></span>
          <button class="ui-btn danger tm-kill" disabled>Снять задачу</button>
        </div>`;
      win.content.appendChild(root);
      const body = root.querySelector('.tm-body');
      const killBtn = root.querySelector('.tm-kill');

      root.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {
        tab = b.dataset.tab;
        root.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('on', x === b));
        renderBody();
      }));

      killBtn.addEventListener('click', () => {
        const w = OS.wm.byId(selId);
        if (w) { w.close(); selId = null; killBtn.disabled = true; }
      });

      function statFor(w) {
        if (!procStats.has(w.id)) {
          procStats.set(w.id, {
            cpu: 0.5 + Math.random() * 3,
            mem: 18 + Math.random() * 60,
          });
        }
        return procStats.get(w.id);
      }
      function drift() {
        OS.wm.all().forEach(w => {
          const s = statFor(w);
          const active = OS.wm.focused === w ? 2.5 : 0;
          s.cpu = Math.max(0.1, Math.min(28, s.cpu + (Math.random() - 0.48) * 1.6 + active * 0.15));
          s.mem = Math.max(12, Math.min(400, s.mem + (Math.random() - 0.5) * 3));
        });
      }

      function totalCpu() {
        let t = 1.2;
        OS.wm.all().forEach(w => { t += statFor(w).cpu; });
        return Math.min(99, t);
      }
      function totalMem() {
        let t = 210; // «система»
        OS.wm.all().forEach(w => { t += statFor(w).mem; });
        try { t += JSON.stringify(localStorage).length / 1024 / 1024 * 8; } catch (e) { /* — */ }
        return t;
      }

      function renderBody() {
        if (tab === 'proc') renderProcs();
        else renderPerf();
      }

      function renderProcs() {
        const wins = OS.wm.all();
        const rows = wins.map(w => {
          const s = statFor(w);
          return `<tr class="proc ${selId === w.id ? 'sel' : ''}" data-id="${w.id}">
            <td><div class="tm-name"><div class="tm-ic">${w.app.icon || ''}</div>
              <span>${esc(w.app.name)}</span>&nbsp;<span class="tm-dim">— ${esc(w.getTitle() || '')}</span></div></td>
            <td class="tm-dim">${w.isMin ? 'Свёрнуто' : 'Активно'}</td>
            <td class="num">${s.cpu.toFixed(1)}%</td>
            <td class="num">${s.mem.toFixed(0)} МБ</td>
          </tr>`;
        }).join('');
        body.innerHTML = `<table class="tm-table">
          <thead><tr><th>Приложение</th><th>Статус</th><th class="num">ЦП</th><th class="num">Память</th></tr></thead>
          <tbody>
            <tr class="proc sys"><td><div class="tm-name"><div class="tm-ic" style="color:var(--accent)">${OS.icons.logo}</div><span>Система</span>&nbsp;<span class="tm-dim">— ядро hinomaOS</span></div></td>
              <td class="tm-dim">Работает</td><td class="num">1.2%</td><td class="num">210 МБ</td></tr>
            ${rows}
          </tbody></table>
          ${!wins.length ? '<div class="ui-empty" style="padding:30px 0">Нет запущенных приложений</div>' : ''}`;

        body.querySelectorAll('tr.proc[data-id]').forEach(tr => {
          tr.addEventListener('click', () => {
            selId = tr.dataset.id;
            killBtn.disabled = false;
            body.querySelectorAll('tr.proc').forEach(x => x.classList.toggle('sel', x === tr));
          });
          tr.addEventListener('dblclick', () => {
            const w = OS.wm.byId(tr.dataset.id);
            if (w) { w.restore(); w.focus(); }
          });
        });
      }

      function renderPerf() {
        body.innerHTML = `<div class="tm-perf">
          <div class="tm-card"><h3>ЦП</h3><div class="tm-val tm-cpuval"></div><canvas class="tm-cpu"></canvas></div>
          <div class="tm-card"><h3>Память</h3><div class="tm-val tm-memval"></div><canvas class="tm-mem"></canvas></div>
        </div>`;
        drawCharts();
      }

      function drawChart(canvas, hist, max, color) {
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.clientWidth || 500, h = canvas.clientHeight || 110;
        canvas.width = w * dpr; canvas.height = h * dpr;
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, w, h);
        // сетка
        ctx.strokeStyle = 'rgba(128,128,140,.18)';
        ctx.lineWidth = 1;
        for (let i = 1; i < 4; i++) {
          ctx.beginPath(); ctx.moveTo(0, h * i / 4); ctx.lineTo(w, h * i / 4); ctx.stroke();
        }
        // линия
        const pts = hist.map((v, i) => [i / (hist.length - 1) * w, h - (v / max) * (h - 8) - 2]);
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, color + '55');
        grad.addColorStop(1, color + '00');
        ctx.beginPath();
        pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      }

      function drawCharts() {
        const cpuC = body.querySelector('.tm-cpu');
        const memC = body.querySelector('.tm-mem');
        if (!cpuC) return;
        const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#0a84ff';
        drawChart(cpuC, cpuHist, 100, accent);
        drawChart(memC, memHist, 2048, '#30d158');
        body.querySelector('.tm-cpuval').textContent = cpuHist[cpuHist.length - 1].toFixed(1) + ' %';
        body.querySelector('.tm-memval').textContent = (memHist[memHist.length - 1] / 1024).toFixed(2) + ' ГБ из 2 ГБ';
      }

      function foot() {
        const up = Math.floor(performance.now() / 1000);
        const hh = String(Math.floor(up / 3600)).padStart(2, '0');
        const mm = String(Math.floor(up / 60) % 60).padStart(2, '0');
        const ss = String(up % 60).padStart(2, '0');
        root.querySelector('.tm-count').textContent = `Процессов: ${OS.wm.all().length + 1}`;
        root.querySelector('.tm-uptime').textContent = `Аптайм: ${hh}:${mm}:${ss}`;
      }

      const tick = setInterval(() => {
        drift();
        cpuHist.push(totalCpu()); cpuHist.shift();
        memHist.push(totalMem()); memHist.shift();
        if (tab === 'proc') renderProcs(); else drawCharts();
        foot();
      }, 1000);

      const unsubs = ['wm:opened', 'wm:closed', 'wm:minimized', 'wm:restored'].map(evt =>
        OS.on(evt, () => { if (tab === 'proc') renderProcs(); foot(); }));

      win.on('close', () => {
        clearInterval(tick);
        unsubs.forEach(u => u());
      });
      win.on('resize', () => { if (tab === 'perf') drawCharts(); });

      renderBody();
      foot();
    },
  });
})();
