/* Hiko OS · Пианино — синтезатор с записью мелодий */
(function () {
  'use strict';
  const { el, esc } = OS;

  const ICON = OS.appTile(
    { from: '#FF7DA8', to: '#A83A78' },
    `<g fill="#fff">
      <circle cx="-14" cy="20" r="9"/>
      <circle cx="20" cy="14" r="9"/>
      <path d="M -6 20 L -6 -22 L 28 -28 L 28 14 L 22 14 L 22 -14 L 0 -10 L 0 20 Z"/>
    </g>`
  );

  OS.injectStyle('app-music', `
    .mu-root { flex:1; min-height:0; display:flex; flex-direction:column; }
    .mu-bar { flex-wrap:wrap; row-gap:6px; }
    .mu-stage { flex:1; min-height:0; display:flex; align-items:center; justify-content:center;
      background: radial-gradient(700px 300px at 50% -40%, var(--accent-soft), transparent), var(--content-bg);
      padding: 16px; }
    .mu-kbd { position:relative; height:min(240px, 90%); aspect-ratio:2.3; max-width:100%; user-select:none; }
    .mu-key { position:absolute; top:0; border-radius:0 0 7px 7px; cursor:default;
      box-shadow: inset 0 -4px 8px rgba(0,0,0,.08), 0 2px 5px rgba(0,0,0,.22);
      transition: filter .06s, transform .06s; }
    .mu-key.white { background:linear-gradient(#fdfdfa, #eceae4); height:100%; width:calc(100%/14);
      border:1px solid rgba(0,0,0,.16); z-index:1; }
    .mu-key.black { background:linear-gradient(#3a3d4a, #14161e); height:60%; width:calc(100%/14*.62);
      z-index:2; border-radius:0 0 5px 5px; }
    .mu-key.on { filter:brightness(.82); transform:translateY(2px); }
    .mu-key.black.on { filter:brightness(1.6); }
    .mu-key .kb-hint { position:absolute; bottom:6px; left:50%; transform:translateX(-50%);
      font-size:10px; color:rgba(0,0,0,.35); font-family:var(--font-mono); }
    .mu-key.black .kb-hint { color:rgba(255,255,255,.5); }
    .mu-rec-dot { width:9px; height:9px; border-radius:50%; background:#FF6B5E; display:inline-block;
      animation: mu-blink 1s step-end infinite; margin-right:5px; }
    @keyframes mu-blink { 50% { opacity:.25; } }
    .mu-count { font-size:12px; color:var(--text-3); margin-left:auto; white-space:nowrap; }
  `);

  const WAVES = [['sine', 'Синус'], ['triangle', 'Мягкий'], ['sawtooth', 'Пила'], ['square', 'Ретро']];
  // клавиатура: нижний ряд — белые, верхний — чёрные
  const KEYMAP = {
    KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6,
    KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13,
    KeyL: 14, KeyP: 15, Semicolon: 16,
  };
  const HINTS = ['A', 'W', 'S', 'E', 'D', 'F', 'T', 'G', 'Y', 'H', 'U', 'J', 'K', 'O', 'L', 'P', ';'];
  const BLACKS = new Set([1, 3, 6, 8, 10, 13, 15, 18, 20, 22]); // полутоны в 2 октавах

  OS.registerApp({
    id: 'music',
    name: 'Пианино',
    icon: ICON,
    width: 720, height: 400,
    minWidth: 540, minHeight: 300,
    singleton: true,
    render(win) {
      let audio = null;
      let wave = 'triangle';
      let octave = 4;         // базовая октава (C4)
      let volume = 0.5;
      const voices = new Map();      // midi -> {osc, gain}
      // запись
      let recording = false, recStart = 0, recNotes = [], noteOpen = new Map();
      let playTimers = [];

      const ensureAudio = () => {
        if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
        if (audio.state === 'suspended') audio.resume();
        return audio;
      };
      const freqOf = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

      function noteOn(midi) {
        if (voices.has(midi)) return;
        const ctx = ensureAudio();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = wave;
        osc.frequency.value = freqOf(midi);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(volume * 0.32, ctx.currentTime + 0.015);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        voices.set(midi, { osc, gain });
        keyEl(midi)?.classList.add('on');
        if (recording) noteOpen.set(midi, performance.now() - recStart);
      }
      function noteOff(midi) {
        const v = voices.get(midi);
        if (!v) return;
        voices.delete(midi);
        const ctx = audio;
        try {
          v.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.07);
          v.osc.stop(ctx.currentTime + 0.4);
        } catch (e) { /* — */ }
        keyEl(midi)?.classList.remove('on');
        if (recording && noteOpen.has(midi)) {
          const t = noteOpen.get(midi);
          noteOpen.delete(midi);
          recNotes.push({ t, midi, d: performance.now() - recStart - t });
          updateCount();
        }
      }
      function allOff() {
        Array.from(voices.keys()).forEach(noteOff);
      }

      const root = el('div', 'mu-root');
      root.innerHTML = `
        <div class="ui-toolbar mu-bar">
          <div class="ui-seg">${WAVES.map(([v, n]) => `<button class="seg-btn ${v === wave ? 'on' : ''}" data-w="${v}">${n}</button>`).join('')}</div>
          <button class="ui-btn icon-only mu-oct-dn" title="Октава ниже">−</button>
          <span class="mu-oct" style="font-size:12.5px;font-weight:700;min-width:26px;text-align:center">C${octave}</span>
          <button class="ui-btn icon-only mu-oct-up" title="Октава выше">+</button>
          <input class="ui-slider" type="range" min="5" max="100" value="${volume * 100}" style="width:90px" title="Громкость">
          <button class="ui-btn mu-rec">● Запись</button>
          <button class="ui-btn mu-play" disabled>▶ Играть</button>
          <span class="mu-count"></span>
        </div>
        <div class="mu-stage"><div class="mu-kbd"></div></div>`;
      win.content.appendChild(root);

      const kbd = root.querySelector('.mu-kbd');
      const baseMidi = () => 12 * (octave + 1); // C(octave)

      function keyEl(midi) {
        return kbd.querySelector(`[data-midi="${midi}"]`);
      }

      function buildKeys() {
        kbd.innerHTML = '';
        const base = baseMidi();
        let whiteIdx = 0;
        for (let semi = 0; semi < 24; semi++) {
          const midi = base + semi;
          const isBlack = BLACKS.has(semi);
          const key = el('div', 'mu-key ' + (isBlack ? 'black' : 'white'));
          key.dataset.midi = midi;
          if (isBlack) {
            key.style.left = `calc(100%/14*${whiteIdx} - 100%/14*.31)`;
          } else {
            key.style.left = `calc(100%/14*${whiteIdx})`;
            whiteIdx++;
          }
          // подсказка клавиши
          const hintIdx = Object.values(KEYMAP).indexOf(semi);
          if (hintIdx >= 0 && semi <= 16) key.innerHTML = `<span class="kb-hint">${HINTS[Object.keys(KEYMAP).findIndex(k => KEYMAP[k] === semi)]}</span>`;
          key.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            key.setPointerCapture(e.pointerId);
            noteOn(midi);
          });
          key.addEventListener('pointerup', () => noteOff(midi));
          key.addEventListener('pointercancel', () => noteOff(midi));
          key.addEventListener('pointerleave', () => noteOff(midi));
          kbd.appendChild(key);
        }
      }
      buildKeys();

      /* --- тулбар --- */
      root.querySelectorAll('[data-w]').forEach(b => b.addEventListener('click', () => {
        wave = b.dataset.w;
        root.querySelectorAll('[data-w]').forEach(x => x.classList.toggle('on', x === b));
      }));
      const octLabel = root.querySelector('.mu-oct');
      root.querySelector('.mu-oct-dn').addEventListener('click', () => {
        if (octave > 2) { octave--; octLabel.textContent = 'C' + octave; allOff(); buildKeys(); }
      });
      root.querySelector('.mu-oct-up').addEventListener('click', () => {
        if (octave < 6) { octave++; octLabel.textContent = 'C' + octave; allOff(); buildKeys(); }
      });
      root.querySelector('.ui-slider').addEventListener('input', (e) => { volume = e.target.value / 100; });

      const recBtn = root.querySelector('.mu-rec');
      const playBtn = root.querySelector('.mu-play');
      const countEl = root.querySelector('.mu-count');
      const updateCount = () => {
        countEl.textContent = recNotes.length ? `нот: ${recNotes.length}` : '';
        playBtn.disabled = !recNotes.length || recording;
      };

      recBtn.addEventListener('click', () => {
        recording = !recording;
        if (recording) {
          recNotes = [];
          noteOpen.clear();
          recStart = performance.now();
          recBtn.innerHTML = `<span class="mu-rec-dot"></span>Стоп`;
        } else {
          recBtn.textContent = '● Запись';
        }
        updateCount();
      });

      playBtn.addEventListener('click', () => {
        stopPlayback();
        recNotes.forEach(n => {
          playTimers.push(setTimeout(() => noteOn(n.midi), n.t));
          playTimers.push(setTimeout(() => noteOff(n.midi), n.t + Math.max(80, n.d)));
        });
      });
      function stopPlayback() {
        playTimers.forEach(clearTimeout);
        playTimers = [];
        allOff();
      }

      /* --- клавиатура компьютера --- */
      const downKeys = new Set();
      const onDown = (e) => {
        if (OS.wm.focused !== win) return;
        if (e.target.closest('input, textarea, select')) return;
        const semi = KEYMAP[e.code];
        if (semi === undefined || downKeys.has(e.code)) return;
        e.preventDefault();
        downKeys.add(e.code);
        noteOn(baseMidi() + semi);
      };
      const onUp = (e) => {
        const semi = KEYMAP[e.code];
        if (semi === undefined) return;
        downKeys.delete(e.code);
        noteOff(baseMidi() + semi);
      };
      document.addEventListener('keydown', onDown);
      document.addEventListener('keyup', onUp);

      win.on('close', () => {
        stopPlayback();
        allOff();
        document.removeEventListener('keydown', onDown);
        document.removeEventListener('keyup', onUp);
        if (audio) { try { audio.close(); } catch (e) { /* — */ } }
      });
    },
  });
})();
