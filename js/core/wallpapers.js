/* ============================================================
   Hiko OS · wallpapers — фирменные обои (SVG-градиенты
   с «туманностями» и звёздами, без внешних файлов)
   ============================================================ */
(function () {
  'use strict';

  // детерминированная псевдослучайность — обои всегда одинаковые
  const frac = (x) => x - Math.floor(x);
  const rnd = (i, salt) => frac(Math.sin(i * 127.1 + salt * 311.7) * 43758.5453);

  function stars(count, salt, maxR) {
    let out = '';
    for (let i = 0; i < count; i++) {
      const x = (rnd(i, salt) * 1920).toFixed(0);
      const y = (rnd(i, salt + 1) * 1080).toFixed(0);
      const r = (0.6 + rnd(i, salt + 2) * (maxR || 1.4)).toFixed(2);
      const o = (0.25 + rnd(i, salt + 3) * 0.6).toFixed(2);
      out += `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${o}"/>`;
    }
    return out;
  }

  function meshWallpaper(base, blobs, extra) {
    const ellipses = blobs.map((b, i) =>
      `<ellipse cx="${b.x}" cy="${b.y}" rx="${b.rx}" ry="${b.ry}" fill="url(#g${i})" ${b.rot ? `transform="rotate(${b.rot} ${b.x} ${b.y})"` : ''}/>`
    ).join('');
    const grads = blobs.map((b, i) =>
      `<radialGradient id="g${i}"><stop offset="0" stop-color="${b.c}" stop-opacity="${b.o !== undefined ? b.o : 0.9}"/><stop offset="1" stop-color="${b.c}" stop-opacity="0"/></radialGradient>`
    ).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
      <defs>${grads}<filter id="blur"><feGaussianBlur stdDeviation="60"/></filter></defs>
      <rect width="1920" height="1080" fill="${base}"/>
      <g filter="url(#blur)">${ellipses}</g>
      ${extra || ''}
    </svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  const PRESETS = [
    {
      id: 'nebula', name: 'Небула', uri: meshWallpaper('#0d0e1b', [
        { x: 1420, y: 280, rx: 850, ry: 620, c: '#7C5CFF' },
        { x: 420, y: 830, rx: 900, ry: 640, c: '#23D1A8', o: .55 },
        { x: 950, y: 480, rx: 600, ry: 460, c: '#4a3f9e', o: .75 },
        { x: 1720, y: 980, rx: 650, ry: 480, c: '#C86DD7', o: .5 },
        { x: 150, y: 120, rx: 500, ry: 380, c: '#2b3fa8', o: .5 },
      ], stars(90, 7, 1.5)),
    },
    {
      id: 'mint', name: 'Мятный бриз', uri: meshWallpaper('#062421', [
        { x: 550, y: 700, rx: 900, ry: 650, c: '#23D1A8' },
        { x: 1550, y: 300, rx: 800, ry: 600, c: '#0FA3A0', o: .85 },
        { x: 1200, y: 1000, rx: 750, ry: 480, c: '#0b5a4d' },
        { x: 250, y: 150, rx: 550, ry: 420, c: '#7CF0CE', o: .35 },
      ]),
    },
    {
      id: 'dune', name: 'Дюна', uri: meshWallpaper('#251310', [
        { x: 480, y: 350, rx: 850, ry: 620, c: '#FF9F5C' },
        { x: 1560, y: 720, rx: 850, ry: 640, c: '#E05A48', o: .85 },
        { x: 1000, y: 1050, rx: 750, ry: 460, c: '#B0482E', o: .8 },
        { x: 1750, y: 150, rx: 520, ry: 400, c: '#FFD9A0', o: .35 },
      ]),
    },
    {
      id: 'aurora', name: 'Аврора', uri: meshWallpaper('#040b12', [
        { x: 650, y: 260, rx: 950, ry: 480, c: '#23D1A8', rot: -8 },
        { x: 1450, y: 550, rx: 800, ry: 550, c: '#3AA6FF', o: .6 },
        { x: 350, y: 950, rx: 700, ry: 450, c: '#0e4d3c' },
        { x: 1150, y: 120, rx: 600, ry: 320, c: '#9ADB4F', o: .35, rot: -10 },
      ], stars(70, 21, 1.2)),
    },
    {
      id: 'abyss', name: 'Глубина', uri: meshWallpaper('#050818', [
        { x: 1400, y: 300, rx: 820, ry: 560, c: '#1E3A8A', o: .95 },
        { x: 450, y: 850, rx: 880, ry: 620, c: '#13235e' },
        { x: 1000, y: 550, rx: 480, ry: 380, c: '#38BDF8', o: .35 },
        { x: 1800, y: 1000, rx: 520, ry: 400, c: '#0e7490', o: .5 },
      ], stars(45, 33, 1.1)),
    },
    {
      id: 'ember', name: 'Уголь', uri: meshWallpaper('#121214', [
        { x: 650, y: 400, rx: 900, ry: 650, c: '#3a3a44', o: .9 },
        { x: 1500, y: 800, rx: 800, ry: 600, c: '#26262e' },
        { x: 1000, y: 1080, rx: 700, ry: 300, c: '#FF6B5E', o: .22 },
        { x: 1350, y: 200, rx: 600, ry: 450, c: '#54545e', o: .5 },
      ]),
    },
    {
      id: 'dawn', name: 'Рассвет', uri: meshWallpaper('#f2e7de', [
        { x: 500, y: 350, rx: 850, ry: 620, c: '#ffd3c2' },
        { x: 1500, y: 700, rx: 850, ry: 640, c: '#c9b6ff', o: .6 },
        { x: 1100, y: 150, rx: 650, ry: 450, c: '#ffe9b8', o: .8 },
        { x: 200, y: 1000, rx: 650, ry: 450, c: '#ffb9d0', o: .5 },
      ]),
    },
    {
      id: 'fern', name: 'Сад', uri: meshWallpaper('#0f2719', [
        { x: 600, y: 650, rx: 900, ry: 650, c: '#2fae6f' },
        { x: 1550, y: 300, rx: 800, ry: 600, c: '#1b6b45', o: .95 },
        { x: 1250, y: 1000, rx: 700, ry: 450, c: '#9ADB4F', o: .35 },
        { x: 200, y: 150, rx: 500, ry: 400, c: '#57cf9a', o: .4 },
      ]),
    },
  ];

  OS.wallpapers = {
    presets: PRESETS,
    get(id) { return PRESETS.find(p => p.id === id); },
    uriFor(idOrUri) {
      if (!idOrUri) return PRESETS[0].uri;
      if (String(idOrUri).startsWith('data:') || String(idOrUri).startsWith('http')) return idOrUri;
      const p = PRESETS.find(x => x.id === idOrUri);
      return p ? p.uri : PRESETS[0].uri;
    },
    apply() {
      const uri = this.uriFor(OS.settings.get('wallpaper'));
      const wp = document.getElementById('wallpaper');
      if (wp) wp.style.backgroundImage = `url("${uri}")`;
      const lock = document.getElementById('lock');
      if (lock) lock.style.backgroundImage = `url("${uri}")`;
    },
  };

  OS.on('settings:change', ({ key }) => { if (key === 'wallpaper') OS.wallpapers.apply(); });
})();
