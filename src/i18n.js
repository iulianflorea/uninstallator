'use strict';
// Textele generate de procesul principal (scanare, previzualizare, dezinstalare), în română și engleză.

const STR = {
  ro: {
    srcFedora: 'Fedora',
    srcCommandline: 'Fișier .rpm descărcat',
    srcFusion: 'RPM Fusion',
    srcCopr: (x) => `COPR ${x}`,
    srcRepo: (r) => `Repo ${r}`,
    srcExternal: 'Sursă externă',
    srcFlatpak: (o) => `Flatpak · ${o || 'necunoscut'}`,
    publishedBy: (p) => `Publicat de ${p}`,
    portable: 'Aplicație portabilă (AppImage)',
    brokenShortcut: 'Scurtătură către un program care nu mai există',
    webApp: (o) => `Aplicație web (${o || 'browser'})`,
    shortcutTo: (x) => `Scurtătură către ${x}`,
    srcBroken: 'Scurtătură ruptă',
    srcWeb: 'Aplicație web',
    srcShortcut: 'Scurtătură',
    manualDesc: 'Program instalat manual',
    srcManualOpt: 'Instalat manual în /opt',
    srcManual: 'Instalat manual',
    optOrphan: 'Folder de program în /opt, fără scurtătură în meniu',

    kind_rpm: 'Pachete RPM',
    kind_flatpak: 'Aplicații Flatpak',
    kind_snap: 'Aplicații Snap',
    kind_appimage: 'AppImage',
    kind_manual: 'Programe instalate manual',
    kind_shortcut: 'Scurtături',
    blockedProtected: (names, many) => `${names} ${many ? 'sunt componente esențiale' : 'este o componentă esențială'} a sistemului și nu poate fi dezinstalat${many ? 'e' : ''}.`,
    authPreview: 'Parola nu a fost introdusă, așa că nu am putut verifica ce se va elimina.',
    dnfUnreadable: 'Nu am putut citi lista detaliată de la dnf. Verifică mai jos textul complet înainte să continui.',
    dnfFailed: 'dnf nu a putut pregăti dezinstalarea.',
    unusedDeps: 'Dependențe care nu mai sunt folosite',
    alsoRemoves: (n, list) => `Se vor elimina și ${n} pachete care depind de ce ai ales: ${list}`,
    manyPkgs: (n) => `Atenție: se elimină ${n} pachete în total. Verifică lista înainte să continui.`,
    onlyYou: 'doar pentru tine',
    wholeSystem: 'pentru tot sistemul',
    leftSettings: 'Setări',
    leftData: 'Date',
    leftState: 'Stare',
    leftCache: 'Cache',
    leftHidden: 'Folder ascuns',
    leftFlatpak: 'Datele aplicației Flatpak',
    leftSnap: 'Datele aplicației Snap',
    progRemoving: (x) => `Se dezinstalează ${x}…`,
    progRemovingKind: (x, k) => `Se dezinstalează ${x} (${k})…`,
    progEliminating: (x) => `Se elimină ${x}…`,
    progLeftovers: 'Se mută în Coș setările și datele rămase…',
    trashFailed: (p, m) => `Nu am putut muta în Coș ${p}: ${m}`,
    flatpakSearching: 'Se caută runtime-uri Flatpak nefolosite…',
  },
  en: {
    srcFedora: 'Fedora',
    srcCommandline: 'Downloaded .rpm file',
    srcFusion: 'RPM Fusion',
    srcCopr: (x) => `COPR ${x}`,
    srcRepo: (r) => `Repo ${r}`,
    srcExternal: 'External source',
    srcFlatpak: (o) => `Flatpak · ${o || 'unknown'}`,
    publishedBy: (p) => `Published by ${p}`,
    portable: 'Portable app (AppImage)',
    brokenShortcut: 'Shortcut to a program that no longer exists',
    webApp: (o) => `Web app (${o || 'browser'})`,
    shortcutTo: (x) => `Shortcut to ${x}`,
    srcBroken: 'Broken shortcut',
    srcWeb: 'Web app',
    srcShortcut: 'Shortcut',
    manualDesc: 'Manually installed program',
    srcManualOpt: 'Installed manually in /opt',
    srcManual: 'Installed manually',
    optOrphan: 'Program folder in /opt, with no menu shortcut',

    kind_rpm: 'RPM packages',
    kind_flatpak: 'Flatpak apps',
    kind_snap: 'Snap apps',
    kind_appimage: 'AppImage',
    kind_manual: 'Manually installed programs',
    kind_shortcut: 'Shortcuts',
    blockedProtected: (names, many) => `${names} ${many ? 'are essential system components' : 'is an essential system component'} and cannot be uninstalled.`,
    authPreview: 'The password was not entered, so I could not check what would be removed.',
    dnfUnreadable: 'I could not read the detailed list from dnf. Check the full output below before continuing.',
    dnfFailed: 'dnf could not prepare the removal.',
    unusedDeps: 'Dependencies that are no longer used',
    alsoRemoves: (n, list) => `${n} packages that depend on your selection will also be removed: ${list}`,
    manyPkgs: (n) => `Warning: ${n} packages will be removed in total. Check the list before continuing.`,
    onlyYou: 'just for you',
    wholeSystem: 'system-wide',
    leftSettings: 'Settings',
    leftData: 'Data',
    leftState: 'State',
    leftCache: 'Cache',
    leftHidden: 'Hidden folder',
    leftFlatpak: 'Flatpak app data',
    leftSnap: 'Snap app data',
    progRemoving: (x) => `Uninstalling ${x}…`,
    progRemovingKind: (x, k) => `Uninstalling ${x} (${k})…`,
    progEliminating: (x) => `Removing ${x}…`,
    progLeftovers: 'Moving leftover settings and data to the Trash…',
    trashFailed: (p, m) => `Could not move ${p} to the Trash: ${m}`,
    flatpakSearching: 'Looking for unused Flatpak runtimes…',
  },
};

let lang = 'ro';

function setLang(l) { lang = STR[l] ? l : 'en'; return lang; }
function getLang() { return lang; }

/** Textul pentru cheia dată, în limba curentă (cu valorile date, dacă e funcție). */
function t(key, ...args) {
  const v = STR[lang][key] ?? STR.ro[key];
  if (v === undefined) return key;
  return typeof v === 'function' ? v(...args) : v;
}

module.exports = { t, setLang, getLang, STR };
