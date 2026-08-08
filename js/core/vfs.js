/* ============================================================
   hinomaOS · vfs — виртуальная файловая система
   Дерево в localStorage. Пути POSIX-стиля: /Desktop/файл.txt
   ============================================================ */
(function () {
  'use strict';

  const KEY = 'hinoma.vfs.v1';
  const BAK_KEY = 'hinoma.vfs.bak';
  const MAX_FILE = 2.5 * 1024 * 1024;  // ~2.5 МБ на файл (лимит localStorage)
  const MAX_TOTAL = 4.4 * 1024 * 1024; // мягкий потолок всей ФС

  const now = () => Date.now();
  const dir = (name, children) => ({ type: 'dir', name, children: children || {}, created: now(), modified: now() });
  const file = (name, content, meta) => ({ type: 'file', name, content: content || '', created: now(), modified: now(), meta: meta || undefined });

  /* ---------- начальное наполнение ---------- */
  function seed() {
    const root = dir('');
    root.children['Desktop'] = dir('Desktop');
    root.children['Documents'] = dir('Documents');
    root.children['Downloads'] = dir('Downloads');
    root.children['Pictures'] = dir('Pictures');
    root.children['Music'] = dir('Music');
    root.children['Apps'] = dir('Apps');
    root.children['Trash'] = dir('Trash');

    root.children['Desktop'].children['Добро пожаловать.md'] = file('Добро пожаловать.md',
`# Привет! Это hinomaOS 👋

Твоя персональная операционная система прямо в браузере —
со своим характером, цветами и виджетами. Всё работает офлайн.

## С чего начать

- **Панель внизу** — приложения; значок с сеткой открывает их все
- **ПКМ по рабочему столу** → «Добавить виджет…» — часы, погода, стикеры
- Перетащи окно к краю экрана — сработает прикрепление
- Наведи на зелёную кнопку окна — появятся раскладки

## Горячие клавиши

| Сочетание | Действие |
|---|---|
| Alt + Space | Поиск |
| Alt + Tab | Переключение окон |
| F3 | Обзор окон |
| Ctrl + Alt + ← / → / ↑ / ↓ | Прикрепить окно |
| F2 | Переименовать файл |

*Хорошего дня! — Клодик* 🤍`);

    root.children['Documents'].children['Идеи.txt'] = file('Идеи.txt',
`— научиться играть на гитаре
— съездить в горы
— дописать пет-проект
— прочитать «Мастера и Маргариту»
`);
    root.children['Documents'].children['О системе.md'] = file('О системе.md',
`# hinomaOS 1.0 «Nova»

Персональная веб-ОС со своим визуалом и привычной логикой
настольных систем: окна, панель, проводник, терминал, виджеты.

Собрана на чистом JavaScript — без фреймворков и сборщиков.
Все данные хранятся локально в твоём браузере (localStorage).

Чтобы сбросить систему: Настройки → Сброс.`);
    return root;
  }

  let root = null;
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { root = JSON.parse(raw); return; }
    } catch (e) {
      console.warn('[VFS] основное хранилище повреждено, пробую резервную копию', e);
      // защита: пытаемся поднять резервную копию
      try {
        const bak = localStorage.getItem(BAK_KEY);
        if (bak) {
          root = JSON.parse(bak);
          persist();
          setTimeout(() => OS.notify({ title: 'Файловая система', body: 'Данные восстановлены из резервной копии', appId: 'system' }), 1500);
          return;
        }
      } catch (e2) { console.warn('[VFS] копия тоже повреждена', e2); }
    }
    root = seed();
    persist();
  }

  let persistTimer = null;
  let bakTimer = 0;
  function persist() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      try {
        const json = JSON.stringify(root);
        localStorage.setItem(KEY, json);
        // резервная копия — не чаще раза в 30 секунд и только пока ФС компактна
        const now = Date.now();
        if (now - bakTimer > 30000 && json.length < 1.6 * 1024 * 1024) {
          bakTimer = now;
          try { localStorage.setItem(BAK_KEY, json); } catch (e) { /* нет места под копию — не страшно */ }
        }
      } catch (e) {
        console.error('[VFS] переполнение хранилища', e);
        OS.notify({ title: 'Файловая система', body: 'Хранилище переполнено — файл не сохранён', appId: 'system' });
      }
    }, 120);
  }

  /* ---------- работа с путями ---------- */
  function normalize(path) {
    if (!path) return '/';
    const parts = String(path).split('/').filter(Boolean);
    const out = [];
    for (const p of parts) {
      if (p === '.') continue;
      if (p === '..') out.pop();
      else out.push(p);
    }
    return '/' + out.join('/');
  }
  const parentOf = (path) => normalize(path).split('/').slice(0, -1).join('/') || '/';
  const nameOf = (path) => normalize(path).split('/').filter(Boolean).pop() || '';
  const join = (...parts) => normalize(parts.join('/'));

  function nodeAt(path) {
    const parts = normalize(path).split('/').filter(Boolean);
    let n = root;
    for (const p of parts) {
      if (!n || n.type !== 'dir' || !n.children[p]) return null;
      n = n.children[p];
    }
    return n;
  }

  function assertDir(path) {
    const n = nodeAt(path);
    if (!n) throw new Error('Нет такого пути: ' + path);
    if (n.type !== 'dir') throw new Error('Не папка: ' + path);
    return n;
  }

  function changed(path, action) {
    persist();
    OS.emit('vfs:change', { path: normalize(path), action });
  }

  /* ---------- API ---------- */
  const vfs = {
    normalize, parentOf, nameOf, join,

    exists: (path) => !!nodeAt(path),

    stat(path) {
      const n = nodeAt(path);
      if (!n) return null;
      return {
        name: n.name || nameOf(path),
        type: n.type,
        size: n.type === 'file' ? (n.content ? n.content.length : 0) : Object.keys(n.children).length,
        created: n.created,
        modified: n.modified,
        meta: n.meta,
      };
    },

    list(path) {
      const n = assertDir(path);
      const base = normalize(path);
      return Object.values(n.children)
        .map(c => ({
          name: c.name,
          path: join(base, c.name),
          type: c.type,
          size: c.type === 'file' ? (c.content ? c.content.length : 0) : Object.keys(c.children).length,
          created: c.created,
          modified: c.modified,
          meta: c.meta,
        }))
        .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, 'ru') : (a.type === 'dir' ? -1 : 1)));
    },

    read(path) {
      const n = nodeAt(path);
      if (!n) throw new Error('Файл не найден: ' + path);
      if (n.type !== 'file') throw new Error('Это папка: ' + path);
      return n.content;
    },

    write(path, content, meta) {
      path = normalize(path);
      content = String(content ?? '');
      if (content.length > MAX_FILE) throw new Error('Файл слишком большой (макс. 2.5 МБ)');
      if (vfs.usage() + content.length > MAX_TOTAL) throw new Error('Хранилище почти заполнено — освободи место (Настройки → О системе)');
      const parent = assertDir(parentOf(path));
      const name = nameOf(path);
      if (!name) throw new Error('Пустое имя файла');
      const existing = parent.children[name];
      if (existing && existing.type === 'dir') throw new Error('Уже существует папка с таким именем');
      if (existing) {
        existing.content = content;
        existing.modified = now();
        if (meta !== undefined) existing.meta = meta;
      } else {
        parent.children[name] = file(name, content, meta);
      }
      changed(path, 'write');
      return path;
    },

    mkdir(path) {
      path = normalize(path);
      const parent = assertDir(parentOf(path));
      const name = nameOf(path);
      if (!name) throw new Error('Пустое имя папки');
      if (parent.children[name]) throw new Error('Уже существует: ' + name);
      parent.children[name] = dir(name);
      changed(path, 'mkdir');
      return path;
    },

    /** Удаление. opts.toTrash=true — переместить в /Trash (по умолчанию для UI). */
    rm(path, opts) {
      path = normalize(path);
      if (path === '/' || /^\/(Desktop|Documents|Downloads|Pictures|Music|Apps|Trash)$/.test(path)) {
        throw new Error('Системную папку удалить нельзя');
      }
      const parent = nodeAt(parentOf(path));
      const name = nameOf(path);
      if (!parent || !parent.children[name]) throw new Error('Не найдено: ' + path);
      const node = parent.children[name];
      if (opts && opts.toTrash && !path.startsWith('/Trash')) {
        const trash = assertDir('/Trash');
        let tName = name;
        let i = 1;
        while (trash.children[tName]) {
          const dot = name.lastIndexOf('.');
          tName = dot > 0 ? `${name.slice(0, dot)} ${++i}${name.slice(dot)}` : `${name} ${++i}`;
        }
        node.name = tName;
        node.meta = { ...(node.meta || {}), origPath: path };
        trash.children[tName] = node;
      }
      delete parent.children[name];
      changed(path, 'rm');
      return true;
    },

    /** Восстановить из корзины */
    restore(trashPath) {
      trashPath = normalize(trashPath);
      const node = nodeAt(trashPath);
      if (!node || !node.meta || !node.meta.origPath) throw new Error('Неоткуда восстанавливать');
      let dest = node.meta.origPath;
      if (this.exists(dest)) {
        const dot = dest.lastIndexOf('.');
        dest = dot > dest.lastIndexOf('/') ? `${dest.slice(0, dot)} (восст.)${dest.slice(dot)}` : dest + ' (восст.)';
      }
      this.mv(trashPath, dest);
      const restored = nodeAt(dest);
      if (restored && restored.meta) delete restored.meta.origPath;
      changed(dest, 'restore');
      return dest;
    },

    emptyTrash() {
      const trash = assertDir('/Trash');
      trash.children = {};
      changed('/Trash', 'empty-trash');
    },

    mv(from, to) {
      from = normalize(from); to = normalize(to);
      if (from === to) return to;
      if (to.startsWith(from + '/')) throw new Error('Нельзя переместить папку внутрь себя');
      const node = nodeAt(from);
      if (!node) throw new Error('Не найдено: ' + from);
      const destParent = assertDir(parentOf(to));
      const destName = nameOf(to);
      if (!destName) throw new Error('Пустое имя');
      if (destParent.children[destName]) throw new Error('Уже существует: ' + destName);
      const srcParent = nodeAt(parentOf(from));
      delete srcParent.children[nameOf(from)];
      node.name = destName;
      node.modified = now();
      destParent.children[destName] = node;
      changed(to, 'mv');
      return to;
    },

    cp(from, to) {
      from = normalize(from); to = normalize(to);
      const node = nodeAt(from);
      if (!node) throw new Error('Не найдено: ' + from);
      if (to.startsWith(from + '/')) throw new Error('Нельзя скопировать папку внутрь себя');
      const destParent = assertDir(parentOf(to));
      const destName = nameOf(to);
      if (destParent.children[destName]) throw new Error('Уже существует: ' + destName);
      const clone = JSON.parse(JSON.stringify(node));
      const fix = (n, name) => { n.name = name; n.created = now(); n.modified = now(); if (n.children) Object.values(n.children).forEach(c => fix(c, c.name)); };
      fix(clone, destName);
      destParent.children[destName] = clone;
      changed(to, 'cp');
      return to;
    },

    /** Уникальное имя в папке: «Новая папка», «Новая папка 2», … */
    uniqueName(dirPath, base) {
      const d = assertDir(dirPath);
      if (!d.children[base]) return base;
      const dot = base.lastIndexOf('.');
      const stem = dot > 0 ? base.slice(0, dot) : base;
      const ext = dot > 0 ? base.slice(dot) : '';
      let i = 2;
      while (d.children[`${stem} ${i}${ext}`]) i++;
      return `${stem} ${i}${ext}`;
    },

    /** Поиск по имени по всему дереву */
    search(query, maxResults) {
      const q = query.toLowerCase();
      const out = [];
      const walk = (node, path) => {
        if (out.length >= (maxResults || 30)) return;
        for (const child of Object.values(node.children || {})) {
          const p = join(path, child.name);
          if (child.name.toLowerCase().includes(q)) {
            out.push({ name: child.name, path: p, type: child.type });
            if (out.length >= (maxResults || 30)) return;
          }
          if (child.type === 'dir') walk(child, p);
        }
      };
      walk(root, '/');
      return out;
    },

    trashCount() {
      const t = nodeAt('/Trash');
      return t ? Object.keys(t.children).length : 0;
    },

    usage() {
      try { return (localStorage.getItem(KEY) || '').length; } catch (e) { return 0; }
    },

    backupInfo() {
      try {
        const b = localStorage.getItem(BAK_KEY);
        return b ? { size: b.length } : null;
      } catch (e) { return null; }
    },
    restoreFromBackup() {
      const b = localStorage.getItem(BAK_KEY);
      if (!b) throw new Error('Резервной копии нет');
      JSON.parse(b); // валидация
      localStorage.setItem(KEY, b);
      location.reload();
    },
  };

  load();
  if (root && root.type === 'dir' && !root.children['Apps']) {
    root.children['Apps'] = dir('Apps');
    persist();
  }
  OS.vfs = vfs;
})();
