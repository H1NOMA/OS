# Hiko OS — API приложений

Приложение — один файл `js/apps/<id>.js`, подключается обычным `<script>` (НЕ модуль, без `import/export`).
Файл оборачивается в IIFE и регистрирует приложение через глобальный `OS`.

```js
(function () {
  'use strict';

  const ICON = OS.appTile(
    { from: '#66D4FF', to: '#0A84FF' },      // градиент фона плитки (сверху вниз)
    `<path d="..." fill="#fff"/>`            // белый глиф, система координат: центр (0,0), холст 100×100
  );

  OS.injectStyle('app-myapp', `
    .myapp-root { display:flex; flex-direction:column; flex:1; min-height:0; }
  `);

  OS.registerApp({
    id: 'myapp',            // латиница, = имени файла
    name: 'Моё приложение', // русское имя
    icon: ICON,
    width: 720, height: 480,        // стартовый размер
    minWidth: 400, minHeight: 300,  // опционально
    singleton: false,               // true → одно окно; повторный запуск фокусирует его
    resizable: true,                // (резерв, окна всегда resizable)
    render(win, ctx) {
      // win.content — HTMLElement, рисуй сюда
      // ctx.args — аргументы запуска (напр. {path: '/Documents/a.txt'})
      win.content.innerHTML = `<div class="myapp-root">…</div>`;
    },
    onReopen(win, args) {},  // опционально: singleton запущен повторно с args
    menus(win) { return [{ title: 'Файл', items: [{ label: 'Новый', hotkey: 'Ctrl+N', action(){} }] }]; }, // опционально: своё меню в menu bar
  });
})();
```

## Объект окна `win`

| Свойство/метод | Описание |
|---|---|
| `win.content` | HTMLElement содержимого (flex column). Рисуй в него. |
| `win.setTitle(str)` / `win.getTitle()` | Заголовок окна |
| `win.close()`, `win.minimize()`, `win.restore()`, `win.focus()` | Управление |
| `win.on('close', cb)` | Окно закрылось |
| `win.on('beforeclose', cb)` | Вернёшь `false` (или Promise<false>) — закрытие отменится (несохранённые изменения!) |
| `win.on('resize', cb)`, `win.on('focus', cb)` | События |
| `win.rect()` / `win.setRect({x,y,w,h})` | Геометрия |
| `win.id`, `win.app`, `win.args` | Метаданные |

## Глобальный `OS`

| API | Описание |
|---|---|
| `OS.launch(appId, args)` | Запустить приложение |
| `OS.openFile(path)` | Открыть файл ассоциированным приложением |
| `OS.notify({title, body, appId})` | Уведомление (тост + центр уведомлений) |
| `OS.dialog.alert(title, msg)` → Promise | Модальный алерт |
| `OS.dialog.confirm(title, msg, {okLabel, danger})` → Promise<bool> | Подтверждение |
| `OS.dialog.prompt(title, msg, initial)` → Promise<string\|null> | Ввод строки |
| `OS.contextMenu(items, x, y)` | Контекстное меню: `[{label, icon, hotkey, disabled, checked, action}, {sep:true}]` |
| `OS.injectStyle(id, css)` | Добавить стили (id уникальный: `app-<id>`) |
| `OS.settings.get(key, def)` / `OS.settings.set(key, val)` | Настройки (persist) |
| `OS.on(evt, cb)` / `OS.off(evt, cb)` / `OS.emit(evt, data)` | Шина событий |
| `OS.el(tag, cls, html)`, `OS.esc(s)`, `OS.clamp(v,a,b)`, `OS.uid(p)`, `OS.debounce(fn,ms)` | Утилиты |
| `OS.fmtBytes(n)`, `OS.fmtDate(ts)` | Форматирование |
| `OS.beep(freq, dur)` | Звук (WebAudio) |
| `OS.appTile(bg, glyph)` | Фирменная шестиугольная плитка приложения |
| `OS.fileIcon(nodeOrStat)` | SVG-иконка файла/папки |
| `OS.icons.*` | Системные глифы: `folder, fileText, fileImage, fileGeneric, trashEmpty, trashFull, search, power, wifi, moon, sun, grid, mission, chevronL, chevronR, warn, logo` |
| `OS.wm.focused`, `OS.wm.all()`, `OS.wm.windowsOf(appId)`, `OS.wm.missionToggle()`, `OS.wm.workArea()` | Оконный менеджер |
| `OS.allApps()`, `OS.getApp(id)` | Реестр приложений |
| `OS.wallpapers.presets` `[{id, name, uri}]`, `OS.wallpapers.apply()` | Обои |
| `OS.getNotifications()`, `OS.clearNotifications()` | Центр уведомлений |
| `OS.VERSION`, `OS.CODENAME` | Версия («1.0», «Nova») |

## Файловая система `OS.vfs`

Пути POSIX: `/Desktop/файл.txt`. Корневые папки: `Desktop, Documents, Downloads, Pictures, Music, Trash`.
Все операции синхронные, бросают `Error` с русским сообщением — оборачивай в try/catch и показывай `OS.dialog.alert`.

