#!/bin/bash
# Construiește și instalează Dezinstalator pe Fedora.
# Rulează din folderul proiectului:   bash install.sh
# Tot cu această comandă instalezi și o versiune nouă, după ce modifici codul.
set -e
cd "$(dirname "$0")"

echo "==> Instalez uneltele necesare (Node.js, rpm-build)…"
sudo dnf install -y --skip-unavailable nodejs npm rpm-build libxcrypt-compat

echo "==> Descarc dependențele proiectului…"
npm install --no-audit --no-fund
# Electron mai nou nu-și mai descarcă singur programul la instalare
[ -x node_modules/electron/dist/electron ] || node node_modules/electron/install.js

echo "==> Construiesc pachetul .rpm…"
rm -rf dist
npm run dist

RPM=$(ls dist/*.rpm | head -1)
echo "==> Instalez $RPM…"
sudo dnf install -y "$RPM" || sudo dnf reinstall -y "$RPM"

echo
echo "Gata! Caută „Dezinstalator” în lista de aplicații."
