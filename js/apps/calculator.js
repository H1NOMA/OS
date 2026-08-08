/* Hiko OS · Калькулятор */
(function () {
  'use strict';
  const { el } = OS;

  const ICON = OS.appTile(
    { from: '#4A4E5E', to: '#20222C' },
    `<g stroke="#fff" stroke-width="6.5" stroke-linecap="round">
      <path d="M -17 -25 L -17 -9 M -25 -17 L -9 -17"/>
      <path d="M 9 -17 L 25 -17"/>
      <path d="M -24 10 L -10 24 M -10 10 L -24 24"/>
      <path d="M 9 17 L 25 17"/>
    </g>
    <circle cx="17" cy="8" r="3" fill="#fff"/><circle cx="17" cy="26" r="3" fill="#fff"/>`
  );

  OS.injectStyle('app-calculator', `
    .calc-root { flex:1; min-height:0; display:flex; flex-direction:column; background:#171922; outline:none; }
    .calc-display { flex:1; min-height:64px; display:flex; align-items:flex-end; justify-content:flex-end;
      padding: 8px 20px 4px; color:#f2f3fa; font-weight:300; overflow:hidden; white-space:nowrap; user-select:text; }
    .calc-grid { display:grid; grid-template-columns:repeat(4, 1fr); gap:8px; padding:12px; }
    .calc-btn { aspect-ratio:1; border:none; border-radius:16px; font-size:21px; font-family:var(--font);
      color:#f2f3fa; background:#2c2f3d; cursor:default; transition: filter .08s, transform .08s; font-weight:600; }
    .calc-btn:active { filter:brightness(1.35); transform:scale(.95); }
    .calc-btn.fn { background:#454a5c; color:#d9dce8; }
    .calc-btn.op { background:var(--accent); color:var(--on-accent); font-size:25px; }
    .calc-btn.op.hot { background:#f2f3fa; color:#171922; }
    .calc-btn.zero { aspect-ratio:auto; grid-column:span 2; text-align:left; padding-left:26px; }
  `);

  const fmt = (n) => {
    if (!isFinite(n) || isNaN(n)) return 'Ошибка';
    let s = String(+parseFloat(n.toPrecision(12)));
    if (Math.abs(n) >= 1e12 || (Math.abs(n) < 1e-9 && n !== 0)) return n.toExponential(6).replace('.', ',').replace('e', 'e');
    const [int, frac] = s.split('.');
    const gi = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return frac ? gi + ',' + frac : gi;
  };

  OS.registerApp({
    id: 'calculator',
    name: 'Калькулятор',
    icon: ICON,
    width: 300, height: 470,
    minWidth: 260, minHeight: 400,
    singleton: true,
    render(win) {
      // состояние
      let acc = null;        // накопленное
      let op = null;         // текущая операция
      let entry = '0';       // вводимое число (строка, '.' как разделитель)
      let fresh = true;      // следующий ввод начинает новое число
      let lastOp = null, lastOperand = null; // для повтора "="

      const root = el('div', 'calc-root');
      root.tabIndex = 0;
      const display = el('div', 'calc-display', '0');
      const grid = el('div', 'calc-grid');
      root.appendChild(display);
      root.appendChild(grid);
      win.content.appendChild(root);

      const BTNS = [
        { t: 'AC', cls: 'fn', k: 'clear' }, { t: '±', cls: 'fn', k: 'neg' }, { t: '%', cls: 'fn', k: 'pct' }, { t: '÷', cls: 'op', k: '/' },
        { t: '7' }, { t: '8' }, { t: '9' }, { t: '×', cls: 'op', k: '*' },
        { t: '4' }, { t: '5' }, { t: '6' }, { t: '−', cls: 'op', k: '-' },
        { t: '1' }, { t: '2' }, { t: '3' }, { t: '+', cls: 'op', k: '+' },
        { t: '0', cls: 'zero' }, { t: ',', k: 'dot' }, { t: '=', cls: 'op', k: '=' },
      ];
      const opBtns = {};
      BTNS.forEach(b => {
        const btn = el('button', 'calc-btn' + (b.cls ? ' ' + b.cls : ''), b.t);
        const key = b.k || b.t;
        if (['+', '-', '*', '/'].includes(key)) opBtns[key] = btn;
        btn.addEventListener('click', () => { press(key); root.focus(); });
        grid.appendChild(btn);
      });

      function currentValue() { return parseFloat(entry.replace(',', '.')) || 0; }

      function updateDisplay(text) {
        const t = text !== undefined ? text : entry.replace('.', ',');
        display.textContent = t;
        // динамический размер шрифта
        const len = t.length;
        display.style.fontSize = Math.max(26, Math.min(64, Math.floor(64 - Math.max(0, len - 7) * 4.4))) + 'px';
        const acBtn = grid.querySelector('.calc-btn.fn');
        acBtn.textContent = (entry !== '0' || acc !== null) ? 'C' : 'AC';
        Object.entries(opBtns).forEach(([k, b]) => b.classList.toggle('hot', op === k && fresh));
      }

      function apply(a, b, o) {
        switch (o) {
          case '+': return a + b;
          case '-': return a - b;
          case '*': return a * b;
          case '/': return b === 0 ? NaN : a / b;
        }
        return b;
      }

      function press(k) {
        if (/^\d$/.test(k)) {
          if (fresh) { entry = k; fresh = false; }
          else if (entry.replace('-', '').replace('.', '').length < 12) entry = entry === '0' ? k : entry + k;
          updateDisplay();
        } else if (k === 'dot') {
          if (fresh) { entry = '0.'; fresh = false; }
          else if (!entry.includes('.')) entry += '.';
          updateDisplay(entry.replace('.', ','));
        } else if (k === 'clear') {
          if (entry !== '0' && !fresh) { entry = '0'; }
          else { acc = null; op = null; entry = '0'; lastOp = null; lastOperand = null; }
          fresh = true;
          updateDisplay(fmt(currentValue()));
        } else if (k === 'neg') {
          entry = entry.startsWith('-') ? entry.slice(1) : (entry === '0' ? entry : '-' + entry);
          updateDisplay(fmt(currentValue()));
          fresh = false;
        } else if (k === 'pct') {
          const v = currentValue() / 100;
          entry = String(v);
          fresh = true;
          updateDisplay(fmt(v));
        } else if (['+', '-', '*', '/'].includes(k)) {
          if (op && !fresh) {
            const r = apply(acc, currentValue(), op);
            acc = r;
            entry = String(r);
            updateDisplay(fmt(r));
          } else if (acc === null) {
            acc = currentValue();
          }
          op = k;
          fresh = true;
          updateDisplay(fmt(acc));
        } else if (k === '=') {
          let r;
          if (op) {
            const operand = fresh ? acc : currentValue();
            r = apply(acc, operand, op);
            lastOp = op; lastOperand = operand;
          } else if (lastOp !== null) {
            r = apply(currentValue(), lastOperand, lastOp);
          } else {
            r = currentValue();
          }
          acc = null; op = null;
          entry = String(r);
          fresh = true;
          updateDisplay(fmt(r));
        } else if (k === 'back') {
          if (!fresh && entry.length > 1) entry = entry.slice(0, -1);
          else if (!fresh) entry = '0';
          updateDisplay();
        }
      }

      root.addEventListener('keydown', (e) => {
        e.stopPropagation();
        const map = { 'Enter': '=', '=': '=', 'Escape': 'clear', 'Backspace': 'back', ',': 'dot', '.': 'dot', '%': 'pct' };
        if (/^\d$/.test(e.key)) { press(e.key); e.preventDefault(); }
        else if (['+', '-', '*', '/'].includes(e.key)) { press(e.key); e.preventDefault(); }
        else if (map[e.key]) { press(map[e.key]); e.preventDefault(); }
      });
      win.on('focus', () => setTimeout(() => root.focus(), 0));
      setTimeout(() => root.focus(), 50);
      updateDisplay('0');
    },
  });
})();
