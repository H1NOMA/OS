/* ============================================================
   hinomaOS · wallpapers — генератор обоев (SVG-градиенты
   в духе macOS Big Sur/Sequoia, без внешних файлов)
   ============================================================ */
(function () {
  'use strict';

  function meshWallpaper(base, blobs) {
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
    </svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  const PRESETS = [
    {
      id: 'sequoia', name: 'Секвойя', uri: meshWallpaper('#101430', [
        { x: 300, y: 850, rx: 900, ry: 620, c: '#2c4bd8' },
        { x: 1500, y: 250, rx: 800, ry: 600, c: '#7b3df0' },
        { x: 1750, y: 950, rx: 700, ry: 500, c: '#e0448c', o: .75 },
        { x: 800, y: 400, rx: 550, ry: 420, c: '#3d6bff', o: .55 },
        { x: 1100, y: 1050, rx: 800, ry: 400, c: '#18c8e8', o: .5 },
      ]),
    },
    {
      id: 'sonoma', name: 'Сонома', uri: meshWallpaper('#2a1030', [
        { x: 400, y: 300, rx: 800, ry: 600, c: '#ff7b39' },
        { x: 1550, y: 750, rx: 850, ry: 650, c: '#ff3d77' },
        { x: 1000, y: 100, rx: 650, ry: 450, c: '#ffb52e', o: .7 },
        { x: 200, y: 1000, rx: 700, ry: 500, c: '#c02878', o: .8 },
      ]),
    },
    {
      id: 'monterey', name: 'Монтерей', uri: meshWallpaper('#081a38', [
        { x: 500, y: 700, rx: 900, ry: 700, c: '#0a84ff' },
        { x: 1600, y: 300, rx: 750, ry: 600, c: '#30d5c8', o: .8 },
        { x: 1200, y: 1000, rx: 800, ry: 500, c: '#5e5ce6' },
        { x: 150, y: 150, rx: 500, ry: 400, c: '#64d2ff', o: .6 },
      ]),
    },
    {
      id: 'aurora', name: 'Аврора', uri: meshWallpaper('#03150f', [
        { x: 600, y: 250, rx: 900, ry: 500, c: '#12b76a' },
        { x: 1500, y: 600, rx: 800, ry: 600, c: '#0aa2c0', o: .8 },
        { x: 300, y: 950, rx: 700, ry: 450, c: '#0b6b45' },
        { x: 1150, y: 100, rx: 550, ry: 350, c: '#6ee7b7', o: .45 },
      ]),
    },
    {
      id: 'rose', name: 'Розовый кварц', uri: meshWallpaper('#2b0f1e', [
        { x: 500, y: 400, rx: 850, ry: 650, c: '#ff5e8a' },
        { x: 1550, y: 800, rx: 800, ry: 600, c: '#b0338c' },
        { x: 1250, y: 200, rx: 600, ry: 450, c: '#ff9db8', o: .65 },
        { x: 100, y: 1000, rx: 600, ry: 450, c: '#7a1e56' },
      ]),
    },
    {
      id: 'space', name: 'Глубокий космос', uri: meshWallpaper('#05060f', [
        { x: 1450, y: 250, rx: 800, ry: 550, c: '#28306e', o: .95 },
        { x: 400, y: 850, rx: 850, ry: 600, c: '#151a45' },
        { x: 950, y: 550, rx: 450, ry: 350, c: '#4b3a8c', o: .6 },
        { x: 1750, y: 950, rx: 500, ry: 380, c: '#1d5b8a', o: .5 },
      ]),
    },
    {
      id: 'ventura', name: 'Вентура', uri: meshWallpaper('#3a0d12', [
        { x: 450, y: 350, rx: 850, ry: 600, c: '#ff5f45' },
        { x: 1550, y: 700, rx: 850, ry: 650, c: '#d92662' },
        { x: 1000, y: 1050, rx: 700, ry: 450, c: '#ff9459', o: .7 },
        { x: 1800, y: 150, rx: 500, ry: 400, c: '#8f1f4b', o: .85 },
      ]),
    },
    {
      id: 'graphite', name: 'Графит', uri: meshWallpaper('#111114', [
        { x: 600, y: 400, rx: 900, ry: 650, c: '#3a3a42', o: .9 },
        { x: 1500, y: 800, rx: 800, ry: 600, c: '#26262e' },
        { x: 1300, y: 200, rx: 600, ry: 450, c: '#52525e', o: .55 },
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
