#!/usr/bin/env bash
# ============================================================
#  Выполняется mkarchiso внутри собираемой системы (chroot).
#  Настраивает live-образ Hiko: владелец, автологин, сервисы,
#  графический старт в оболочку Hiko.
# ============================================================
set -euo pipefail

# --- владелец системы (единственный, как на телефоне) ---
useradd -m -u 1000 -U -G wheel,audio,video,input,network,seat,storage -s /bin/bash hiko
printf 'hiko:hiko\n' | chpasswd
printf 'root:hiko\n' | chpasswd

# --- локали: русская + английская ---
sed -i 's/^#\(en_US.UTF-8 UTF-8\)/\1/' /etc/locale.gen
sed -i 's/^#\(ru_RU.UTF-8 UTF-8\)/\1/' /etc/locale.gen
locale-gen
echo 'LANG=ru_RU.UTF-8' > /etc/locale.conf

# --- сервисы: сеть, seat, вход в оболочку ---
systemctl enable NetworkManager.service
systemctl enable seatd.service
systemctl enable greetd.service
systemctl set-default graphical.target

# greetd владеет VT1 — снимаем автологин getty от базового профиля,
# чтобы не конфликтовать за консоль.
rm -f /etc/systemd/system/getty@tty1.service.d/autologin.conf

# --- папка хранилища оболочки Hiko ---
install -d -o hiko -g hiko /home/hiko/.hiko
