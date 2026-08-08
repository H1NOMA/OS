/* ============================================================
   hinomaOS · wm — оконный менеджер
   Перетаскивание, ресайз за 8 ручек, снэп к краям (Windows 11),
   Snap Layouts, Alt+Tab, Mission Control, Aero Shake.
   ============================================================ */
(function () {
  'use strict';
  const { el, $, clamp, uid, esc } = OS;

  const MENUBAR_H = 30;
  let zTop = 100;
  const windows = new Map();  // id -> Win
  let focused = null;

  const layer = () => document.getElementById('windows');
  const workArea = () => ({
    x: 0,
    y: MENUBAR_H,
    w: window.innerWidth,
    h: window.innerHeight - MENUBAR_H,
  });

  /* ============================ SNAP ============================ */

  const snapPreview = () => document.getElementById('snap-preview');

  function snapRect(zone) {
    const a = workArea();
    const half = { w: a.w / 2, h: a.h / 2 };
    switch (zone) {
      case 'max':   return { x: a.x, y: a.y, w: a.w, h: a.h };
      case 'left':  return { x: a.x, y: a.y, w: half.w, h: a.h };
      case 'right': return { x: a.x + half.w, y: a.y, w: half.w, h: a.h };
      case 'tl':    return { x: a.x, y: a.y, w: half.w, h: half.h };
      case 'tr':    return { x: a.x + half.w, y: a.y, w: half.w, h: half.h };
      case 'bl':    return { x: a.x, y: a.y + half.h, w: half.w, h: half.h };
      case 'br':    return { x: a.x + half.w, y: a.y + half.h, w: half.w, h: half.h };
      case 'l23':   return { x: a.x, y: a.y, w: a.w * 2 / 3, h: a.h };
      case 'r13':   return { x: a.x + a.w * 2 / 3, y: a.y, w: a.w / 3, h: a.h };
      default: return null;
    }
  }

  function zoneAt(px, py) {
    const a = workArea();
    const m = 10;        // чувствительность краёв
    const corner = 130;  // зона углов
    const nearL = px <= a.x + m, nearR = px >= a.x + a.w - m;
    const nearT = py <= a.y + m, nearB = py >= a.y + a.h + MENUBAR_H - m - 60;
    if (nearL && py < a.y + corner) return 'tl';
    if (nearL && nearB) return 'bl';
    if (nearR && py < a.y + corner) return 'tr';
    if (nearR && nearB) return 'br';
    if (nearL) return 'left';
    if (nearR) return 'right';
    if (nearT) return 'max';
    return null;
  }

  function showSnapPreview(zone) {
    const p = snapPreview();
    const r = snapRect(zone);
    if (!r) { hideSnapPreview(); return; }
    if (p.style.display !== 'block') {
      p.style.display = 'block';
      p.style.transition = 'none';
      Object.assign(p.style, { left: r.x + 6 + 'px', top: r.y + 6 + 'px', width: r.w - 12 + 'px', height: r.h - 12 + 'px' });
      requestAnimationFrame(() => { p.style.transition = ''; });
    } else {
      Object.assign(p.style, { left: r.x + 6 + 'px', top: r.y + 6 + 'px', width: r.w - 12 + 'px', height: r.h - 12 + 'px' });
    }
  }
  function hideSnapPreview() { snapPreview().style.display = 'none'; }

  /* ============================ ОКНО ============================ */

  class Win {
    constructor(app, args) {
      this.id = uid('win');
      this.app = app;
      this.args = args || {};
      this.isMin = false;
      this.snapState = null;    // null | 'max' | зона
      this.preSnap = null;      // rect до снэпа
      this._handlers = {};

      const a = workArea();
      const w = clamp(app.width || 720, 200, a.w);
      const h = clamp(app.height || 480, 120, a.h);
      const cascade = (windows.size % 8) * 28;
      const x = clamp((a.w - w) / 2 + cascade - 60, 0, Math.max(0, a.w - w));
      const y = clamp(a.y + (a.h - h) / 2.4 + cascade - 40, a.y, Math.max(a.y, a.y + a.h - h));

      const root = el('div', 'window' + (app.borderless ? ' borderless' : ''));
      root.id = this.id;
      Object.assign(root.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
      root.innerHTML = `
        <div class="win-titlebar">
          <div class="traffic">
            <div class="tl tl-close" title="Закрыть"><svg viewBox="0 0 10 10"><path d="M2 2 L8 8 M8 2 L2 8" stroke="rgba(20,10,10,.62)" stroke-width="1.3" stroke-linecap="round"/></svg></div>
            <div class="tl tl-min" title="Свернуть"><svg viewBox="0 0 10 10"><path d="M2 5 L8 5" stroke="rgba(40,25,0,.62)" stroke-width="1.4" stroke-linecap="round"/></svg></div>
            <div class="tl tl-max" title="Развернуть"><svg viewBox="0 0 10 10"><path d="M2.6 5.6 L2.6 7.4 L4.4 7.4 M7.4 4.4 L7.4 2.6 L5.6 2.6" stroke="rgba(0,40,26,.62)" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
          </div>
          <div class="win-title">${esc(app.name)}</div>
        </div>
        <div class="win-content"></div>
        <div class="rz rz-n"></div><div class="rz rz-s"></div><div class="rz rz-e"></div><div class="rz rz-w"></div>
        <div class="rz rz-ne"></div><div class="rz rz-nw"></div><div class="rz rz-se"></div><div class="rz rz-sw"></div>`;

      this.root = root;
      this.content = $('.win-content', root);
      this.titlebar = $('.win-titlebar', root);
      this.titleEl = $('.win-title', root);

      layer().appendChild(root);
      windows.set(this.id, this);

      this._wire();
      this.focus();

      try { app.render(this, { args: this.args }); }
      catch (e) {
        console.error(`[WM] ошибка рендера «${app.id}»`, e);
        this.content.innerHTML = `<div class="ui-empty"><div>Приложение аварийно завершилось 😵</div><div style="font-size:12px;opacity:.6">${esc(e.message)}</div></div>`;
      }
      OS.emit('wm:opened', this);
    }

    /* --- события окна --- */
    on(evt, cb) { (this._handlers[evt] = this._handlers[evt] || []).push(cb); return this; }
    _fire(evt, data) { (this._handlers[evt] || []).forEach(cb => { try { cb(data); } catch (e) { console.error(e); } }); }

    setTitle(t) { this.titleEl.textContent = t; OS.emit('wm:title', this); }
    getTitle() { return this.titleEl.textContent; }

    rect() {
      return {
        x: parseFloat(this.root.style.left), y: parseFloat(this.root.style.top),
        w: parseFloat(this.root.style.width), h: parseFloat(this.root.style.height),
      };
    }
    setRect(r, animate) {
      if (animate) {
        this.root.classList.add('animated-move');
        setTimeout(() => this.root.classList.remove('animated-move'), 280);
      }
      Object.assign(this.root.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
      this._fire('resize', r);
    }

    focus() {
      if (focused === this && this.root.classList.contains('focused')) return;
      // перенормировка z-index — чтобы окна никогда не «переросли» панели ОС
      if (zTop > 7000) {
        const sorted = Array.from(windows.values())
          .sort((a, b) => (parseInt(a.root.style.zIndex) || 0) - (parseInt(b.root.style.zIndex) || 0));
        zTop = 100;
        sorted.forEach(w => { w.root.style.zIndex = ++zTop; });
      }
      if (focused && focused !== this) focused.root.classList.remove('focused');
      focused = this;
      this.root.classList.add('focused');
      this.root.style.zIndex = ++zTop;
      OS.emit('wm:focus', this);
      this._fire('focus');
    }

    minimize() {
      if (this.isMin) return;
      this.isMin = true;
      const r = this.rect();
      const dock = document.getElementById('dock');
      const dr = dock ? dock.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight, width: 0 };
      const tx = dr.left + dr.width / 2 - (r.x + r.w / 2);
      const ty = dr.top - (r.y + r.h / 2);
      this.root.classList.add('minimizing');
      this.root.style.transform = `translate(${tx}px, ${ty}px) scale(.06)`;
      this.root.style.opacity = '0';
      setTimeout(() => { this.root.classList.add('hidden'); this.root.classList.remove('minimizing'); }, 330);
      if (focused === this) this._focusNext();
      OS.emit('wm:minimized', this);
    }

    restore() {
      if (!this.isMin) return;
      this.isMin = false;
      this.root.classList.remove('hidden');
      requestAnimationFrame(() => {
        this.root.classList.add('minimizing');
        this.root.style.transform = '';
        this.root.style.opacity = '';
        setTimeout(() => this.root.classList.remove('minimizing'), 330);
      });
      this.focus();
      OS.emit('wm:restored', this);
    }

    toggleMaximize() {
      if (this.snapState === 'max') this.unsnap(true);
      else this.snapTo('max');
    }

    snapTo(zone, animate) {
      const r = snapRect(zone);
      if (!r) return;
      if (!this.snapState) this.preSnap = this.rect();
      this.snapState = zone;
      this.root.classList.toggle('maximized', zone === 'max');
      this.setRect(r, animate !== false);
      OS.emit('wm:snap', this);
    }

    unsnap(animate) {
      if (!this.snapState) return;
      this.snapState = null;
      this.root.classList.remove('maximized');
      const a = workArea();
      const r = this.preSnap || { x: a.w / 2 - 360, y: a.y + 60, w: 720, h: 480 };
      this.setRect({
        x: clamp(r.x, 0, a.w - 80), y: clamp(r.y, a.y, a.y + a.h - 60),
        w: Math.min(r.w, a.w), h: Math.min(r.h, a.h),
      }, animate !== false);
    }

    close(force) {
      const doClose = () => {
        this.root.classList.add('closing');
        setTimeout(() => {
          this.root.remove();
          windows.delete(this.id);
          if (focused === this) { focused = null; this._focusNext(); }
          OS.emit('wm:closed', this);
        }, 180);
        this._fire('close');
      };
      if (!force && this._handlers['beforeclose']) {
        Promise.resolve(this._handlers['beforeclose'][0]()).then(ok => { if (ok !== false) doClose(); });
      } else doClose();
    }

    _focusNext() {
      const rest = Array.from(windows.values()).filter(w => w !== this && !w.isMin);
      if (rest.length) {
        rest.sort((a, b) => (parseInt(b.root.style.zIndex) || 0) - (parseInt(a.root.style.zIndex) || 0));
        rest[0].focus();
      } else {
        focused = null;
        OS.emit('wm:focus', null);
      }
    }

    /* --- drag / resize / кнопки --- */
    _wire() {
      const root = this.root;

      root.addEventListener('pointerdown', () => this.focus(), true);

      // светофор
      $('.tl-close', root).addEventListener('click', (e) => { e.stopPropagation(); this.close(); });
      $('.tl-min', root).addEventListener('click', (e) => { e.stopPropagation(); this.minimize(); });
      const maxBtn = $('.tl-max', root);
      maxBtn.addEventListener('click', (e) => { e.stopPropagation(); hideSnapLayouts(); this.toggleMaximize(); });
      maxBtn.addEventListener('mouseenter', () => { snapLayoutTimer = setTimeout(() => showSnapLayouts(this, maxBtn), 420); });
      maxBtn.addEventListener('mouseleave', () => { clearTimeout(snapLayoutTimer); scheduleHideSnapLayouts(); });

      // двойной клик по заголовку — максимизация
      this.titlebar.addEventListener('dblclick', (e) => {
        if (e.target.closest('.tl')) return;
        this.toggleMaximize();
      });

      // перетаскивание
      this.titlebar.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || e.target.closest('.tl') || e.target.closest('.win-titlebar-actions')) return;
        this._dragStart(e);
      });

      // контекстное меню заголовка
      this.titlebar.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        OS.contextMenu([
          { label: 'Свернуть', action: () => this.minimize() },
          { label: this.snapState === 'max' ? 'Восстановить' : 'Развернуть', action: () => this.toggleMaximize() },
          { label: 'Прикрепить слева', action: () => this.snapTo('left') },
          { label: 'Прикрепить справа', action: () => this.snapTo('right') },
          { sep: true },
          { label: 'Закрыть', hotkey: 'Ctrl+W', action: () => this.close() },
        ], e.clientX, e.clientY);
      });

      // ресайз
      const dirs = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
      dirs.forEach(d => {
        $('.rz-' + d, root).addEventListener('pointerdown', (e) => {
          if (e.button !== 0) return;
          this._resizeStart(e, d);
        });
      });
    }

    _dragStart(e) {
      e.preventDefault();
      const startX = e.clientX, startY = e.clientY;
      let r = this.rect();
      let started = false;
      // Aero Shake
      let lastDx = 0, dirChanges = 0, lastChangeTs = 0, shaken = false;

      const grabRatio = (startX - r.x) / r.w;

      const move = (ev) => {
        const dx = ev.clientX - startX, dy = ev.clientY - startY;
        if (!started && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;

        // выход из снэпа при начале перетаскивания — окно «выпрыгивает» под курсор
        if (!started && this.snapState) {
          const pre = this.preSnap || { w: 720, h: 480 };
          this.snapState = null;
          this.root.classList.remove('maximized');
          r = {
            x: ev.clientX - pre.w * grabRatio,
            y: r.y,
            w: pre.w, h: pre.h,
          };
          this.setRect(r, false);
        }
        started = true;

        const a = workArea();
        this.setRect({
          x: r.x + dx,
          y: clamp(r.y + dy, a.y, a.y + a.h - 36),
          w: r.w, h: r.h,
        }, false);

        // Aero Shake: резкие смены направления
        const ndx = ev.movementX;
        if (Math.sign(ndx) !== 0 && Math.sign(ndx) !== Math.sign(lastDx) && Math.abs(ndx) > 9) {
          const t = performance.now();
          dirChanges = (t - lastChangeTs < 450) ? dirChanges + 1 : 1;
          lastChangeTs = t;
          if (dirChanges >= 6 && !shaken) {
            shaken = true;
            OS.wm.minimizeOthers(this);
          }
        }
        if (Math.abs(ndx) > 2) lastDx = ndx;

        const zone = zoneAt(ev.clientX, ev.clientY);
        if (zone) showSnapPreview(zone); else hideSnapPreview();
      };

      const up = (ev) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        hideSnapPreview();
        if (!started) return;
        const zone = zoneAt(ev.clientX, ev.clientY);
        if (zone) this.snapTo(zone);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    }

    _resizeStart(e, dir) {
      e.preventDefault();
      e.stopPropagation();
      this.focus();
      if (this.snapState) { this.snapState = null; this.root.classList.remove('maximized'); }
      const startX = e.clientX, startY = e.clientY;
      const r = this.rect();
      const minW = this.app.minWidth || 260, minH = this.app.minHeight || 160;
      const a = workArea();

      const move = (ev) => {
        const dx = ev.clientX - startX, dy = ev.clientY - startY;
        let { x, y, w, h } = r;
        if (dir.includes('e')) w = clamp(r.w + dx, minW, a.w - r.x);
        if (dir.includes('s')) h = clamp(r.h + dy, minH, a.y + a.h - r.y);
        if (dir.includes('w')) {
          w = clamp(r.w - dx, minW, r.x + r.w);
          x = r.x + r.w - w;
        }
        if (dir.includes('n')) {
          h = clamp(r.h - dy, minH, r.y + r.h - a.y);
          y = r.y + r.h - h;
        }
        this.setRect({ x, y, w, h }, false);
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    }
  }

  /* ====================== SNAP LAYOUTS (Win11) ====================== */

  let snapLayoutTimer = null;
  let snapLayoutHideTimer = null;

  function showSnapLayouts(win, anchor) {
    hideSnapLayouts();
    const pop = el('div');
    pop.id = 'snap-layouts';
    const groups = [
      { cells: [{ z: 'left', c: '1 / 1 / 2 / 2' }, { z: 'right', c: '1 / 2 / 2 / 3' }], cols: '1fr 1fr', rows: '1fr' },
      { cells: [{ z: 'l23', c: '1 / 1 / 2 / 2' }, { z: 'r13', c: '1 / 2 / 2 / 3' }], cols: '2fr 1fr', rows: '1fr' },
      { cells: [{ z: 'tl', c: '1 / 1 / 2 / 2' }, { z: 'tr', c: '1 / 2 / 2 / 3' }, { z: 'bl', c: '2 / 1 / 3 / 2' }, { z: 'br', c: '2 / 2 / 3 / 3' }], cols: '1fr 1fr', rows: '1fr 1fr' },
      { cells: [{ z: 'max', c: '1 / 1 / 2 / 2' }], cols: '1fr', rows: '1fr' },
    ];
    groups.forEach(g => {
      const grp = el('div', 'sl-group');
      grp.style.gridTemplateColumns = g.cols;
      grp.style.gridTemplateRows = g.rows;
      g.cells.forEach(c => {
        const cell = el('div', 'sl-cell');
        cell.style.gridArea = c.c;
        cell.addEventListener('click', () => { win.snapTo(c.z); hideSnapLayouts(); });
        grp.appendChild(cell);
      });
      pop.appendChild(grp);
    });
    pop.addEventListener('mouseenter', () => clearTimeout(snapLayoutHideTimer));
    pop.addEventListener('mouseleave', scheduleHideSnapLayouts);
    document.body.appendChild(pop);
    const ar = anchor.getBoundingClientRect();
    const pw = pop.offsetWidth;
    pop.style.left = clamp(ar.left + ar.width / 2 - pw / 2, 8, innerWidth - pw - 8) + 'px';
    pop.style.top = (ar.bottom + 10) + 'px';
  }
  function scheduleHideSnapLayouts() {
    clearTimeout(snapLayoutHideTimer);
    snapLayoutHideTimer = setTimeout(hideSnapLayouts, 350);
  }
  function hideSnapLayouts() {
    clearTimeout(snapLayoutTimer);
    const p = document.getElementById('snap-layouts');
    if (p) p.remove();
  }

  /* ====================== ALT+TAB ====================== */

  let atState = null; // { items, idx, sticky }

  function altTabOpen(sticky) {
    const items = Array.from(windows.values());
    if (!items.length) return;
    items.sort((a, b) => (parseInt(b.root.style.zIndex) || 0) - (parseInt(a.root.style.zIndex) || 0));
    atState = { items, idx: items.length > 1 ? 1 : 0, sticky: !!sticky };
    renderAltTab();
  }
  function renderAltTab() {
    let elx = document.getElementById('alt-tab');
    if (!elx) {
      elx = el('div');
      elx.id = 'alt-tab';
      document.body.appendChild(elx);
    }
    elx.innerHTML = atState.items.map((w, i) => `
      <div class="at-item ${i === atState.idx ? 'active' : ''}" data-i="${i}">
        <div class="at-icon">${w.app.icon || OS.icons.fileGeneric}</div>
        <div class="at-name">${esc(w.getTitle() || w.app.name)}</div>
      </div>`).join('');
    elx.querySelectorAll('.at-item').forEach(item => {
      item.addEventListener('click', () => { atState.idx = +item.dataset.i; altTabCommit(); });
    });
  }
  function altTabNext(delta) {
    if (!atState) return;
    atState.idx = (atState.idx + delta + atState.items.length) % atState.items.length;
    renderAltTab();
  }
  function altTabCommit() {
    const elx = document.getElementById('alt-tab');
    if (elx) elx.remove();
    if (atState) {
      const w = atState.items[atState.idx];
      if (w) { w.restore(); w.focus(); }
    }
    atState = null;
  }
  function altTabCancel() {
    const elx = document.getElementById('alt-tab');
    if (elx) elx.remove();
    atState = null;
  }

  /* ====================== MISSION CONTROL ====================== */

  let missionOn = false;
  let missionData = [];

  function missionToggle() {
    if (missionOn) missionExit(null);
    else missionEnter();
  }
  function missionEnter() {
    const wins = Array.from(windows.values()).filter(w => !w.isMin);
    if (!wins.length) return;
    missionOn = true;
    const bg = el('div');
    bg.id = 'mission';
    bg.innerHTML = `<div class="ms-title">Просмотр задач — кликните окно, Esc — выход</div>`;
    bg.addEventListener('click', (e) => { if (e.target === bg || e.target.classList.contains('ms-title')) missionExit(null); });
    // внутрь #os: иначе окна (внутри stacking context #os) не поднимутся над оверлеем
    (document.getElementById('os') || document.body).appendChild(bg);

    const a = workArea();
    const n = wins.length;
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const cellW = (a.w - 80) / cols;
    const cellH = (a.h - 120) / rows;

    missionData = wins.map((w, i) => {
      const r = w.rect();
      const col = i % cols, row = Math.floor(i / cols);
      const scale = Math.min(cellW * 0.9 / r.w, cellH * 0.85 / r.h, 0.92);
      const cx = a.x + 40 + col * cellW + cellW / 2;
      const cy = a.y + 70 + row * cellH + cellH / 2;
      const tx = cx - (r.x + r.w / 2);
      const ty = cy - (r.y + r.h / 2);

      const prevZ = w.root.style.zIndex;
      w.root.classList.add('in-mission');
      w.root.style.zIndex = 8901;
      w.root.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;

      const label = el('div', 'ms-label', esc(w.getTitle() || w.app.name));
      label.style.left = cx + 'px';
      label.style.top = (cy + (r.h * scale) / 2 + 12) + 'px';
      document.body.appendChild(label);

      const onPick = (e) => { e.stopPropagation(); missionExit(w); };
      w.root.addEventListener('click', onPick, true);
      return { w, prevZ, label, onPick };
    });
  }
  function missionExit(pick) {
    if (!missionOn) return;
    missionOn = false;
    missionData.forEach(({ w, prevZ, label, onPick }) => {
      w.root.style.transform = '';
      w.root.removeEventListener('click', onPick, true);
      label.remove();
      setTimeout(() => { w.root.classList.remove('in-mission'); w.root.style.zIndex = prevZ; }, 300);
    });
    missionData = [];
    const bg = document.getElementById('mission');
    if (bg) bg.remove();
    if (pick) { pick.restore(); pick.focus(); }
  }

  /* ====================== ГЛОБАЛЬНЫЕ КЛАВИШИ ====================== */

  document.addEventListener('keydown', (e) => {
    // Alt+Tab
    if (e.altKey && e.code === 'Tab') {
      e.preventDefault();
      if (!atState) altTabOpen(false);
      else altTabNext(e.shiftKey ? -1 : 1);
      return;
    }
    if (atState) {
      if (e.code === 'Escape') { e.preventDefault(); altTabCancel(); return; }
      if (atState.sticky) {
        if (e.code === 'ArrowRight') { e.preventDefault(); altTabNext(1); return; }
        if (e.code === 'ArrowLeft') { e.preventDefault(); altTabNext(-1); return; }
        if (e.code === 'Enter') { e.preventDefault(); altTabCommit(); return; }
      }
    }
    // Mission Control: F3 или Ctrl+Alt+M
    if (e.code === 'F3' || (e.ctrlKey && e.altKey && e.code === 'KeyM')) {
      e.preventDefault();
      missionToggle();
      return;
    }
    if (missionOn && e.code === 'Escape') { missionExit(null); return; }

    // Снэп с клавиатуры (Win+стрелки → Ctrl+Alt+стрелки)
    if (e.ctrlKey && e.altKey && focused && !focused.isMin) {
      if (e.code === 'ArrowLeft') { e.preventDefault(); focused.snapTo('left'); }
      else if (e.code === 'ArrowRight') { e.preventDefault(); focused.snapTo('right'); }
      else if (e.code === 'ArrowUp') { e.preventDefault(); focused.snapTo('max'); }
      else if (e.code === 'ArrowDown') {
        e.preventDefault();
        if (focused.snapState) focused.unsnap(true);
        else focused.minimize();
      }
    }
    // Ctrl+W — закрыть активное окно
    if (e.ctrlKey && !e.altKey && !e.shiftKey && e.code === 'KeyW' && focused) {
      e.preventDefault();
      focused.close();
    }
  });
  document.addEventListener('keyup', (e) => {
    if (e.key === 'Alt' && atState && !atState.sticky) {
      e.preventDefault();
      altTabCommit();
    }
  });
  window.addEventListener('blur', () => { if (atState && !atState.sticky) altTabCommit(); });

  window.addEventListener('resize', () => {
    const a = workArea();
    windows.forEach(w => {
      if (w.snapState) { w.setRect(snapRect(w.snapState), false); return; }
      const r = w.rect();
      w.setRect({
        x: clamp(r.x, -r.w + 120, a.w - 80),
        y: clamp(r.y, a.y, Math.max(a.y, a.y + a.h - 40)),
        w: Math.min(r.w, a.w), h: Math.min(r.h, a.h),
      }, false);
    });
  });

  /* ====================== ЭКСПОРТ ====================== */

  OS.wm = {
    createWindow: (app, args) => new Win(app, args),
    get focused() { return focused; },
    all: () => Array.from(windows.values()),
    windowsOf: (appId) => Array.from(windows.values()).filter(w => w.app.id === appId),
    byId: (id) => windows.get(id),
    minimizeOthers(keep) {
      windows.forEach(w => { if (w !== keep && !w.isMin) w.minimize(); });
    },
    /** «Показать стол»: свернуть всё; повторный вызов возвращает окна */
    showDesktop() {
      if (this._peek && this._peek.some(id => windows.has(id) && windows.get(id).isMin)) {
        this._peek.forEach(id => { const w = windows.get(id); if (w && w.isMin) w.restore(); });
        this._peek = null;
      } else {
        this._peek = Array.from(windows.values()).filter(w => !w.isMin).map(w => w.id);
        this._peek.forEach(id => windows.get(id).minimize());
      }
    },
    closeAll(appId) {
      Array.from(windows.values()).filter(w => !appId || w.app.id === appId).forEach(w => w.close());
    },
    missionToggle,
    altTabOpen: () => altTabOpen(true),
    workArea,
  };
})();
