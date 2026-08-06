/* hinomaOS · Paint — рисовалка в духе MS Paint */
(function () {
  'use strict';
  const { el, esc } = OS;

  const ICON = OS.appTile(
    { from: '#FF6482', to: '#D62D6E' },
    `<g>
      <path d="M 22 -30 C 28 -36 36 -34 38 -26 C 40 -20 34 -14 28 -10 L 6 8 L -8 -6 L 14 -24 Z" fill="#fff"/>
      <path d="M -8 -6 L 6 8 C 2 16 -6 22 -16 24 C -24 26 -30 22 -28 18 C -26 14 -22 16 -20 10 C -18 4 -14 -2 -8 -6 Z" fill="#ffd9a8"/>
      <path d="M -30 30 C -14 34 6 34 22 28" fill="none" stroke="rgba(255,255,255,.75)" stroke-width="7" stroke-linecap="round"/>
    </g>`
  );

  OS.injectStyle('app-paint', `
    .pt-root { flex:1; min-height:0; display:flex; flex-direction:column; }
    .pt-tools { flex-wrap:wrap; row-gap:6px; }
    .pt-tool { width:32px; height:32px; padding:0; display:inline-flex; align-items:center; justify-content:center;
      border:none; border-radius:7px; background:transparent; color:var(--text-2); cursor:default; }
    .pt-tool svg { width:18px; height:18px; }
    .pt-tool:hover { background:var(--hover); }
    .pt-tool.on { background:var(--accent-soft); color:var(--accent); }
    .pt-swatch { width:21px; height:21px; border-radius:50%; border:2px solid transparent; cursor:default;
      box-shadow: inset 0 0 0 1px rgba(0,0,0,.15); flex:none; }
    .pt-swatch.on { border-color:var(--accent); transform:scale(1.12); }
    .pt-cur { width:26px; height:26px; border-radius:8px; box-shadow: inset 0 0 0 1px rgba(0,0,0,.2); flex:none; }
    .pt-size-wrap { display:flex; align-items:center; gap:8px; width:130px; }
    .pt-size-dot { border-radius:50%; background:var(--text); flex:none; }
    .pt-canvas-wrap { flex:1; min-height:0; display:flex; align-items:center; justify-content:center;
      background:var(--ctl-bg); overflow:hidden; padding:14px; }
    .pt-canvas-wrap canvas { background:#fff; border-radius:4px; box-shadow:0 4px 24px rgba(0,0,0,.25);
      max-width:100%; max-height:100%; touch-action:none; }
    .pt-colorpick { width:26px; height:26px; padding:0; border:none; border-radius:50%; background:none; cursor:default; }
  `);

  const TOOLS = {
    brush: { name: 'Кисть', svg: '<svg viewBox="0 0 24 24"><path d="M16.5 3.5 L20.5 7.5 L9 19 L4 20 L5 15 Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>' },
    marker: { name: 'Маркер', svg: '<svg viewBox="0 0 24 24"><path d="M6 20 L4 20 L4 18 L14 8 L16 10 Z M15 7 L17 5 L19 7 L17 9 Z" fill="currentColor" opacity=".6"/><path d="M4 22 L20 22" stroke="currentColor" stroke-width="2.4" opacity=".4"/></svg>' },
    eraser: { name: 'Ластик', svg: '<svg viewBox="0 0 24 24"><path d="M8 18 L3.5 13.5 C 2.7 12.7 2.7 11.3 3.5 10.5 L11 3 C 11.8 2.2 13.2 2.2 14 3 L 20 9 C 20.8 9.8 20.8 11.2 20 12 L 14 18 Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 18 L20 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M7.5 7 L 16 15.5" stroke="currentColor" stroke-width="1.5" opacity=".5"/></svg>' },
    line: { name: 'Линия', svg: '<svg viewBox="0 0 24 24"><path d="M4 20 L20 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' },
    rect: { name: 'Прямоугольник', svg: '<svg viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>' },
    ellipse: { name: 'Эллипс', svg: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="8.5" ry="6.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>' },
    fill: { name: 'Заливка', svg: '<svg viewBox="0 0 24 24"><path d="M12 3 L19 10 C 20 11 20 12 19 13 L 13.5 18.5 C 12.5 19.5 11 19.5 10 18.5 L 5 13.5 C 4 12.5 4 11 5 10 Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M20.5 16 C 21.5 17.5 22 18.6 22 19.5 C 22 20.6 21.1 21.5 20 21.5 C 18.9 21.5 18 20.6 18 19.5 C 18 18.6 18.8 17.4 20.5 16 Z" fill="currentColor"/></svg>' },
    picker: { name: 'Пипетка', svg: '<svg viewBox="0 0 24 24"><path d="M16 3 L21 8 L18.5 10.5 L13.5 5.5 Z M12 7 L17 12 L8 21 L4 21 L3 20 L3 16 Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>' },
  };
  const PALETTE = ['#000000', '#8e8e93', '#ffffff', '#ff453a', '#ff9f0a', '#ffd60a', '#30d158', '#64d2ff', '#0a84ff', '#5e5ce6', '#bf5af2', '#ff375f', '#a2845e', '#1c3a5e', '#0e6b45', '#7a1e56'];
  const CW = 1200, CH = 700;

  OS.registerApp({
    id: 'paint',
    name: 'Paint',
    icon: ICON,
    width: 900, height: 620,
    minWidth: 620, minHeight: 420,
    render(win, ctx0) {
      let tool = 'brush';
      let color = '#0a84ff';
      let size = 6;
      let dirty = false;
      let undoStack = [], redoStack = [];
      let drawing = false, sx = 0, sy = 0, snapshot = null;

      const root = el('div', 'pt-root');
      root.innerHTML = `
        <div class="ui-toolbar pt-tools">
          ${Object.entries(TOOLS).map(([k, t]) => `<button class="pt-tool ${k === tool ? 'on' : ''}" data-tool="${k}" title="${t.name}">${t.svg}</button>`).join('')}
          <div style="width:1px;height:22px;background:var(--divider);margin:0 3px"></div>
          <div class="pt-cur" title="Текущий цвет"></div>
          ${PALETTE.map(c => `<div class="pt-swatch ${c === color ? 'on' : ''}" data-c="${c}" style="background:${c}"></div>`).join('')}
          <input type="color" class="pt-colorpick" value="${color}" title="Свой цвет">
          <div style="width:1px;height:22px;background:var(--divider);margin:0 3px"></div>
          <div class="pt-size-wrap"><input type="range" class="ui-slider pt-size" min="1" max="40" value="${size}" style="height:16px"><div class="pt-size-dot"></div></div>
          <span style="flex:1"></span>
          <button class="ui-btn pt-undo" title="Ctrl+Z">↩</button>
          <button class="ui-btn pt-redo" title="Ctrl+Shift+Z">↪</button>
          <button class="ui-btn pt-clear">Очистить</button>
          <button class="ui-btn primary pt-save">Сохранить</button>
        </div>
        <div class="pt-canvas-wrap"><canvas width="${CW}" height="${CH}"></canvas></div>`;
      win.content.appendChild(root);

      const canvas = root.querySelector('canvas');
      const cx = canvas.getContext('2d', { willReadFrequently: true });
      cx.fillStyle = '#ffffff';
      cx.fillRect(0, 0, CW, CH);
      cx.lineCap = 'round';
      cx.lineJoin = 'round';

      const curEl = root.querySelector('.pt-cur');
      const sizeDot = root.querySelector('.pt-size-dot');
      const refreshCur = () => {
        curEl.style.background = color;
        root.querySelector('.pt-colorpick').value = color;
        const d = Math.min(22, Math.max(3, size * 0.55));
        sizeDot.style.width = d + 'px';
        sizeDot.style.height = d + 'px';
        root.querySelectorAll('.pt-swatch').forEach(s => s.classList.toggle('on', s.dataset.c === color));
      };
      refreshCur();

      root.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => {
        tool = b.dataset.tool;
        root.querySelectorAll('[data-tool]').forEach(x => x.classList.toggle('on', x === b));
      }));
      root.querySelectorAll('.pt-swatch').forEach(s => s.addEventListener('click', () => { color = s.dataset.c; refreshCur(); }));
      root.querySelector('.pt-colorpick').addEventListener('input', (e) => { color = e.target.value; refreshCur(); });
      root.querySelector('.pt-size').addEventListener('input', (e) => { size = +e.target.value; refreshCur(); });

      function pushUndo() {
        undoStack.push(cx.getImageData(0, 0, CW, CH));
        if (undoStack.length > 30) undoStack.shift();
        redoStack = [];
      }
      function undo() {
        if (!undoStack.length) return;
        redoStack.push(cx.getImageData(0, 0, CW, CH));
        cx.putImageData(undoStack.pop(), 0, 0);
      }
      function redo() {
        if (!redoStack.length) return;
        undoStack.push(cx.getImageData(0, 0, CW, CH));
        cx.putImageData(redoStack.pop(), 0, 0);
      }
      root.querySelector('.pt-undo').addEventListener('click', undo);
      root.querySelector('.pt-redo').addEventListener('click', redo);

      root.querySelector('.pt-clear').addEventListener('click', async () => {
        const ok = await OS.dialog.confirm('Очистить холст?', 'Рисунок будет удалён.', { okLabel: 'Очистить', danger: true });
        if (!ok) return;
        pushUndo();
        cx.fillStyle = '#ffffff';
        cx.fillRect(0, 0, CW, CH);
        dirty = true;
      });

      async function save() {
        try {
          const data = canvas.toDataURL('image/png');
          const name = OS.vfs.uniqueName('/Pictures', 'Рисунок.png');
          OS.vfs.write('/Pictures/' + name, data);
          dirty = false;
          win.setTitle('Paint — ' + name);
          OS.notify({ title: 'Paint', body: `Сохранено в Изображения: ${name}`, appId: 'paint' });
        } catch (e) {
          OS.dialog.alert('Не удалось сохранить', e.message);
        }
      }
      root.querySelector('.pt-save').addEventListener('click', save);

      const pos = (e) => {
        const r = canvas.getBoundingClientRect();
        return [
          (e.clientX - r.left) * (CW / r.width),
          (e.clientY - r.top) * (CH / r.height),
        ];
      };

      function hexToRgba(hex) {
        const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16), 255];
      }

      function floodFill(x, y) {
        x = Math.floor(x); y = Math.floor(y);
        const img = cx.getImageData(0, 0, CW, CH);
        const d = img.data;
        const idx = (px, py) => (py * CW + px) * 4;
        const target = d.slice(idx(x, y), idx(x, y) + 4);
        const fill = hexToRgba(color);
        if (target[0] === fill[0] && target[1] === fill[1] && target[2] === fill[2]) return;
        const match = (i) => Math.abs(d[i] - target[0]) < 12 && Math.abs(d[i + 1] - target[1]) < 12 && Math.abs(d[i + 2] - target[2]) < 12;
        const stack = [[x, y]];
        let iter = 0;
        while (stack.length && iter++ < 3000000) {
          const [px, py] = stack.pop();
          if (px < 0 || py < 0 || px >= CW || py >= CH) continue;
          const i = idx(px, py);
          if (!match(i)) continue;
          d[i] = fill[0]; d[i + 1] = fill[1]; d[i + 2] = fill[2]; d[i + 3] = 255;
          stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
        }
        cx.putImageData(img, 0, 0);
      }

      function strokeSetup() {
        cx.globalAlpha = tool === 'marker' ? 0.35 : 1;
        cx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
        cx.fillStyle = cx.strokeStyle;
        cx.lineWidth = tool === 'marker' ? size * 2.2 : size;
      }

      canvas.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        canvas.setPointerCapture(e.pointerId);
        const [x, y] = pos(e);
        if (tool === 'picker') {
          const p = cx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
          color = '#' + [p[0], p[1], p[2]].map(v => v.toString(16).padStart(2, '0')).join('');
          refreshCur();
          return;
        }
        pushUndo();
        dirty = true;
        drawing = true;
        sx = x; sy = y;
        if (tool === 'fill') {
          floodFill(x, y);
          drawing = false;
          return;
        }
        snapshot = ['line', 'rect', 'ellipse'].includes(tool) ? cx.getImageData(0, 0, CW, CH) : null;
        strokeSetup();
        if (tool === 'brush' || tool === 'marker' || tool === 'eraser') {
          cx.beginPath();
          cx.moveTo(x, y);
          cx.lineTo(x + 0.01, y + 0.01);
          cx.stroke();
        }
      });

      canvas.addEventListener('pointermove', (e) => {
        if (!drawing) return;
        const [x, y] = pos(e);
        if (tool === 'brush' || tool === 'marker' || tool === 'eraser') {
          cx.lineTo(x, y);
          cx.stroke();
        } else if (snapshot) {
          cx.putImageData(snapshot, 0, 0);
          strokeSetup();
          cx.beginPath();
          if (tool === 'line') { cx.moveTo(sx, sy); cx.lineTo(x, y); }
          else if (tool === 'rect') cx.rect(Math.min(sx, x), Math.min(sy, y), Math.abs(x - sx), Math.abs(y - sy));
          else if (tool === 'ellipse') cx.ellipse((sx + x) / 2, (sy + y) / 2, Math.abs(x - sx) / 2, Math.abs(y - sy) / 2, 0, 0, Math.PI * 2);
          cx.stroke();
        }
      });

      const endStroke = () => {
        if (!drawing) return;
        drawing = false;
        snapshot = null;
        cx.globalAlpha = 1;
      };
      canvas.addEventListener('pointerup', endStroke);
      canvas.addEventListener('pointercancel', endStroke);

      const onKey = (e) => {
        if (OS.wm.focused !== win) return;
        if (e.ctrlKey && !e.shiftKey && e.code === 'KeyZ') { e.preventDefault(); undo(); }
        else if (e.ctrlKey && (e.code === 'KeyY' || (e.shiftKey && e.code === 'KeyZ'))) { e.preventDefault(); redo(); }
        else if (e.ctrlKey && e.code === 'KeyS') { e.preventDefault(); save(); }
      };
      document.addEventListener('keydown', onKey);
      win.on('close', () => document.removeEventListener('keydown', onKey));

      win.on('beforeclose', async () => {
        if (!dirty) return true;
        const ok = await OS.dialog.confirm('Есть несохранённый рисунок', 'Закрыть без сохранения?', { okLabel: 'Закрыть', danger: true });
        return ok;
      });

      // открыть существующее изображение
      if (ctx0.args && ctx0.args.path) {
        try {
          const data = OS.vfs.read(ctx0.args.path);
          if (data.startsWith('data:image')) {
            const img = new Image();
            img.onload = () => {
              const s = Math.min(CW / img.width, CH / img.height, 1);
              cx.drawImage(img, 0, 0, img.width * s, img.height * s);
            };
            img.src = data;
            win.setTitle('Paint — ' + OS.vfs.nameOf(ctx0.args.path));
          }
        } catch (e) { /* — */ }
      }
    },
  });
})();
