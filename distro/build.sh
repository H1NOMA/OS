#!/usr/bin/env bash
# ============================================================
#  Hiko OS — сборка загрузочного образа (.iso)
#  Собирает настоящий загрузочный образ операционной системы:
#  минимальный Linux, который стартует прямо в оболочку Hiko.
#
#  Требуется Docker (Linux-контейнер, режим --privileged).
#  Работает на Linux, macOS и Windows (через WSL2 + Docker Desktop).
#
#  Запуск:  ./distro/build.sh
#  Результат: distro/out/hiko-*.iso
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> 1/3 Собираю оболочку Hiko (единый Hiko.html)"
python3 tools/build.py

if ! command -v docker >/dev/null 2>&1; then
  cat >&2 <<'EOF'
Нужен Docker.
  · Windows/macOS: установи Docker Desktop
  · Linux:         установи пакет docker и запусти службу
Сборка образа ОС требует пакетов Arch Linux и mkarchiso — Docker берёт это на себя,
свой дистрибутив ставить не нужно.
EOF
  exit 1
fi

echo "==> 2/3 Собираю ISO в контейнере Arch Linux (нужен --privileged для монтирования)"
mkdir -p distro/out
docker run --rm --privileged \
  -v "$ROOT":/hiko -w /hiko \
  archlinux:latest bash /hiko/distro/_build-in-container.sh

echo "==> 3/3 Готово. Загрузочный образ:"
ls -lh distro/out/*.iso 2>/dev/null || { echo "ISO не найден — смотри лог сборки выше." >&2; exit 1; }

cat <<'EOF'

Дальше:
  · Запиши образ на флешку (>= 4 ГБ): balenaEtcher, Rufus (режим DD) или
      sudo dd if=distro/out/hiko-*.iso of=/dev/sdX bs=4M status=progress oflag=sync
  · Загрузись с флешки (в BIOS/UEFI выбери её как загрузочное устройство).
  · Hiko стартует сразу на весь экран. Чтобы поставить систему на диск
      рядом с Windows — см. distro/README.md (раздел «Установка на диск»).
EOF
