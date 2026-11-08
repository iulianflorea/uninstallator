'use strict';
const path = require('path');
const { fsp, readdirSafe, exists } = require('./util');
const { getLang } = require('./i18n');

/** Citește un fișier .desktop și întoarce câmpurile din [Desktop Entry]. */
async function parseDesktopFile(file) {
  let text;
  try { text = await fsp.readFile(file, 'utf8'); } catch { return null; }
  return parseDesktopText(text, file);
}

function parseDesktopText(text, file) {
  const e = {};
  let inMain = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('[')) { inMain = line === '[Desktop Entry]'; continue; }
    if (!inMain) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const k = line.slice(0, eq).trim();
    const v = line.slice(eq + 1).trim();
    if (!(k in e)) e[k] = v;
  }
  if (!e.Type && !e.Name) return null;
  const truthy = (v) => /^true$/i.test(v || '');
  // Varianta tradusă în limba aleasă (Name[ro], Name[en_GB], Name[en]…), altfel cea implicită
  const lang = getLang();
  const loc = (k) => {
    if (e[`${k}[${lang}]`]) return e[`${k}[${lang}]`];
    const other = Object.keys(e).find((x) => x.startsWith(`${k}[${lang}_`));
    return other ? e[other] : '';
  };
  return {
    file,
    id: path.basename(file, '.desktop'),
    name: loc('Name') || e.Name || path.basename(file, '.desktop'),
    comment: loc('Comment') || e.Comment || loc('GenericName') || e.GenericName || '',
    icon: e.Icon || '',
    exec: e.Exec || '',
    tryExec: e.TryExec || '',
    type: e.Type || 'Application',
    noDisplay: truthy(e.NoDisplay),
    hidden: truthy(e.Hidden),
    onlyShowIn: e.OnlyShowIn || '',
    flatpak: e['X-Flatpak'] || '',
    snap: e['X-SnapInstanceName'] || '',
    appimage: /\.appimage\b/i.test(e.Exec || '') || !!e['X-AppImage-Version'] || !!e['X-AppImage-Name'],
  };
}

/** Împarte linia Exec în argumente (respectă ghilimelele, conform specificației). */
function splitExec(exec) {
  const out = [];
  let cur = '';
  let q = false;
  let has = false;
  for (let i = 0; i < exec.length; i++) {
    const c = exec[i];
    if (q) {
      if (c === '\\' && i + 1 < exec.length) { cur += exec[++i]; continue; }
      if (c === '"') { q = false; continue; }
      cur += c;
    } else if (c === '"') { q = true; has = true; }
    else if (/\s/.test(c)) { if (cur || has) { out.push(cur); cur = ''; has = false; } }
    else cur += c;
  }
  if (cur || has) out.push(cur);
  return out.filter((t) => !/^%[fFuUdDnNickvm]$/.test(t));
}

/** Programul real lansat de Exec (fără „env VAR=…”). */
function execProgram(exec) {
  const t = splitExec(exec || '');
  let i = 0;
  if (t[i] && /(^|\/)env$/.test(t[i])) {
    i++;
    while (t[i] && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(t[i]) || /^-/.test(t[i]))) i++;
  }
  while (t[i] && /^[A-Za-z_][A-Za-z0-9_]*=/.test(t[i])) i++;
  return { program: t[i] || '', args: t.slice(i + 1) };
}

/** Index de iconițe: nume → cea mai bună cale (svg sau png cât mai mare). */
async function buildIconIndex(ctx) {
  const bases = [
    ctx.hp('.local/share/icons'),
    ctx.hp('.local/share/flatpak/exports/share/icons'),
    ctx.hp('.icons'),
    ctx.p('/var/lib/flatpak/exports/share/icons'),
    ctx.p('/var/lib/snapd/desktop/icons'),
    ctx.p('/usr/local/share/icons'),
    ctx.p('/usr/share/icons'),
  ];
  const index = new Map(); // name -> {path, rank}
  const put = (name, file, rank) => {
    const cur = index.get(name);
    if (!cur || rank > cur.rank) index.set(name, { path: file, rank });
  };
  for (const base of bases) {
    // fișiere direct în folder (ex: snapd/desktop/icons)
    for (const d of await readdirSafe(base)) {
      if (d.isFile() && /\.(png|svg)$/i.test(d.name)) put(d.name.replace(/\.(png|svg)$/i, ''), path.join(base, d.name), 1);
    }
    for (const theme of ['hicolor', 'Adwaita', 'breeze']) {
      const tdir = path.join(base, theme);
      for (const sizeDir of await readdirSafe(tdir)) {
        if (!sizeDir.isDirectory()) continue;
        let rank;
        if (sizeDir.name === 'scalable') rank = 1000;
        else {
          const m = /^(\d+)x\d+/.exec(sizeDir.name);
          if (!m) continue;
          rank = Math.min(parseInt(m[1], 10), 512);
          if (/@2/.test(sizeDir.name)) rank += 1;
        }
        if (theme !== 'hicolor') rank -= 2000; // temele de sistem doar ca rezervă
        for (const sub of ['apps', 'applications']) {
          for (const f of await readdirSafe(path.join(tdir, sizeDir.name, sub))) {
            if (!/\.(png|svg)$/i.test(f.name) || /-symbolic\./.test(f.name)) continue;
            put(f.name.replace(/\.(png|svg)$/i, ''), path.join(tdir, sizeDir.name, sub, f.name), rank);
          }
        }
      }
    }
  }
  for (const pm of [ctx.p('/usr/share/pixmaps'), ctx.p('/usr/local/share/pixmaps')]) {
    for (const f of await readdirSafe(pm)) {
      if (/\.(png|svg)$/i.test(f.name)) put(f.name.replace(/\.(png|svg)$/i, ''), path.join(pm, f.name), -5000);
    }
  }
  return index;
}

async function resolveIcon(index, icon) {
  if (!icon) return null;
  if (icon.startsWith('/')) {
    if (/\.(png|svg|jpg|jpeg|webp)$/i.test(icon) && (await exists(icon))) return icon;
    for (const ext of ['.png', '.svg']) if (await exists(icon + ext)) return icon + ext;
    return null;
  }
  const hit = index.get(icon) || index.get(icon.replace(/\.(png|svg|xpm)$/i, ''));
  return hit ? hit.path : null;
}

module.exports = { parseDesktopFile, parseDesktopText, splitExec, execProgram, buildIconIndex, resolveIcon };