| API | Описание |
|---|---|
| `vfs.list(path)` | `[{name, path, type:'dir'\|'file', size, created, modified, meta}]` (папки первыми, сортировка по имени) |
| `vfs.read(path)` / `vfs.write(path, content, meta?)` | Содержимое — строка (для картинок — data:-URI). Лимит 2.5 МБ |
| `vfs.mkdir(path)`, `vfs.exists(path)`, `vfs.stat(path)` | |
| `vfs.rm(path, {toTrash:true})` | С `toTrash` — в корзину (для UI всегда так), без — насовсем |
| `vfs.restore(trashPath)`, `vfs.emptyTrash()`, `vfs.trashCount()` | Корзина |
| `vfs.mv(from, to)`, `vfs.cp(from, to)` | Переместить/копировать |
| `vfs.uniqueName(dir, base)` | «Новая папка 2» |
| `vfs.search(q, max)` | Поиск по имени по всему дереву |
| `vfs.normalize(p)`, `vfs.parentOf(p)`, `vfs.nameOf(p)`, `vfs.join(...)` | Пути |
| Событие `OS.on('vfs:change', ({path, action}) => …)` | Реагируй и перерисовывай списки. Отписывайся в `win.on('close')`! |

## Установка приложений `OS.installer`

Файл в формате выше можно не класть в репозиторий, а установить в работающую систему:
Установщик → «Из файла…» / «По ссылке…», либо в терминале `install <url|путь>`.
Файл сохраняется в `/Apps` и выполняется при каждом старте.

| API | Описание |
|---|---|
| `OS.installer.installCode(code, fileName?, sourceUrl?)` → Promise<bool> | Установка с подтверждением пользователя |
| `OS.installer.installFromUrl(url)` | Скачать и установить (нужен CORS у источника) |

## Виджеты рабочего стола `OS.widgets`

```js
OS.widgets.register({
  id: 'w-my', name: 'Мой виджет', desc: 'Описание в галерее',
  w: 220, h: 160, preview: '🧩',        // эмодзи для карточки галереи
  render(body, ctx) {                    // body — HTMLElement (.wg-body, flex column)
    // ctx.data — сохранённые данные, ctx.save(obj) — сохранить
    return () => {};                     // опционально: dispose при удалении
  },
});
// OS.widgets.add(id), OS.widgets.remove(uid), OS.widgets.openGallery()
```
Интерактивные элементы внутри виджета помечай `data-nodrag` (или используй input/button/select/textarea — они не перетаскивают виджет).

## Ключи настроек (используются Настройками и системой)

`userName` (string), `theme` ('light'|'dark'|'auto'), `accent` (hex), `wallpaper` (id пресета или data:-URI),
`dockSize` (44–72), `dockMagnify` (bool), `nightLight` (bool), `brightness` (0.4–1), `volume` (0–100),
`wifi`, `bluetooth`, `dnd` (bool), `dockPinned` (string[]), `hotCorners` ({tl,tr,bl,br}), `passHash` (строка, пусто = без пароля), `widgets` (служебный — список виджетов).
`OS.settings.set` сам применяет тему/акцент/яркость и шлёт `settings:change`.

## UI-кит (готовые классы из css/system.css — ИСПОЛЬЗУЙ ИХ)

- `.ui-btn`, `.ui-btn.primary`, `.ui-btn.danger`, `.ui-btn.icon-only`, `:disabled`
- `.ui-input`, `.ui-select`, `.ui-slider` (range), `.ui-switch` (+`.on`, div-переключатель)
- `.ui-toolbar` — верхняя панель окна (flex, с нижней границей)
- `.ui-seg` + `.seg-btn` (+`.on`) — сегмент-контрол
- `.ui-sidebar`, `.ui-side-title`, `.ui-side-item` (+`.on`) — сайдбар в стиле macOS
- `.ui-list-row` (+`.on`) — строка списка
- `.ui-empty` — пустое состояние (центрированная заглушка)
- CSS-переменные: `--text, --text-2, --text-3, --accent, --accent-soft, --content-bg, --sidebar-bg,
  --ctl-bg, --ctl-bg-hover, --ctl-border, --hover, --active-row, --divider, --font, --font-mono, --r-ctl`

## Правила

1. Тёмная и светлая темы обязаны выглядеть отлично — используй ТОЛЬКО переменные, никаких хардкод-цветов фона/текста (кроме иконок).
2. Русский язык интерфейса.
3. `win.content` — flex column: корень приложения делай `flex:1; min-height:0; overflow:...`.
4. Слушатели `OS.on(...)` снимай в `win.on('close')` через сохранённую функцию отписки (`const un = OS.on(...)`).
5. Никаких внешних ресурсов (CDN, шрифты, картинки) — всё инлайном/SVG.
6. Контент внутри окна может выделяться текстом (`user-select: text` уже задан).
7. Файл должен парситься `node --check` и не бросать исключений при загрузке страницы.
