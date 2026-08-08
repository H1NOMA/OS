/* ============================================================
   Hiko OS · aura — цветное свечение по краям экрана, когда
   активен голосовой помощник (в духе Apple Intelligence).
   API: OS.aura.show() / hide() / pulse(ms).
   ============================================================ */
(function () {
  'use strict';

  OS.injectStyle('core-aura', `
    #ai-aura {
      position: fixed; inset: 0;
      z-index: 9450; /* над окнами/панелями/тостами, но под меню(9500) и диалогами(9800) */
      pointer-events: none;
      opacity: 0;
      transition: opacity .6s var(--ease-out);
      will-change: opacity;
    }
    #ai-aura.on { opacity: 1; }
    /* Мягкое свечение внутрь от краёв: не рамка, а размытые цветные пятна
       по углам и сторонам, аддитивно светящиеся поверх интерфейса — центр чистый. */
    #ai-aura::before, #ai-aura::after {
      content: "";
      position: absolute; inset: 0;
      transform-origin: center;
      -webkit-mask: radial-gradient(130% 130% at 50% 50%, transparent 16%, #000 68%);
              mask: radial-gradient(130% 130% at 50% 50%, transparent 16%, #000 68%);
      will-change: transform, filter;
    }
    #ai-aura::before {
      background:
        radial-gradient(64% 64% at 0% 0%,     rgba(255,64,112,1),  transparent 82%),
        radial-gradient(66% 66% at 100% 0%,   rgba(72,150,255,1),  transparent 82%),
        radial-gradient(68% 68% at 100% 100%, rgba(176,84,255,1),  transparent 82%),
        radial-gradient(66% 66% at 0% 100%,   rgba(46,224,150,1),  transparent 82%),
        radial-gradient(85% 48% at 50% 0%,    rgba(255,184,92,.95), transparent 85%),
        radial-gradient(48% 85% at 100% 50%,  rgba(110,132,255,.95), transparent 85%),
        radial-gradient(85% 48% at 50% 100%,  rgba(52,235,206,.95), transparent 85%),
        radial-gradient(48% 85% at 0% 50%,    rgba(255,104,164,.95), transparent 85%);
      filter: blur(34px);
      animation: aura-hue1 9s linear infinite, aura-breathe1 5s ease-in-out infinite;
    }
    #ai-aura::after {
      background:
        radial-gradient(64% 64% at 0% 0%,     rgba(110,132,255,1), transparent 82%),
        radial-gradient(66% 66% at 100% 0%,   rgba(52,235,206,1),  transparent 82%),
        radial-gradient(68% 68% at 100% 100%, rgba(255,150,84,1),  transparent 82%),
        radial-gradient(66% 66% at 0% 100%,   rgba(176,84,255,1),  transparent 82%);
      filter: blur(24px);
      opacity: .8;
      animation: aura-hue2 13s linear infinite reverse, aura-breathe2 6.5s ease-in-out infinite;
    }
    @keyframes aura-hue1 { from { filter: blur(34px) hue-rotate(0deg); } to { filter: blur(34px) hue-rotate(360deg); } }
    @keyframes aura-hue2 { from { filter: blur(24px) hue-rotate(0deg); } to { filter: blur(24px) hue-rotate(360deg); } }
    @keyframes aura-breathe1 { 0%, 100% { transform: scale(1.02); } 50% { transform: scale(1.09); } }
    @keyframes aura-breathe2 { 0%, 100% { transform: scale(1.07); } 50% { transform: scale(1.0); } }
  `);

  let auraEl = null;
  let hideT = null;

  function ensure() {
    if (!auraEl) {
      auraEl = document.createElement('div');
      auraEl.id = 'ai-aura';
      document.body.appendChild(auraEl);
    }
    return auraEl;
  }

  function show() {
    clearTimeout(hideT);
    // reflow, чтобы transition сработал при повторном show
    const n = ensure();
    void n.offsetWidth;
    n.classList.add('on');
  }
  function hide() {
    clearTimeout(hideT);
    if (auraEl) auraEl.classList.remove('on');
  }
  function pulse(ms) {
    show();
    clearTimeout(hideT);
    hideT = setTimeout(hide, ms || 2200);
  }

  OS.aura = { show, hide, pulse };
})();
