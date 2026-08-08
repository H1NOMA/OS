/* ============================================================
   Hiko OS · widgets — виджеты рабочего стола
   Реестр, галерея добавления, перетаскивание, персистентность.
   Виджет: OS.widgets.register({id, name, desc, w, h, preview, render})
   render(body, ctx) → опционально возвращает dispose()
   ctx: { data, save(data), uid }
   ============================================================ */
(function () {
  'use strict';
  const { el, esc, clamp, uid } = OS;

  const registry = new Map();
  const live = new Map();   // uid -> {el, dispose, entry}
  let entries = [];         // персистентный список [{uid, type, x, y, data}]
  let layerReady = false;

  function persist() {
    OS.settings.set('widgets', entries.map(e => ({ uid: e.uid, type: e.type, x: e.x, y: e.y, data: e.data })));
  }

  OS.injectStyle('core-widgets', `
    .widget {
      position: absolute;
      background: var(--glass-strong);
      backdrop-filter: blur(34px) saturate(160%);
      -webkit-backdrop-filter: blur(34px) saturate(160%);
      border: 1px solid var(--glass-border);
      border-radius: 18px;
      box-shadow: 0 10px 34px rgba(0,0,0,.24);
      color: var(--text);
      overflow: hidden;
      animation: menu-in .2s var(--ease-out);
    }
    .widget.dragging { box-shadow: 0 20px 54px rgba(0,0,0,.4); opacity: .92; }
    .widget .wg-body { width: 100%; height: 100%; display: flex; flex-direction: column; }

    /* — галерея — */
    #wg-gallery {
      position: fixed; inset: 0;
      z-index: 9200;
      background: rgba(10, 10, 18, .3);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      display: flex; align-items: center; justify-content: center;
      animation: lp-in .18s var(--ease-out);
    }
    .wg-panel {
      width: min(680px, 92vw);
      max-height: 78vh;
      display: flex; flex-direction: column;
      background: var(--glass-strong);
      backdrop-filter: blur(50px) saturate(180%);
      -webkit-backdrop-filter: blur(50px) saturate(180%);
      border: 1px solid var(--glass-border);
      border-radius: var(--r-panel);
      box-shadow: var(--shadow-panel);
      animation: menu-in .2s var(--ease-spring);
    }
    .wg-head {
      display: flex; align-items: center;
      padding: 14px 18px 10px;
    }
    .wg-head h2 { font-size: 17px; }
    .wg-head .wg-x { margin-left: auto; }
    .wg-grid {
      overflow-y: auto;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
      gap: 12px;
      padding: 6px 18px 18px;
    }
    .wg-card {
      background: var(--ctl-bg);
      border-radius: 14px;
      padding: 13px;
      display: flex; flex-direction: column; gap: 8px;
      cursor: default;
    }
    .wg-card:hover { background: var(--ctl-bg-hover); }
    .wg-card .wg-prev {
      height: 74px;
      border-radius: 10px;
      background: linear-gradient(135deg, var(--accent-soft), transparent);
      display: flex; align-items: center; justify-content: center;
      font-size: 34px;
    }
    .wg-card .wg-name { font-size: 13.5px; font-weight: 700; }
    .wg-card .wg-desc { font-size: 12px; color: var(--text-2); line-height: 1.35; flex: 1; }
    .wg-card .ui-btn { align-self: flex-start; }

    /* — начинка виджетов — */
    .wgc-center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; }
    .wg-clock-date { font-size: 12px; color: var(--text-2); }
    .wg-cal { padding: 12px 14px; }
    .wg-cal .cal-grid { font-size: 11px; }
    .wg-cal .cal-head { margin-bottom: 6px; font-size: 13.5px; }
    .wg-note-ta {
      flex: 1; border: none; outline: none; resize: none;
      background: transparent; color: inherit;
      font: 13px/1.5 var(--font);
      padding: 12px 14px;
    }
    .wg-note { background: linear-gradient(160deg, rgba(255,214,130,.92), rgba(255,183,90,.92)); color: #3c2a08; }
    [data-theme="dark"] .wg-note { background: linear-gradient(160deg, rgba(214,164,72,.9), rgba(173,122,44,.9)); color: #241802; }
    .wg-title-row {
      flex: none; display: flex; align-items: center; gap: 6px;
      padding: 9px 13px 0;
      font-size: 11px; font-weight: 800; letter-spacing: .6px; text-transform: uppercase;
      color: var(--text-3);
    }
    .wg-mon-rows { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 9px; padding: 6px 14px 12px; }
    .wg-mon-row { font-size: 11.5px; color: var(--text-2); }
    .wg-mon-bar { height: 7px; border-radius: 4px; background: var(--ctl-bg-hover); overflow: hidden; margin-top: 3px; }
    .wg-mon-bar > div { height: 100%; border-radius: 4px; background: linear-gradient(90deg, var(--accent), var(--accent-2)); transition: width .8s ease; }
    .wg-weather-main { display: flex; align-items: center; gap: 12px; padding: 2px 14px; flex: 1; }
    .wg-weather-main .we-emoji { font-size: 38px; }
    .wg-weather-main .we-t { font-size: 30px; font-weight: 800; }
    .wg-weather-main .we-d { font-size: 12px; color: var(--text-2); }
    .wg-weather-city {
      border: none; outline: none;
      background: transparent; color: var(--text-2);
      font: 11.5px var(--font);
      margin-left: auto;
    }
    .wg-weather-city option { color: #222; }
    .wg-photo-img { flex: 1; background-size: cover; background-position: center; }
    .wg-photo-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; font-size: 12px; color: var(--text-2); background: linear-gradient(135deg, var(--accent-soft), transparent); }
  `);

  /* ================= каркас ================= */

  function layer() { return document.getElementById('desktop'); }

  function mount(entry) {
    const def = registry.get(entry.type);
    if (!def) return;
    const w = el('div', 'widget');
    w.style.width = def.w + 'px';
    w.style.height = def.h + 'px';
    w.style.left = clamp(entry.x, 0, Math.max(0, innerWidth - def.w - 8)) + 'px';
    w.style.top = clamp(entry.y, 0, Math.max(0, innerHeight - 30 - def.h - 90)) + 'px';
    const body = el('div', 'wg-body');
    w.appendChild(body);
    layer().appendChild(w);

    const ctx = {
      uid: entry.uid,
      data: entry.data || {},
      save(d) { entry.data = d; persist(); },
    };
    let dispose = null;
    try { dispose = def.render(body, ctx) || null; }
    catch (e) {
      console.error('[widgets] ошибка виджета', entry.type, e);
      body.innerHTML = `<div class="wgc-center" style="font-size:12px;color:var(--text-3)">Виджет сломался 😵</div>`;
    }
    live.set(entry.uid, { el: w, dispose, entry });

    // перетаскивание (кроме интерактивных элементов)
    w.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('textarea, input, button, select, a, [data-nodrag]')) return;
      const sx = e.clientX, sy = e.clientY;
      const ox = parseFloat(w.style.left), oy = parseFloat(w.style.top);
      let moved = false;
      const move = (ev) => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (!moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
        if (!moved) { moved = true; w.classList.add('dragging'); }
        w.style.left = clamp(ox + dx, 0, innerWidth - 60) + 'px';
        w.style.top = clamp(oy + dy, 0, innerHeight - 30 - 80) + 'px';
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        w.classList.remove('dragging');
        if (moved) {
          entry.x = parseFloat(w.style.left);
          entry.y = parseFloat(w.style.top);
          persist();
        }
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });

    w.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      OS.contextMenu([
        { label: def.name, disabled: true },
        { sep: true },
        { label: 'Обновить', action: () => remount(entry.uid) },
        { label: 'Убрать виджет', action: () => remove(entry.uid) },
        { sep: true },
        { label: 'Добавить виджет…', action: openGallery },
      ], e.clientX, e.clientY);
    });
  }

  function unmount(uidv) {
    const inst = live.get(uidv);
    if (!inst) return;
    try { if (inst.dispose) inst.dispose(); } catch (e) { /* — */ }
    inst.el.remove();
    live.delete(uidv);
  }

  function remount(uidv) {
    const entry = entries.find(e => e.uid === uidv);
    unmount(uidv);
    if (entry) mount(entry);
  }

  // свободное место слева, колонками, без пересечений с другими виджетами
  function findSpot(def) {
    const GAP = 14;
    for (let col = 0; col < 5; col++) {
      for (let row = 0; row < 4; row++) {
        const x = 24 + col * 254;
        const y = 18 + row * 208;
        if (y + def.h > innerHeight - 30 - 100) continue;
        const clash = entries.some(e => {
          const d = registry.get(e.type);
          if (!d) return false;
          return !(e.x + d.w + GAP <= x || x + def.w + GAP <= e.x ||
                   e.y + d.h + GAP <= y || y + def.h + GAP <= e.y);
        });
        if (!clash) return { x, y };
      }
    }
    return { x: 40 + entries.length * 26, y: 30 + entries.length * 26 };
  }

  function add(type) {
    const def = registry.get(type);
    if (!def) return;
    const spot = findSpot(def);
    const entry = { uid: uid('wg'), type, x: spot.x, y: spot.y, data: {} };
    entries.push(entry);
    persist();
    mount(entry);
  }

  function remove(uidv) {
    const inst = live.get(uidv);
    entries = entries.filter(e => e.uid !== uidv);
    persist();
    if (inst) {
      inst.el.classList.add('wg-out');
      setTimeout(() => unmount(uidv), 190);
    }
  }

  /* ================= галерея ================= */

  function openGallery() {
    if (document.getElementById('wg-gallery')) return;
    const g = el('div');
    g.id = 'wg-gallery';
    g.innerHTML = `
      <div class="wg-panel">
        <div class="wg-head"><h2>Виджеты</h2><button class="ui-btn wg-x">Готово</button></div>
        <div class="wg-grid">
          ${Array.from(registry.values()).map(d => `
            <div class="wg-card" data-w="${esc(d.id)}">
              <div class="wg-prev">${d.preview || '🧩'}</div>
              <div class="wg-name">${esc(d.name)}</div>
              <div class="wg-desc">${esc(d.desc || '')}</div>
              <button class="ui-btn primary">Добавить</button>
            </div>`).join('')}
        </div>
      </div>`;
    document.body.appendChild(g);
    const close = () => g.remove();
    g.querySelector('.wg-x').addEventListener('click', close);
    g.addEventListener('click', (e) => { if (e.target === g) close(); });
    const onKey = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);
    g.querySelectorAll('.wg-card').forEach(card => {
      card.querySelector('button').addEventListener('click', () => {
        add(card.dataset.w);
        OS.beep(760, .07);
      });
    });
  }

  /* ================= встроенные виджеты ================= */

  const MON_RU = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const DOW_RU = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

  /* — Часы — */
  registry.set('w-clock', {
    id: 'w-clock', name: 'Часы', desc: 'Аналоговые часы с датой', w: 176, h: 190, preview: '🕒',
    render(body) {
      body.innerHTML = `
        <div class="wgc-center">
          <svg width="118" height="118" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="56" fill="var(--content-bg)" stroke="var(--divider)" stroke-width="1.5"/>
            ${[0, 1, 2, 3].map(i => {
              const a = i * 90 * Math.PI / 180;
              return `<circle cx="${60 + 47 * Math.sin(a)}" cy="${60 - 47 * Math.cos(a)}" r="2.2" fill="var(--accent)"/>`;
            }).join('')}
            <line class="wh" x1="60" y1="60" x2="60" y2="33" stroke="var(--text)" stroke-width="4.5" stroke-linecap="round"/>
            <line class="wm" x1="60" y1="60" x2="60" y2="22" stroke="var(--text)" stroke-width="3" stroke-linecap="round"/>
            <line class="ws" x1="60" y1="67" x2="60" y2="18" stroke="var(--accent)" stroke-width="1.6" stroke-linecap="round"/>
            <circle cx="60" cy="60" r="3.2" fill="var(--accent)"/>
          </svg>
          <div class="wg-clock-date"></div>
        </div>`;
      const hh = body.querySelector('.wh'), mm = body.querySelector('.wm'), ss = body.querySelector('.ws');
      const dateEl = body.querySelector('.wg-clock-date');
      const tick = () => {
        const d = new Date();
        const s = d.getSeconds(), m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60;
        ss.setAttribute('transform', `rotate(${s * 6} 60 60)`);
        mm.setAttribute('transform', `rotate(${m * 6} 60 60)`);
        hh.setAttribute('transform', `rotate(${h * 30} 60 60)`);
        dateEl.textContent = `${DOW_RU[d.getDay()]}, ${d.getDate()} ${MON_RU[d.getMonth()]}`;
      };
      tick();
      const t = setInterval(tick, 1000);
      return () => clearInterval(t);
    },
  });

  /* — Календарь — */
  registry.set('w-cal', {
    id: 'w-cal', name: 'Календарь', desc: 'Текущий месяц с сегодняшним днём', w: 208, h: 208, preview: '📅',
    render(body) {
      const MONF = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
      let shownKey = '';
      const draw = () => {
        const d = new Date();
        const key = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
        if (key === shownKey) return;
        shownKey = key;
        const y = d.getFullYear(), mo = d.getMonth(), today = d.getDate();
        const firstDow = (new Date(y, mo, 1).getDay() + 6) % 7;
        const daysIn = new Date(y, mo + 1, 0).getDate();
        let cells = '';
        ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].forEach(dw => cells += `<div class="cal-dow">${dw}</div>`);
        for (let i = 0; i < firstDow; i++) cells += `<div class="cal-day other"></div>`;
        for (let day = 1; day <= daysIn; day++) cells += `<div class="cal-day ${day === today ? 'today' : ''}">${day}</div>`;
        body.innerHTML = `<div class="wg-cal">
          <div class="cal-head"><span class="cal-month">${MONF[mo]}</span> <span>${y}</span></div>
          <div class="cal-grid">${cells}</div>
        </div>`;
      };
      draw();
      const t = setInterval(draw, 30000);
      return () => clearInterval(t);
    },
  });

  /* — Стикер — */
  registry.set('w-note', {
    id: 'w-note', name: 'Стикер', desc: 'Быстрая заметка, всегда на столе', w: 220, h: 168, preview: '📝',
    render(body, ctx) {
      body.classList.add('wg-note');
      const ta = el('textarea', 'wg-note-ta');
      ta.placeholder = 'Записать что-нибудь…';
      ta.spellcheck = false;
      ta.value = (ctx.data && ctx.data.text) || '';
      ta.addEventListener('input', OS.debounce(() => ctx.save({ text: ta.value }), 400));
      ta.addEventListener('keydown', (e) => e.stopPropagation());
      body.appendChild(ta);
    },
  });

  /* — Монитор — */
  registry.set('w-mon', {
    id: 'w-mon', name: 'Монитор', desc: 'Процессор, память и хранилище', w: 236, h: 170, preview: '📈',
    render(body) {
      body.innerHTML = `
        <div class="wg-title-row">Система</div>
        <div class="wg-mon-rows">
          <div class="wg-mon-row"><span class="c-lbl">ЦП</span><div class="wg-mon-bar"><div class="c-bar"></div></div></div>
          <div class="wg-mon-row"><span class="m-lbl">Память</span><div class="wg-mon-bar"><div class="m-bar"></div></div></div>
          <div class="wg-mon-row"><span class="s-lbl">Хранилище</span><div class="wg-mon-bar"><div class="s-bar"></div></div></div>
        </div>`;
      let cpu = 8 + Math.random() * 10, mem = 30 + Math.random() * 15;
      const upd = () => {
        cpu = clamp(cpu + (Math.random() - 0.5) * 7, 2, 92);
        mem = clamp(mem + (Math.random() - 0.5) * 3, 18, 88);
        const used = OS.vfs.usage();
        const stPct = clamp(used / (5 * 1024 * 1024) * 100, 0.5, 100);
        body.querySelector('.c-lbl').textContent = `ЦП · ${cpu.toFixed(0)}%`;
        body.querySelector('.c-bar').style.width = cpu + '%';
        body.querySelector('.m-lbl').textContent = `Память · ${mem.toFixed(0)}%`;
        body.querySelector('.m-bar').style.width = mem + '%';
        body.querySelector('.s-lbl').textContent = `Хранилище · ${OS.fmtBytes(used)}`;
        body.querySelector('.s-bar').style.width = stPct + '%';
      };
      upd();
      const t = setInterval(upd, 1600);
      return () => clearInterval(t);
    },
  });

  /* — Погода — */
  const CITIES = [
    { name: 'Москва', lat: 55.75, lon: 37.62 },
    { name: 'Санкт-Петербург', lat: 59.94, lon: 30.31 },
    { name: 'Лондон', lat: 51.51, lon: -0.13 },
    { name: 'Нью-Йорк', lat: 40.71, lon: -74.01 },
    { name: 'Токио', lat: 35.68, lon: 139.69 },
    { name: 'Дубай', lat: 25.2, lon: 55.27 },
    { name: 'Сидней', lat: -33.87, lon: 151.21 },
  ];
  function weatherOf(code, isDay) {
    if (code === 0) return [isDay ? '☀️' : '🌙', 'Ясно'];
    if (code <= 2) return [isDay ? '🌤️' : '☁️', 'Переменная облачность'];
    if (code === 3) return ['☁️', 'Пасмурно'];
    if (code === 45 || code === 48) return ['🌫️', 'Туман'];
    if (code >= 51 && code <= 67) return ['🌧️', 'Дождь'];
    if (code >= 71 && code <= 77) return ['❄️', 'Снег'];
    if (code >= 80 && code <= 82) return ['🌦️', 'Ливень'];
    if (code >= 95) return ['⛈️', 'Гроза'];
    return ['🌡️', 'Погода'];
  }
  registry.set('w-weather', {
    id: 'w-weather', name: 'Погода', desc: 'Текущая погода (нужен интернет)', w: 236, h: 150, preview: '⛅',
    render(body, ctx) {
      let cityIdx = Math.max(0, CITIES.findIndex(c => c.name === (ctx.data && ctx.data.city)));
      body.innerHTML = `
        <div class="wg-title-row">Погода
          <select class="wg-weather-city" data-nodrag>
            ${CITIES.map((c, i) => `<option value="${i}" ${i === cityIdx ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="wg-weather-main">
          <div class="we-emoji">⏳</div>
          <div><div class="we-t">—</div><div class="we-d">Загрузка…</div></div>
        </div>`;
      const emojiEl = body.querySelector('.we-emoji');
      const tEl = body.querySelector('.we-t');
      const dEl = body.querySelector('.we-d');

      let alive = true;
      async function fetchWeather() {
        const c = CITIES[cityIdx];
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 8000);
          const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&current_weather=true`, { signal: ctrl.signal });
          clearTimeout(timer);
          const j = await r.json();
          if (!alive || !j.current_weather) throw new Error('нет данных');
          const cw = j.current_weather;
          const [emoji, desc] = weatherOf(cw.weathercode, cw.is_day);
          emojiEl.textContent = emoji;
          tEl.textContent = `${Math.round(cw.temperature)}°`;
          dEl.textContent = `${desc} · ветер ${Math.round(cw.windspeed)} км/ч`;
          ctx.save({ city: c.name, cache: { t: cw.temperature, code: cw.weathercode, day: cw.is_day, ts: Date.now() } });
        } catch (e) {
          if (!alive) return;
          const cache = ctx.data && ctx.data.cache;
          if (cache) {
            const [emoji, desc] = weatherOf(cache.code, cache.day);
            emojiEl.textContent = emoji;
            tEl.textContent = `${Math.round(cache.t)}°`;
            dEl.textContent = `${desc} · данные не свежие`;
          } else {
            emojiEl.textContent = '📡';
            tEl.textContent = '—';
            dEl.textContent = 'Нет соединения';
          }
        }
      }
      body.querySelector('select').addEventListener('change', (e) => {
        cityIdx = +e.target.value;
        ctx.save({ ...(ctx.data || {}), city: CITIES[cityIdx].name });
        emojiEl.textContent = '⏳'; tEl.textContent = '—'; dEl.textContent = 'Загрузка…';
        fetchWeather();
      });
      fetchWeather();
      const t = setInterval(fetchWeather, 20 * 60 * 1000);
      return () => { alive = false; clearInterval(t); };
    },
  });

  /* — Фото — */
  registry.set('w-photo', {
    id: 'w-photo', name: 'Фоторамка', desc: 'Картинки из папки «Изображения», клик — следующая', w: 220, h: 172, preview: '🖼️',
    render(body, ctx) {
      let idx = (ctx.data && ctx.data.idx) || 0;
      const collect = () => {
        const out = [];
        const walk = (dir) => {
          let items;
          try { items = OS.vfs.list(dir); } catch (e) { return; }
          items.forEach(i => {
            if (i.type === 'dir') walk(i.path);
            else if (/\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(i.name)) out.push(i.path);
          });
        };
        walk('/Pictures');
        return out;
      };
      const show = () => {
        const photos = collect();
        if (!photos.length) {
          body.innerHTML = `<div class="wg-photo-empty">🖼️<div>Нет картинок в «Изображениях»</div><div style="font-size:11px;opacity:.7">Нарисуй что-нибудь в Paint!</div></div>`;
          return;
        }
        idx = ((idx % photos.length) + photos.length) % photos.length;
        let src = null;
        try {
          const c = OS.vfs.read(photos[idx]);
          if (c.startsWith('data:')) src = c;
          else if (photos[idx].toLowerCase().endsWith('.svg')) src = 'data:image/svg+xml,' + encodeURIComponent(c);
        } catch (e) { /* — */ }
        body.innerHTML = `<div class="wg-photo-img" style="${src ? `background-image:url('${src}')` : ''}" title="Клик — следующая"></div>`;
        body.querySelector('.wg-photo-img').addEventListener('click', () => {
          idx++;
          ctx.save({ idx });
          show();
        });
      };
      show();
      const un = OS.on('vfs:change', OS.debounce(({ path }) => { if (path.startsWith('/Pictures')) show(); }, 300));
      return () => un();
    },
  });

  /* ================= init / API ================= */

  function init() {
    if (layerReady) return;
    layerReady = true;
    entries = (OS.settings.get('widgets') || []).map(e => ({ ...e }));
    entries.forEach(mount);
    // стартовый набор при первом запуске
    if (!OS.settings.get('widgetsSeeded')) {
      OS.settings.set('widgetsSeeded', true);
      if (!entries.length) {
        add('w-clock');
        add('w-weather');
      }
    }
  }

  OS.widgets = {
    register: (def) => registry.set(def.id, def),
    add, remove, openGallery, init,
    all: () => Array.from(registry.values()),
  };
})();
