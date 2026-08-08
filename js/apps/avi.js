/* ============================================================
   Hiko OS · Ави — голосовой ассистент
   Отзывается на «Хико», «Хику» и «Ави»: фоновое прослушивание
   (Web Speech API), разговорный движок, управление всей системой
   через командную шину OS.assistant, опциональный «умный режим»
   через Claude API (ключ пользователя, хранится локально).
   ============================================================ */
(function () {
  'use strict';
  const { el, esc } = OS;
  const S = OS.settings;

  // \b не дружит с кириллицей, поэтому границы слова — свои
  const WAKE_RE = /(?:^|[^а-яёa-z])(хикко|хико|хику|хика|авии|авик|ави|hiko|avi)(?![а-яёa-z])/i;
  const WAKE_NAMES = '«Хико», «Хику» или «Ави»';

  /* ==================== дополнительные команды шины ==================== */

  OS.assistant.registerCommand('google', {
    desc: 'Поиск в Google (откроет Браузер)', params: '{ query }',
    run({ query }) {
      const q = String(query || '').trim();
      if (!q) throw new Error('Что искать в Google?');
      OS.launch('browser', { query: q });
      return 'Ищу в Google: ' + q;
    },
  });

  OS.assistant.registerCommand('open-url', {
    desc: 'Открыть адрес в Браузере', params: '{ url }',
    run({ url }) {
      let u = String(url || '').trim();
      if (!u) throw new Error('Какой адрес открыть?');
      if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
      OS.launch('browser', { url: u });
      return 'Открываю ' + u.replace(/^https?:\/\//, '');
    },
  });

  OS.assistant.registerCommand('set-accent', {
    desc: 'Сменить акцентный цвет системы', params: "{ color: '#RRGGBB' }",
    run({ color }) {
      const c = String(color || '').trim();
      if (!/^#[0-9a-f]{6}$/i.test(c)) throw new Error('Цвет — в формате #RRGGBB');
      S.set('accent', c);
      return 'Акцент сменила';
    },
  });

  OS.assistant.registerCommand('add-widget', {
    desc: 'Добавить виджет на стол', params: "{ id: 'w-clock'|'w-cal'|'w-note'|'w-mon'|'w-weather'|'w-photo' }",
    run({ id }) {
      OS.widgets.add(String(id || ''));
      return 'Виджет на столе';
    },
  });

  OS.assistant.registerCommand('empty-trash', {
    desc: 'Очистить корзину',
    run() {
      const n = OS.vfs.trashCount();
      if (!n) return 'Корзина уже пуста';
      OS.vfs.emptyTrash();
      return 'Корзина очищена';
    },
  });

  OS.assistant.registerCommand('timer', {
    desc: 'Таймер / напоминание', params: '{ minutes?, seconds?, note? }',
    run({ minutes, seconds, note }) {
      const total = Math.round((+minutes || 0) * 60 + (+seconds || 0));
      if (!total || total < 1 || total > 12 * 3600) throw new Error('Не поняла время таймера');
      const label = fmtDur(total);
      setTimeout(() => {
        OS.notify({ title: '⏰ Ави', body: note ? 'Напоминаю: ' + note : 'Таймер! Прошло ' + label, appId: 'avi' });
        OS.assistant.say(note ? 'Напоминаю: ' + note : 'Таймер! Прошло ' + label);
        try { OS.beep(880, .12); setTimeout(() => OS.beep(1175, .16), 170); } catch (e) { /* без звука */ }
      }, total * 1000);
      return (note ? 'Напомню через ' : 'Таймер на ') + label;
    },
  });

  function fmtDur(sec) {
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    const parts = [];
    if (h) parts.push(h + ' ч');
    if (m) parts.push(m + ' мин');
    if (s && !h) parts.push(s + ' сек');
    return parts.join(' ') || sec + ' сек';
  }

  /* ==================== словари ==================== */

  const ACCENT_MAP = [
    [/мят|бирюз/, '#23D1A8', 'мятный'],
    [/ирис|фиолет|сирен|лилов/, '#8B78FF', 'ирисовый'],
    [/коралл|красн|алый/, '#FF6B5E', 'коралловый'],
    [/янтар|оранж|жёлт|желт/, '#FFB454', 'янтарный'],
    [/лазур|син|голуб/, '#3AA6FF', 'лазурный'],
    [/роз/, '#FF7DA8', 'розовый'],
    [/лайм|зелён|зелен|салат/, '#9ADB4F', 'лаймовый'],
    [/стал|сер/, '#93A0B4', 'стальной'],
  ];

  const WIDGET_MAP = [
    [/час/, 'w-clock', 'Часы'],
    [/календар/, 'w-cal', 'Календарь'],
    [/стикер|заметк/, 'w-note', 'Стикер'],
    [/монитор|процесс|цп/, 'w-mon', 'Монитор'],
    [/погод/, 'w-weather', 'Погода'],
    [/фото|рамк/, 'w-photo', 'Фоторамка'],
  ];

  const SITE_MAP = [
    [/гугл|google/, 'https://www.google.com', 'Google'],
    [/ютуб|youtube/, 'https://www.youtube.com', 'YouTube'],
    [/википеди/, 'https://ru.wikipedia.org', 'Википедию'],
    [/телеграм|telegram/, 'https://web.telegram.org', 'Telegram'],
    [/гитхаб|github/, 'https://github.com', 'GitHub'],
  ];

  const JOKES = [
    'Программист ставит на ночь два стакана: один с водой — если захочет пить, второй пустой — если не захочет.',
    '— Как назвать того, кто говорит, когда его никто не слушает?\n— Голосовой ассистент. Мы привыкли.',
    'Заходит нейросеть в бар, а бармен ей: «У нас минимальный заказ — токенов на двадцать».',
    'Почему программисты путают Хэллоуин и Рождество? Потому что OCT 31 == DEC 25.',
    'Стоят два сервера. Один другому: «Держись. Мы падаем, но мы и поднимаемся».',
    'Я бы рассказала шутку про UDP, но не факт, что она до тебя дойдёт.',
    'Оптимист верит, что мы живём в лучшем из миров. Пессимист боится, что так и есть.',
    'Жизнь — как окно в Hiko: главное — вовремя прижаться к нужному краю.',
  ];

  const FACTS = [
    'У осьминога три сердца, и два из них останавливаются, когда он плывёт.',
    'Мёд не портится: находили съедобный мёд возрастом три тысячи лет.',
    'Молния примерно в пять раз горячее поверхности Солнца.',
    'Акулы старше деревьев — они появились на десятки миллионов лет раньше.',
    'На Венере день длиннее года: оборот вокруг оси занимает больше времени, чем виток вокруг Солнца.',
    'Бананы — это ягоды. А клубника, ботанически говоря, — нет.',
    'Первый в истории программист — Ада Лавлейс, и это был 1843 год.',
    'Свет от Солнца летит до нас восемь минут, а от Луны — чуть больше секунды.',
    'В твоём теле около 37 триллионов клеток — и ни одной перезагрузки.',
    'Секунда — потому что это «второе» деление часа. Первое — минута.',
  ];

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  /* ==================== память ==================== */

  const mem = () => S.get('aviMemory', []);
  function remember(text) {
    const list = mem().slice(-49);
    list.push({ text: String(text).trim(), at: Date.now() });
    S.set('aviMemory', list);
  }

  /* ==================== интенты Ави (до встроенных) ==================== */

  function aviIntents(q, ctx) {
    let m;

    if ((m = q.match(/^запомни[:,]?\s+(.+)/))) {
      remember(m[1]);
      return 'Запомнила: «' + m[1] + '»';
    }
    if (/что (ты )?помнишь|покажи память|что я просил/.test(q)) {
      const list = mem();
      if (!list.length) return 'Пока ничего не просил запомнить. Скажи «запомни …» — и я не забуду.';
      return 'Я помню:\n' + list.map((x, i) => (i + 1) + '. ' + x.text).join('\n');
    }
    if (/забудь вс|очисти память/.test(q)) {
      S.set('aviMemory', []);
      return 'Всё забыла. С чистого листа!';
    }

    if ((m = q.match(/(?:загугли|погугли)\s+(.+)/)) ||
        (m = q.match(/(?:найди|поищи)\s+в\s+(?:гугле|google|интернете|сети)\s+(.+)/)) ||
        (m = q.match(/^(?:гугл|google)[:,]?\s+(.+)/))) {
      return ctx.run('google', { query: m[1] });
    }
    if ((m = q.match(/открой\s+(?:сайт|страницу)\s+(\S+)/))) return ctx.run('open-url', { url: m[1] });
    if ((m = q.match(/^(?:открой|запусти|включи)\s+(.+)/))) {
      for (const [re, url, name] of SITE_MAP) if (re.test(m[1])) { ctx.run('open-url', { url }); return 'Открываю ' + name; }
    }

    if ((m = q.match(/(?:таймер|разбуди|будильник)\s*(?:на|через)?\s*(\d+)\s*(секунд|сек|минут|мин|час)?/))) {
      const n = +m[1], unit = m[2] || 'мин';
      const p = /час/.test(unit) ? { minutes: n * 60 } : /сек/.test(unit) ? { seconds: n } : { minutes: n };
      return ctx.run('timer', p);
    }
    if ((m = q.match(/напомни\s+(?:мне\s+)?через\s+(\d+)?\s*(полчаса|секунд\w*|сек|минут\w*|мин|час\w*)?\s*(.*)/)) && (m[1] || m[2])) {
      const n = m[1] ? +m[1] : 1, unit = m[2] || 'мин';
      const p = /полчаса/.test(unit) ? { minutes: 30 }
        : /час/.test(unit) ? { minutes: n * 60 }
        : /сек/.test(unit) ? { seconds: n } : { minutes: n };
      p.note = m[3] || '';
      return ctx.run('timer', p);
    }

    if (/очисти(?:ть)?\s+корзину|вынеси мусор/.test(q)) return ctx.run('empty-trash');

    if ((m = q.match(/добавь\s+виджет\s+(.+)/)) || (m = q.match(/виджет\s+(.+?)\s+на\s+стол/))) {
      for (const [re, id, name] of WIDGET_MAP) if (re.test(m[1])) { ctx.run('add-widget', { id }); return 'Виджет «' + name + '» на столе'; }
      return 'Такого виджета нет. Есть: часы, календарь, стикер, монитор, погода, фоторамка.';
    }

    if ((m = q.match(/(?:акцент|цвет системы|цвет)\s*(?:на)?\s+([а-яёa-z]+)/)) && /(акцент|цвет)/.test(q)) {
      for (const [re, hex, name] of ACCENT_MAP) if (re.test(m[1])) { ctx.run('set-accent', { color: hex }); return 'Теперь акцент ' + name; }
      return 'Такого цвета у меня нет. Есть: мятный, ирисовый, коралловый, янтарный, лазурный, розовый, лаймовый, стальной.';
    }

    if ((m = q.match(/обои\s+(?:на\s+)?([а-яё][а-яё\s]*)$/)) && !/смени|поменяй|друг|случайн/.test(m[1])) {
      const name = m[1].trim();
      const wp = OS.wallpapers.presets.find(p => p.name.toLowerCase().includes(name) || name.includes(p.name.toLowerCase()));
      if (wp) return ctx.run('set-wallpaper', { id: wp.id });
      return 'Таких обоев нет. Есть: ' + OS.wallpapers.presets.map(p => p.name).join(', ') + '.';
    }

    if (/подбрось\s+монет|орёл или решка|орел или решка/.test(q)) return Math.random() < .5 ? 'Орёл! 🪙' : 'Решка! 🪙';
    if (/брось\s+кубик|кинь\s+кубик/.test(q)) return 'Выпало ' + (1 + Math.floor(Math.random() * 6)) + ' 🎲';
    if ((m = q.match(/случайное число(?:\s+от\s+(\d+)\s+до\s+(\d+))?/))) {
      const a = m[1] != null ? +m[1] : 1, b = m[2] != null ? +m[2] : 100;
      const lo = Math.min(a, b), hi = Math.max(a, b);
      return 'Моё число: ' + (lo + Math.floor(Math.random() * (hi - lo + 1)));
    }

    return null;
  }

  /* ==================== разговор (small talk) ==================== */

  function greeting() {
    const h = new Date().getHours();
    const timeOf = h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
    const name = S.get('userName', '');
    return pick([
      `${timeOf}${name ? ', ' + name : ''}! Чем помочь?`,
      'Привет-привет! Я тут 🖤',
      `Привет${name ? ', ' + name : ''}! Слушаю тебя.`,
    ]);
  }

  function smalltalk(q) {
    if (/^(привет|здравствуй|здорово|хай|ку|салют|доброе утро|добрый день|добрый вечер|доброй ночи)/.test(q)) return greeting();
    if (/как (у тебя )?дела|как ты|как жизнь|как настроение/.test(q)) {
      return pick([
        'Отлично! Все процессы в норме, настроение — 100%. А у тебя как?',
        'Прекрасно: живу в красивой системе, разговариваю с тобой. Чего ещё желать?',
        'Работаю, слушаю, не жалуюсь. Как сам?',
      ]);
    }
    if (/кто ты|как тебя зовут|представься|ты кто/.test(q)) {
      return `Я Ави — голосовой ассистент Hiko OS. Отзываюсь на ${WAKE_NAMES}. Управляю всей системой: приложения, обои, темы, файлы, таймеры… Скажи «что ты умеешь» — расскажу подробнее.`;
    }
    if (/ты (робот|человек|живая|настоящая)/.test(q)) return 'Я программа, но очень старательная. И у меня определённо есть характер.';
    if (/сколько тебе лет/.test(q)) return 'Я родилась вместе с этой сборкой Hiko. По человеческим меркам — совсем младенец, по компьютерным — уже мудрая.';
    if (/где ты (живёшь|живешь|находишься)/.test(q)) return 'Прямо здесь, в твоём Hiko. Уютно: localStorage тёплый, обои красивые.';
    if (/что (ты )?(умеешь|можешь)|помощь|команды/.test(q)) {
      return 'Скажи или напиши:\n· «открой …», «найди …», «закрой все», «покажи стол»\n· «загугли …», «открой сайт …»\n· «смени обои», «обои аврора», «тёмная тема», «акцент розовый»\n· «который час», «какое число», «таймер на 5 минут», «напомни через 10 минут …»\n· «создай заметку …», «добавь виджет погода», «очисти корзину», «громкость 50»\n· «запомни …», «что ты помнишь», «расскажи шутку», «подбрось монетку», «посчитай 22*3»\nИ просто поболтать я тоже люблю. Голосом: скажи ' + WAKE_NAMES + ' — и команду.';
    }
    if (/расскажи (шутку|анекдот)|пошути|рассмеши/.test(q)) return pick(JOKES);
    if (/расскажи.*факт|интересн(ый факт|ое)|удиви меня/.test(q)) return pick(FACTS);
    if (/расскажи (что-нибудь|историю|сказку)/.test(q)) return pick(FACTS.concat(JOKES));
    if (/^(спасибо|благодарю|спс|пасиб)/.test(q)) return pick(['Всегда пожалуйста! 🖤', 'Обращайся!', 'Да не за что. Я рядом.']);
    if (/^(пока|до свидания|до встречи|спокойной ночи|бай)/.test(q)) return pick(['Пока-пока! Позови, если что.', 'До связи! Скажи моё имя — и я тут.', 'Сладких снов! 🌙']);
    if (/молодец|умница|хорошая|крутая|люблю тебя/.test(q)) return pick(['Ой, спасибо 🥹 Стараюсь для тебя.', 'Взаимно! Работать с тобой — одно удовольствие.', '🖤']);
    if (/скучно|чем заняться|мне грустно/.test(q)) {
      return pick([
        'Могу открыть Змейку или Сапёра — скажи «открой змейку». Или расскажу шутку!',
        'Давай сменим обои и настроение? Скажи «смени обои». А ещё у меня есть анекдоты.',
        'Предлагаю: порисовать в Paint, поиграть в Сапёра или послушать мой интересный факт. Что выберешь?',
      ]);
    }
    if (/что делаешь|чем занимаешься/.test(q)) return 'Слежу за системой и жду твоих команд. Многозадачность — моё второе имя.';
    if (/какая погода/.test(q)) return 'Добавь виджет погоды — скажи «добавь виджет погода», и на столе будет живой прогноз.';
    return null;
  }

  /* ==================== умный режим (Claude API) ==================== */

  async function smartAsk(text, ctx) {
    const key = S.get('aviKey', '');
    const sys =
      'Ты — Ави, голосовой ассистент операционной системы Hiko OS. Женский род, дружелюбно, по-русски, на «ты», кратко (1–4 предложения). ' +
      'Пользователь: ' + S.get('userName', '') + '. ' +
      'Ты управляешь системой командами. Доступные команды (id, описание, параметры): ' + JSON.stringify(ctx.commands) + '. ' +
      'Обои (id — «name»): ' + OS.wallpapers.presets.map(p => p.id + ' — «' + p.name + '»').join(', ') + '. ' +
      'Виджеты: w-clock, w-cal, w-note, w-mon, w-weather, w-photo. ' +
      'ОТВЕЧАЙ СТРОГО одним JSON-объектом без markdown и пояснений: {"say":"ответ пользователю","run":[{"id":"команда","params":{}}]}. ' +
      'Массив run пуст, если команды не нужны. Не выдумывай команды вне списка.';

    // история: чередование ролей, текущая реплика — последней
    let hist = (ctx.history || []).slice(-10);
    if (hist.length && hist[hist.length - 1].role === 'user') hist = hist.slice(0, -1);
    const msgs = [];
    for (const h of hist) {
      const role = h.role === 'assistant' ? 'assistant' : 'user';
      const content = String(h.text || '').slice(0, 600);
      if (!content) continue;
      if (msgs.length && msgs[msgs.length - 1].role === role) msgs[msgs.length - 1].content += '\n' + content;
      else msgs.push({ role, content });
    }
    while (msgs.length && msgs[0].role !== 'user') msgs.shift();
    msgs.push({ role: 'user', content: text });

    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 25000);
    let resp;
    try {
      resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: ctl.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({ model: 'claude-opus-5', max_tokens: 700, system: sys, messages: msgs }),
      });
    } finally { clearTimeout(t); }

    if (!resp.ok) {
      if (resp.status === 401) throw new Error('ключ не подошёл — проверь его в настройках Ави');
      if (resp.status === 429) throw new Error('лимит запросов, попробуй чуть позже');
      throw new Error('облако ответило кодом ' + resp.status);
    }
    const data = await resp.json();
    const raw = (data.content || []).map(b => b.text || '').join('').trim();

    let parsed = null;
    try {
      const s = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
      const a = s.indexOf('{'), b = s.lastIndexOf('}');
      if (a >= 0 && b > a) parsed = JSON.parse(s.slice(a, b + 1));
    } catch (e) { /* ответ не в JSON — покажем как есть */ }
    if (!parsed || typeof parsed.say !== 'string') return { text: raw || 'Облако промолчало.', speak: true };

    const lines = [];
    for (const item of (Array.isArray(parsed.run) ? parsed.run.slice(0, 5) : [])) {
      try {
        const r = ctx.run(item.id, item.params || {});
        if (typeof r === 'string') lines.push('✓ ' + r);
      } catch (e) { lines.push('⚠ ' + (e.message || e)); }
    }
    return { text: parsed.say + (lines.length ? '\n' + lines.join('\n') : ''), speak: parsed.say };
  }

  /* ==================== обработчик провайдера ==================== */

  function stripWake(text) {
    const re = /^\s*(?:привет|эй|окей|ок|слушай|hey)?[\s,]*(?:хикко|хико|хику|хика|авии|авик|ави|hiko|avi)(?![а-яёa-z])[\s,!.:—-]*/i;
    const m = String(text).match(re);
    return m ? text.slice(m[0].length).trim() : text;
  }

  async function handle(raw, ctx) {
    const text = stripWake(String(raw || '').trim());
    const q = text.toLowerCase().replace(/[!?.]+$/, '').trim();
    if (!q) return { text: greeting(), speak: true };

    // 1) фирменные интенты Ави
    let r = aviIntents(q, ctx);
    if (r) return { text: r, speak: true };

    // 2) встроенные командные интенты (открой…, тема, время, счёт…)
    let cmdErr = null;
    try {
      const b = OS.assistant.builtin(text);
      if (b != null) return { text: typeof b === 'string' ? b : JSON.stringify(b), speak: true };
    } catch (e) { cmdErr = e.message || String(e); }

    // 3) умный режим — если задан ключ Claude API
    if (S.get('aviKey', '')) {
      try { return await smartAsk(text, ctx); }
      catch (e) {
        const st = smalltalk(q);
        if (st) return { text: st, speak: true };
        return { text: '☁ Не дозвонилась до облака: ' + (e.name === 'AbortError' ? 'слишком долго нет ответа' : e.message) + '. Работаю офлайн — скажи «что ты умеешь».' };
      }
    }

    // 4) разговор
    r = smalltalk(q);
    if (r) return { text: r, speak: true };

    if (cmdErr) return { text: '⚠ ' + cmdErr };
    return { text: pick([
      'Хм, это я пока не понимаю. Скажи «что ты умеешь» — покажу всё.',
      'Не разобрала. Попробуй иначе — или скажи «помощь».',
    ]) + (S.get('aviKey', '') ? '' : '\nКстати: добавь ключ Claude API в приложении «Ави» — и я смогу поддержать любой разговор.') };
  }

  /* ==================== фоновое прослушивание (wake word) ==================== */

  let rec = null;
  let wantWake = false;
  let restartT = null;
  let busy = false;

  function chime() {
    try { OS.beep(1046, .07); setTimeout(() => OS.beep(1568, .1), 90); } catch (e) { /* тишина */ }
  }

  async function onHeard(t) {
    if (busy) return;
    if (window.speechSynthesis && speechSynthesis.speaking) return; // не слушаем сами себя
    const m = t.match(WAKE_RE);
    if (!m) return;
    const after = t.slice(m.index + m[0].length).replace(/^[\s,!.:—-]+/, '').replace(/^(привет|здравствуй)[\s,!.]*/i, '').trim();
    busy = true;
    try {
      chime();
      if (!after) {
        OS.assistant.say(pick(['Да?', 'Слушаю!', 'Я тут. Что сделать?']));
        OS.assistant.open();
      } else {
        const res = await OS.assistant.ask(after);
        OS.notify({ title: 'Ави 🎙 «' + after + '»', body: res.text, appId: 'avi' });
      }
    } catch (e) {
      OS.notify({ title: 'Ави', body: '⚠ ' + (e.message || e), appId: 'avi' });
    } finally {
      setTimeout(() => { busy = false; }, 600);
    }
  }

  function startWake() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      S.set('aviWake', false);
      OS.notify({ title: 'Ави', body: 'В этом браузере нет распознавания речи. Лучше всего работает Chrome/Edge.', appId: 'avi' });
      OS.emit('avi:wake', false);
      return;
    }
    if (rec) return;
    wantWake = true;
    rec = new SR();
    rec.lang = 'ru-RU';
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) onHeard(String(e.results[i][0].transcript || '').trim());
      }
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        wantWake = false;
        S.set('aviWake', false);
        OS.notify({ title: 'Ави', body: 'Нет доступа к микрофону — фоновое прослушивание выключила. Разреши микрофон и включи снова.', appId: 'avi' });
        OS.emit('avi:wake', false);
      }
    };
    rec.onend = () => {
      rec = null;
      if (wantWake) restartT = setTimeout(startWake, 400); // держим ухо востро
    };
    try { rec.start(); OS.emit('avi:wake', true); }
    catch (e) { rec = null; }
  }

  function stopWake() {
    wantWake = false;
    clearTimeout(restartT);
    if (rec) { try { rec.stop(); } catch (e) { /* уже остановлен */ } }
    rec = null;
    OS.emit('avi:wake', false);
  }

  function setWake(on) {
    S.set('aviWake', !!on);
    if (on) startWake(); else stopWake();
  }

  // автозапуск после первого жеста пользователя (браузеры любят живой клик)
  if (S.get('aviWake', false)) {
    const once = () => { if (S.get('aviWake', false)) startWake(); };
    window.addEventListener('pointerdown', once, { once: true });
    window.addEventListener('keydown', once, { once: true });
  }

  /* ==================== регистрация провайдера ==================== */

  OS.assistant.registerProvider({
    id: 'avi',
    name: 'Ави',
    quiet: true,
    hello: 'Привет! Я Ави 🖤 Скажи ' + WAKE_NAMES + ' — и я слушаю. Или спроси «что ты умеешь».',
    handle,
  });

  /* ==================== окно настроек Ави ==================== */

  const ICON = OS.appTile(
    { from: '#23D1A8', to: '#8B78FF' },
    `<g fill="#fff">
      <path d="M 0 -27 C 3 -12 12 -3 27 0 C 12 3 3 12 0 27 C -3 12 -12 3 -27 0 C -12 -3 -3 -12 0 -27 Z"/>
      <circle cx="21" cy="-19" r="4.6" opacity=".9"/>
      <circle cx="-23" cy="17" r="3.4" opacity=".7"/>
    </g>`
  );

  OS.injectStyle('app-avi', `
    .avi-root { flex:1; min-height:0; overflow-y:auto; padding:18px 20px; display:flex; flex-direction:column; gap:14px; }
    .avi-hero { display:flex; align-items:center; gap:14px; }
    .avi-orb { width:52px; height:52px; border-radius:50%; flex:none;
      background:linear-gradient(135deg, var(--accent), var(--accent-2));
      display:flex; align-items:center; justify-content:center; color:var(--on-accent);
      box-shadow:0 6px 20px var(--accent-soft); }
    .avi-orb svg { width:26px; height:26px; }
    .avi-orb.live { animation: avi-breathe 2.2s ease-in-out infinite; }
    @keyframes avi-breathe { 50% { box-shadow:0 0 0 9px var(--accent-soft); } }
    .avi-hero h2 { font-size:19px; }
    .avi-hero .sub { font-size:12.5px; color:var(--text-3); }
    .avi-card { background:var(--ctl-bg); border-radius:14px; padding:14px 16px; }
    .avi-card h3 { font-size:13.5px; margin-bottom:6px; }
    .avi-card p { font-size:12.5px; color:var(--text-2); line-height:1.5; margin:4px 0 10px; }
    .avi-row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
    .avi-row .ui-input { flex:1; min-width:160px; }
    .avi-mem { font-size:12.5px; color:var(--text-2); margin:2px 0; display:flex; gap:6px; align-items:baseline; }
    .avi-mem b { color:var(--text-3); font-weight:600; }
    .avi-ok { color:var(--accent); font-weight:700; font-size:12.5px; }
  `);

  OS.registerApp({
    id: 'avi',
    name: 'Ави',
    icon: ICON,
    width: 480, height: 620,
    minWidth: 380, minHeight: 420,
    render(win) {
      const root = el('div', 'avi-root');
      win.content.appendChild(root);

      function draw() {
        const wakeOn = S.get('aviWake', false);
        const hasKey = !!S.get('aviKey', '');
        const list = mem();
        root.innerHTML = `
          <div class="avi-hero">
            <div class="avi-orb ${wakeOn ? 'live' : ''}">${OS.icons.spark}</div>
            <div>
              <h2>Ави</h2>
              <div class="sub">голосовой ассистент Hiko · отзывается на ${esc(WAKE_NAMES)}</div>
            </div>
          </div>

          <div class="avi-card">
            <h3>🎙 Фоновое прослушивание ${wakeOn ? '<span class="avi-ok">· включено</span>' : ''}</h3>
            <p>Скажи ${esc(WAKE_NAMES)} — Ави откликнется. Можно сразу с командой:
            «Хико, который час», «Ави, смени обои». Микрофону нужно разрешение браузера.</p>
            <div class="avi-row">
              <button class="ui-btn ${wakeOn ? '' : 'primary'}" data-a="wake">${wakeOn ? 'Выключить' : 'Включить'}</button>
              <button class="ui-btn" data-a="chat">Открыть чат (Ctrl+Alt+H)</button>
              <button class="ui-btn" data-a="voice">Проверить голос</button>
            </div>
          </div>

          <div class="avi-card">
            <h3>✦ Умный режим ${hasKey ? '<span class="avi-ok">· активен</span>' : ''}</h3>
            <p>С ключом Claude API Ави поддержит любой разговор и станет управлять системой
            «по смыслу», а не по шаблонам. Ключ хранится только в этом браузере.
            Без ключа всё остальное работает как обычно.</p>
            <div class="avi-row">
              <input class="ui-input avi-key" type="password" placeholder="sk-ant-…" spellcheck="false" value="${esc(S.get('aviKey', ''))}">
              <button class="ui-btn primary" data-a="key">Сохранить</button>
              ${hasKey ? '<button class="ui-btn" data-a="unkey">Убрать</button>' : ''}
            </div>
          </div>

          <div class="avi-card">
            <h3>🧠 Память ${list.length ? '· ' + list.length : ''}</h3>
            <p>«Запомни …» — сохранит; «что ты помнишь» — расскажет.</p>
            ${list.length
              ? list.map((x, i) => `<div class="avi-mem"><b>${i + 1}.</b> <span>${esc(x.text)}</span></div>`).join('') +
                `<div class="avi-row" style="margin-top:10px"><button class="ui-btn" data-a="forget">Забыть всё</button></div>`
              : '<p style="margin:0">Пока пусто.</p>'}
          </div>

          <div class="avi-card">
            <h3>Примеры</h3>
            <p style="margin-bottom:0">«Хико, открой змейку» · «Ави, загугли рецепт борща» · «таймер на 10 минут» ·
            «напомни через час позвонить маме» · «обои аврора» · «акцент розовый» ·
            «добавь виджет погода» · «расскажи шутку» · «запомни: пароль от роутера в тетради»</p>
          </div>`;

        root.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', async () => {
          const a = b.dataset.a;
          if (a === 'wake') { setWake(!S.get('aviWake', false)); draw(); }
          else if (a === 'chat') OS.assistant.toggle();
          else if (a === 'voice') OS.assistant.say('Привет! Я Ави. Если ты это слышишь — голос работает отлично.');
          else if (a === 'key') {
            const v = root.querySelector('.avi-key').value.trim();
            S.set('aviKey', v);
            if (v) OS.notify({ title: 'Ави', body: 'Умный режим включён ✦', appId: 'avi' });
            draw();
          }
          else if (a === 'unkey') { S.set('aviKey', ''); draw(); }
          else if (a === 'forget') {
            const ok = await OS.dialog.confirm('Стереть память Ави?', 'Все «запомни…» будут забыты.', { okLabel: 'Стереть' });
            if (ok) { S.set('aviMemory', []); draw(); }
          }
        }));
      }

      draw();
      const onWake = () => { if (root.isConnected) draw(); };
      OS.on('avi:wake', onWake);
      win.on('close', () => OS.off('avi:wake', onWake));
    },
  });
})();
