#!/bin/bash
APP=/opt/Dezinstalator

ln -sf "$APP/dezinstalator" /usr/bin/dezinstalator

# Sandbox-ul Chromium
if ! { [[ -L /proc/self/ns/user ]] && unshare --user true; } 2>/dev/null; then
    chmod 4755 "$APP/chrome-sandbox" || true
else
    chmod 0755 "$APP/chrome-sandbox" || true
fi

# Ajutorul privilegiat + politica polkit (parola ținută minte câteva minute)
chown root:root "$APP/resources/helper/dezinstalator-helper"
chmod 0755 "$APP/resources/helper/dezinstalator-helper"
install -D -m 0644 "$APP/resources/helper/ro.singularity.dezinstalator.policy" \
    /usr/share/polkit-1/actions/ro.singularity.dezinstalator.policy

update-desktop-database /usr/share/applications >/dev/null 2>&1 || true
gtk-update-icon-cache -q /usr/share/icons/hicolor >/dev/null 2>&1 || true
exit 0
