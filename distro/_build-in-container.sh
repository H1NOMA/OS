#!/usr/bin/env bash
# ============================================================
#  Выполняется ВНУТРИ контейнера Arch Linux (см. build.sh).
#  Берёт эталонный профиль archiso `releng` (проверенная загрузочная
#  обвязка: ядро, initramfs, GRUB/systemd-boot, BIOS+UEFI) и накладывает
#  сверху оболочку Hiko: пакеты, автологин, kiosk-сессию, брендинг.
# ============================================================
set -euo pipefail

REPO=/hiko
PROFILE=/tmp/hiko-profile

echo "  - устанавливаю archiso"
pacman -Sy --noconfirm --needed archiso >/dev/null

echo "  - беру эталонный профиль releng"
rm -rf "$PROFILE"
cp -r /usr/share/archiso/configs/releng "$PROFILE"

echo "  - накладываю оболочку Hiko (airootfs)"
cp -a "$REPO/distro/overlay/airootfs/." "$PROFILE/airootfs/"

echo "  - добавляю пакеты Hiko"
{ echo ""; grep -vE '^[[:space:]]*(#|$)' "$REPO/distro/overlay/packages.hiko"; } >> "$PROFILE/packages.x86_64"

echo "  - кладу оболочку (Hiko.html)"
install -d "$PROFILE/airootfs/opt/hiko"
cp "$REPO/dist/Hiko.html" "$PROFILE/airootfs/opt/hiko/Hiko.html"

echo "  - брендинг профиля (имя/метка/издатель)"
sed -i \
  -e 's|^iso_name=.*|iso_name="hiko"|' \
  -e 's|^iso_publisher=.*|iso_publisher="Hiko OS <https://github.com/h1noma/os>"|' \
  -e 's|^iso_application=.*|iso_application="Hiko OS Live / Installer"|' \
  -e 's|^install_dir=.*|install_dir="hiko"|' \
  -e 's|^iso_label=.*|iso_label="HIKO"|' \
  "$PROFILE/profiledef.sh"

# права на наши исполняемые файлы и скрипт кастомизации
cat >> "$PROFILE/profiledef.sh" <<'PERMS'

# --- Hiko OS ---
file_permissions+=(
  ["/usr/local/bin/hiko-session"]="0:0:0755"
  ["/usr/local/bin/hiko-install"]="0:0:0755"
  ["/root/customize_airootfs.sh"]="0:0:0755"
)
PERMS

echo "  - брендинг загрузочного меню"
grep -rlZ 'Arch Linux' "$PROFILE"/syslinux "$PROFILE"/efiboot "$PROFILE"/grub 2>/dev/null \
  | xargs -0 -r sed -i 's/Arch Linux/Hiko OS/g' || true

echo "  - сборка образа (mkarchiso)"
rm -rf /tmp/work
mkarchiso -v -w /tmp/work -o "$REPO/distro/out" "$PROFILE"

echo "  - готово."
