/* ============================================================
   Hiko OS · net — шина «Обход блокировок» (VPN-модули)
   Точка подключения внешнего модуля обхода: скачиваешь .js с
   GitHub, ставишь Установщиком — он вызывает OS.net.registerProvider,
   и система сама выносит переключатель в Центр управления.
   Честно: браузерная ОС не поднимает системный VPN — модуль
   маршрутизирует встроенный Браузер Hiko (и приложения, которые
   зовут OS.net.proxify) через свой прокси. Контракт — docs/NETWORK_API.md.
   ============================================================ */
(function () {
  'use strict';
  const S = OS.settings;

  let providers = []; // { id, name, region?, note?, proxify?, enable?, disable?, test? }

  const byId = (id) => providers.find(p => p.id === id) || null;

  function active() {
    return byId(S.get('vpnProvider', '')) || providers[0] || null;
  }

  function list() {
    return providers.map(p => ({ id: p.id, name: p.name || p.id, region: p.region || '', note: p.note || '' }));
  }

  function registerProvider(p) {
    if (!p || !p.id) { console.error('[net] модулю обхода нужен id'); return false; }
    providers = providers.filter(x => x.id !== p.id);
    providers.push(p);
    if (!S.get('vpnProvider', '')) S.set('vpnProvider', p.id);
    OS.emit('net:providers', list());
    OS.notify({
      title: 'Обход блокировок',
      body: `Модуль «${p.name || p.id}»${p.region ? ' · ' + p.region : ''} готов. Включи его в Центре управления.`,
      appId: 'net',
    });
    return true;
  }

  function isOn() { return !!S.get('vpnOn', false) && !!active(); }

  async function setOn(on) {
    on = !!on;
    const p = active();
    if (on && !p) {
      OS.notify({ title: 'Обход блокировок', body: 'Нет модуля обхода. Установи его в Центре управления или через Установщик.', appId: 'net' });
      S.set('vpnOn', false);
      OS.emit('net:state', { on: false, provider: null });
      return false;
    }
    try {
      if (on && p && p.enable) await p.enable();
      if (!on && p && p.disable) await p.disable();
    } catch (e) {
      OS.notify({ title: 'Обход блокировок', body: 'Модуль сообщил об ошибке: ' + (e.message || e), appId: 'net' });
    }
    S.set('vpnOn', on);
    OS.emit('net:state', { on, provider: p ? { id: p.id, name: p.name } : null });
    if (on) {
      OS.notify({
        title: 'Обход включён 🌐',
        body: `Через «${p.name || p.id}»${p.region ? ' · ' + p.region : ''}. Иностранные сайты теперь открываются в Браузере Hiko.`,
        appId: 'net',
      });
    }
    return on;
  }

  function toggle() { return setOn(!isOn()); }

  function setProvider(id) {
    if (byId(id)) { S.set('vpnProvider', id); OS.emit('net:providers', list()); }
  }

  // приложения зовут это перед сетевым запросом; при выключенном обходе — no-op
  function proxify(url) {
    if (!isOn()) return url;
    const p = active();
    try { return (p && p.proxify) ? p.proxify(String(url)) : url; } catch (e) { return url; }
  }

  /* --- встроенный демо-модуль: показывает контракт и делает маршрутизацию реальной --- */
  const DEMO_CODE = [
    "(function () {",
    "  'use strict';",
    "  OS.net.registerProvider({",
    "    id: 'demo-bypass',",
    "    name: 'Обход (демо)',",
    "    region: 'Auto',",
    "    note: 'Пример модуля: маршрутизирует Браузер Hiko через веб-прокси. Адрес прокси меняется в Настройках.',",
    "    proxify: function (url) {",
    "      var base = OS.settings.get('vpnProxyBase', 'https://corsproxy.io/?url=');",
    "      return base + encodeURIComponent(url);",
    "    },",
    "    enable: function () { /* демо: только маршрутизация Браузера, без системного VPN */ },",
    "    disable: function () {}",
    "  });",
    "})();",
  ].join('\n');

  OS.net = {
    registerProvider,
    providers: list,
    active: () => (active() ? active().id : null),
    isOn, setOn, toggle, setProvider, proxify,
    DEMO_CODE,
  };
})();
