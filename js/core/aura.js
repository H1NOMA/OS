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
      transition: opacity .45s var(--ease-out);
      will-change: opacity, filter, transform;
    }
    #ai-aura.on { opacity: .92; animation: aura-hue 6s linear infinite, aura-breathe 3s ease-in-out infinite; }
    /* приём «градиентная рамка через маску»: показываем только полосу у краёв */
    #ai-aura::before, #ai-aura::after {
      content: "";
      position: absolute; inset: 0;
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      mask-composite: exclude;
    }
    #ai-aura::before {
      padding: 66px;
      background: conic-gradient(from 0deg,
        #ff5f6d, #ffc371, #43e97b, #38f9d7, #4facfe, #b06bff, #ff5f6d);
      filter: blur(34px);
    }
    #ai-aura::after {
      padding: 26px;
      background: conic-gradient(from 140deg,
        #b06bff, #4facfe, #38f9d7, #43e97b, #ffc371, #ff5f6d, #b06bff);
      filter: blur(11px);
      opacity: .82;
    }
    @keyframes aura-hue { to { filter: hue-rotate(360deg); } }
    @keyframes aura-breathe { 50% { transform: scale(1.006); } }
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
