#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Сборка релиза Hiko OS.

Делает из исходников два артефакта в dist/:
  1. Hiko.html                 — вся система одним файлом (offline, двойной клик)
  2. Hiko-<версия>-windows.zip — Hiko.html + Hiko.bat + инструкция

Запуск:  python3 tools/build.py
"""
import os
import re
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, 'dist')
VERSION = '1.0.0'


def read(path):
    with open(os.path.join(ROOT, path), encoding='utf-8') as f:
        return f.read()


def build_single_html():
    html = read('index.html')

    # инлайн CSS
    def css_repl(m):
        css = read(m.group(1))
        return '<style>\n/* === %s === */\n%s\n</style>' % (m.group(1), css)
    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', css_repl, html)

    # инлайн JS (порядок сохраняется)
    def js_repl(m):
        src = m.group(1)
        js = read(src)
        if '</script' in js.lower():
            raise SystemExit('ОШИБКА: %s содержит "</script>" — сломает единый файл' % src)
        return '<script>\n/* === %s === */\n%s\n</script>' % (src, js)
    html = re.sub(r'<script src="([^"]+)"></script>', js_repl, html)

    assert '<link rel="stylesheet"' not in html, 'остался не-инлайновый CSS'
    assert '<script src=' not in html, 'остался не-инлайновый JS'

    out = os.path.join(DIST, 'Hiko.html')
    with open(out, 'w', encoding='utf-8') as f:
        f.write(html)
    return out


BAT = (
    '@echo off\r\n'
    'rem Hiko OS launcher: opens Hiko in its own app window (Microsoft Edge)\r\n'
    'start "" msedge --app="file:///%~dp0Hiko.html" --start-maximized\r\n'
    'if errorlevel 1 start "" "%~dp0Hiko.html"\r\n'
)

README_TXT = u"""HIKO OS %s
=============

ЗАПУСК
  Hiko.bat        — отдельное окно без браузерных панелей (рекомендуется)
  Hiko.html       — просто открыть в любом Chromium-браузере

ПОЛНЫЙ ЭКРАН
  F11 — включить/выключить. Alt+Tab / Win+Tab — переключение с Windows.

КУДА ПОЛОЖИТЬ
  В любую папку, например D:\\Hiko. Важно: данные системы (файлы, настройки)
  браузер привязывает к расположению Hiko.html — если захочешь перенести папку,
  сначала сделай экспорт: Настройки -> Данные -> Экспортировать, а после
  переноса — Импортировать.

АВТОЗАПУСК ВМЕСТЕ С WINDOWS
  Win+R -> shell:startup -> скопируй туда ярлык на Hiko.bat.

Подробная инструкция: docs/INSTALL.ru.md в репозитории.
""" % VERSION


def build_zip(single):
    out = os.path.join(DIST, 'Hiko-%s-windows.zip' % VERSION)
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        z.write(single, 'Hiko/Hiko.html')
        z.writestr('Hiko/Hiko.bat', BAT)
        z.writestr('Hiko/ПРОЧТИ МЕНЯ.txt', README_TXT.encode('utf-8'))
    return out


def main():
    os.makedirs(DIST, exist_ok=True)
    single = build_single_html()
    bundle = build_zip(single)
    for p in (single, bundle):
        print('%-40s %6.1f КБ' % (os.path.relpath(p, ROOT), os.path.getsize(p) / 1024))


if __name__ == '__main__':
    sys.exit(main())
