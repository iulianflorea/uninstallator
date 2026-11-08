# Dezinstalator

Aplicație desktop pentru Fedora care dezinstalează **orice program, oricum ar fi instalat**, dintr-o interfață în stil Apple, cu sticlă translucidă („liquid glass”), temă luminoasă/întunecată și fără comenzi în terminal.

| Tip de instalare | Ce găsește | Cum dezinstalează |
|---|---|---|
| **RPM** (dnf, `.rpm` descărcat, repo-uri externe, COPR, RPM Fusion) | toate pachetele; aplicațiile cu iconiță în meniu apar separat de pachetele de sistem | `dnf remove`, cu previzualizare a tot ce se elimină |
| **Flatpak** (pentru sistem sau doar pentru utilizator) | toate aplicațiile | `flatpak uninstall`, opțional cu datele din `~/.var/app` |
| **Snap** (dacă e instalat) | toate snap-urile, cu cele de bază ascunse | `snap remove`, opțional `--purge` |
| **AppImage** | în `~/Applications`, `~/AppImages`, `~/Apps`, `~/.local/bin`, Descărcări, Desktop, `/opt` și oriunde arată o scurtătură | fișierul + scurtătura + iconița, mutate în Coș |
| **Instalate manual** (arhive dezarhivate, `/opt/...`, `~/apps/...`) | după scurtătura din meniu sau folderele orfane din `/opt` | folderul programului + scurtătura + legăturile din `/usr/local/bin` |
| **Scurtături** (aplicații web Chrome, scurtături rupte) | din `~/.local/share/applications` | doar scurtătura și iconița ei |

Pentru fiecare aplicație caută și **setările și datele rămase** (`~/.config`, `~/.local/share`, `~/.cache`, foldere ascunse din home). Le poți șterge bifând o căsuță. Ajung în Coș, de unde le poți recupera.

## Aspect și limbă

Din butonul **Aspect și limbă** (jos, în bara laterală) poți:

- schimba **limba** interfeței: română (implicit) sau engleză;
- alege o **imagine de fundal** (PNG, JPG, WEBP, GIF, BMP, AVIF). Imaginea e copiată în `~/.config/Dezinstalator/backgrounds`, așa că rămâne chiar dacă muți sau ștergi originalul;
- regla **blur-ul imaginii de fundal**, de la clară la încețoșată (apare când ai ales o imagine);
- regla **opacitatea cardurilor**, adică efectul de sticlă al cardurilor și panourilor: de la complet transparent la mat. 50% e aspectul original.

Setările se păstrează între porniri. „Revino la implicit” resetează fundalul, blur-ul și opacitatea.

> **English:** the app is also available in English. Open **Appearance & language** in the sidebar to switch the language, set a background image, and adjust the background image blur and the card glass opacity (from transparent to matte).

## Instalare

```bash
bash install.sh
```

Scriptul instalează Node.js și `rpm-build` (dacă lipsesc), construiește pachetul `.rpm` și îl instalează. După aceea găsești **Dezinstalator** în lista de aplicații. Pentru o versiune nouă rulezi aceeași comandă.

Dacă ai deja fișierul `.rpm` gata construit:

```bash
sudo dnf install ./dezinstalator-1.1.0.x86_64.rpm
```

## Siguranță

- Pachetele esențiale (kernel, systemd, glibc, dnf, GNOME Shell etc.) sunt marcate **Protejat** și nu pot fi șterse.
- La RPM, înainte de ștergere vezi exact ce elimină `dnf`, inclusiv dependențele, plus un avertisment dacă se elimină și alte programe.
- Fișierele din folderul tău personal merg în **Coș**, nu sunt șterse definitiv.
- Operațiile de sistem trec printr-un singur ajutor privilegiat (`helper/dezinstalator-helper`), rulat prin `pkexec`. Acesta acceptă doar câteva comenzi, cu nume de pachete și căi verificate strict, și refuză să șteargă orice fișier care aparține unui pachet RPM. Parola e ținută minte câteva minute, ca să nu fie cerută la fiecare pas.
- Interfața trimite către proces doar identificatorii aplicațiilor din ultima scanare, nu căi sau comenzi.

## Dezvoltare

```bash
npm install
node node_modules/electron/install.js   # o singură dată, dacă Electron nu s-a descărcat
npm start                               # pornește aplicația direct din cod
npm test                                # teste pe un sistem simulat
node test/make-preview.js               # generează test/preview.html (interfața cu date demo, în browser)
npm run dist                            # construiește dist/*.rpm
```

În modul dezvoltare (`npm start`), parola se cere la fiecare operație de sistem, pentru că politica polkit se instalează doar odată cu pachetul `.rpm`.

### Structură

```
src/main.js          procesul principal Electron (fereastră, IPC)
src/preload.js       puntea sigură dintre interfață și proces
src/scanner.js       găsește aplicațiile (RPM, Flatpak, Snap, AppImage, manuale, scurtături)
src/uninstaller.js   previzualizare + dezinstalare + resturi
src/desktop.js       citire fișiere .desktop și iconițe
src/renderer/        interfața (HTML/CSS/JS, fără framework)
helper/              ajutorul privilegiat + politica polkit
build/               iconița și scripturile pachetului .rpm
test/                teste și previzualizare cu date simulate
```

Singularity AI SRL · MIT
