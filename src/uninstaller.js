'use strict';
const path = require('path');
const fs = require('fs');
const { makeContext, readdirSafe, exists, dirSize, pool, humanSize, run } = require('./util');
const { t } = require('./i18n');

const kindLabel = (k) => t(`kind_${k}`);

// Foldere care nu sunt niciodată „resturi” ale unei aplicații anume
const SHARED_DIRS = new Set([
  'applications', 'icons', 'fonts', 'mime', 'themes', 'trash', 'keyrings', 'recently-used.xbel', 'gtk-3.0', 'gtk-4.0',
  'dconf', 'pulse', 'systemd', 'autostart', 'fontconfig', 'environment.d', 'user-dirs.dirs', 'gnome-shell', 'nautilus',
  'gvfs-metadata', 'tracker3', 'evolution', 'flatpak', 'containers', 'ssh', 'gnupg', 'pki', 'local', 'config', 'cache',
  'var', 'snap', 'mozilla', 'gnome-session', 'gnome-settings-daemon', 'ibus', 'xdg-desktop-portal', 'wireplumber',
  'pipewire', 'kdedefaults', 'session', 'sounds', 'backgrounds', 'bash_history', 'bashrc', 'profile', 'java', 'npm',
  'node', 'cargo', 'rustup', 'git', 'python', 'pip', 'dnf', 'rpm', 'abrt', 'dbus', 'goa-1.0', 'keyring', 'state',
  'share', 'bin', 'lib', 'go', 'docker', 'kube', 'vscode', 'thumbnails', 'fish', 'zsh', 'vim', 'nano', 'sudo_as_admin_successful',
]);

/** Locul ajutorului privilegiat: instalat (/opt/...) sau din proiect (în dezvoltare). */
function helperPath() {
  const candidates = [];
  if (process.resourcesPath) candidates.push(path.join(process.resourcesPath, 'helper', 'dezinstalator-helper'));
  candidates.push(path.join(__dirname, '..', 'helper', 'dezinstalator-helper'));
  return candidates.find((p) => fs.existsSync(p)) || candidates[candidates.length - 1];
}

function makeDeps(overrides = {}) {
  const ctx = makeContext(overrides);
  return {
    ctx,
    root: overrides.rootRun || ((args, opts) => ctx.run('pkexec', [helperPath(), ...args], { timeout: 30 * 60 * 1000, ...opts })),
    trash: overrides.trash || (async (p) => {
      const { shell } = require('electron');
      await shell.trashItem(p);
    }),
    isHome: (p) => p === ctx.home || p.startsWith(ctx.home + path.sep),
  };
}

const AUTH_FAILED = (r) => r.code === 126 || r.code === 127 || /Not authorized|Request dismissed|dismissed/i.test(r.stderr);

// ---------------------------------------------------------------- dnf
function parseDnfRemove(out) {
  const pkgs = [];
  let section = null;
  let freed = null;
  for (const line of out.split('\n')) {
    if (/^Transaction Summary/i.test(line)) { section = null; continue; }
    const head = /^(Removing[^:]*|Erasing[^:]*):\s*$/.exec(line.trim());
    if (head) {
      section = /unused/i.test(head[1]) ? 'dep' : 'main';
      continue;
    }
    if (/^\S/.test(line)) { if (!/^Package\s/.test(line)) section = null; continue; }
    const m = /^\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.+?)\s*$/.exec(line);
    if (section && m) pkgs.push({ name: m[1], arch: m[2], version: m[3].replace(/^0:/, ''), repo: m[4], size: m[5].replace(/\s+/g, ' '), dependency: section === 'dep' });
  }
  const f = /After this operation,?\s+(.+?)\s+will be freed/i.exec(out) || /Freed space:\s*(.+)/i.exec(out)
    || /remove\s+([\d.,]+\s*\S+)\)/i.exec(out);
  if (f) freed = f[1].trim();
  const problem = /(Problem[\s\S]*?)(?:\n\s*\n|$)/.exec(out) || /(.*protected.*)/i.exec(out) || /(No (packages|match)[^\n]*)/i.exec(out);
  return { pkgs, freed, problem: pkgs.length ? null : (problem ? problem[1].trim() : null) };
}

// ---------------------------------------------------------------- resturi (setări, cache)
async function findLeftovers(d, item) {
  const { ctx } = d;
  const names = new Set();
  const add = (n) => {
    if (!n) return;
    const s = String(n).toLowerCase().trim();
    if (s.length < 3) return;
    names.add(s);
    names.add(s.replace(/\s+/g, ''));
    names.add(s.replace(/\s+/g, '-'));
    names.add(s.replace(/\s+/g, '_'));
  };
  add(item.pkg);
  add(item.name);
  add(item.snap);
  if (item.appId) add(item.appId.split('.').pop());
  if (item.installDir) add(path.basename(item.installDir));
  if (item.kind === 'appimage') add(path.basename(item.path).replace(/\.appimage$/i, '').split(/[-_ ]/)[0]);
  if (item.pkg) add(item.pkg.replace(/-(bin|desktop|stable|beta|nightly|community|ce)$/, ''));

  const out = [];
  const roots = [
    { dir: ctx.hp('.config'), label: t('leftSettings') },
    { dir: ctx.hp('.local/share'), label: t('leftData') },
    { dir: ctx.hp('.local/state'), label: t('leftState') },
    { dir: ctx.hp('.cache'), label: t('leftCache') },
    { dir: ctx.home, label: t('leftHidden'), dot: true },
  ];
  for (const r of roots) {
    for (const e of await readdirSafe(r.dir)) {
      let n = e.name;
      if (r.dot) { if (!n.startsWith('.')) continue; n = n.slice(1); }
      const lower = n.toLowerCase();
      if (SHARED_DIRS.has(lower) || !names.has(lower)) continue;
      out.push({ path: path.join(r.dir, e.name), label: r.label });
    }
  }
  if (item.dataDir && (await exists(item.dataDir))) {
    out.unshift({ path: item.dataDir, label: item.kind === 'flatpak' ? t('leftFlatpak') : t('leftSnap'), special: item.kind });
  }
  await pool(out, 4, async (l) => { l.size = await dirSize(ctx, l.path); l.sizeText = humanSize(l.size); });
  return out;
}

/** Iconițe din ~/.local/share/icons cu numele scurtăturii (doar pentru scurtăturile utilizatorului). */
async function homeIcons(d, iconName) {
  if (!iconName || iconName.includes('/')) return [];
  const base = d.ctx.hp('.local/share/icons/hicolor');
  const found = [];
  for (const size of await readdirSafe(base)) {
    for (const f of await readdirSafe(path.join(base, size.name, 'apps'))) {
      if (f.name.replace(/\.(png|svg|xpm)$/i, '') === iconName) found.push(path.join(base, size.name, 'apps', f.name));
    }
  }
  return found;
}

/** Fișierele șterse pentru AppImage / manual / scurtătură. */
async function filesFor(d, item) {
  const files = [];
  if (item.kind === 'appimage') files.push(item.path);
  if (item.kind === 'manual') {
    if (item.installDir) files.push(item.installDir);
    for (const p of item.extraPaths || []) if (!files.includes(p)) files.push(p);
  }
  for (const f of item.desktopFiles || []) files.push(f);
  for (const ic of await homeIcons(d, item.iconName)) files.push(ic);
  return files;
}

// ---------------------------------------------------------------- previzualizare
async function preview(items, overrides) {
  const d = makeDeps(overrides);
  const res = { sections: [], leftovers: [], warnings: [], blocked: null, needsPassword: false, totalFreed: null };
  const blockedProt = items.filter((i) => i.protected);
  if (blockedProt.length) {
    res.blocked = t('blockedProtected', blockedProt.map((i) => i.name).join(', '), blockedProt.length > 1);
    return res;
  }

  const byKind = {};
  for (const it of items) (byKind[it.kind] = byKind[it.kind] || []).push(it);

  if (byKind.rpm) {
    res.needsPassword = true;
    const r = await d.root(['rpm-preview', ...byKind.rpm.map((i) => i.pkg)]);
    if (AUTH_FAILED(r)) { res.blocked = t('authPreview'); res.authFailed = true; return res; }
    const parsed = parseDnfRemove(r.stdout + '\n' + r.stderr);
    if (!parsed.pkgs.length && !parsed.problem && r.code === 0) {
      // n-am putut citi tabelul (format nou de dnf?) — arătăm ce s-a cerut și textul brut
      res.sections.push({ title: kindLabel('rpm'), lines: byKind.rpm.map((i) => ({ text: i.pkg, sub: i.version })) });
      res.warnings.push(t('dnfUnreadable'));
      res.raw = (r.stdout + r.stderr).trim();
    } else if (!parsed.pkgs.length) {
      res.blocked = parsed.problem || t('dnfFailed');
      res.raw = (r.stdout + r.stderr).trim();
      return res;
    }
    if (parsed.pkgs.length) {
      const main = parsed.pkgs.filter((p) => !p.dependency);
      const deps = parsed.pkgs.filter((p) => p.dependency);
      res.sections.push({
        title: kindLabel('rpm'),
        lines: main.map((p) => ({ text: p.name, sub: `${p.version} · ${p.repo}`, size: p.size })),
      });
      if (deps.length) {
        res.sections.push({
          title: t('unusedDeps'),
          lines: deps.map((p) => ({ text: p.name, sub: p.version, size: p.size })),
        });
      }
      const requested = new Set(byKind.rpm.map((i) => i.pkg));
      const extraMain = main.filter((p) => !requested.has(p.name));
      if (extraMain.length) {
        res.warnings.push(t('alsoRemoves', extraMain.length, `${extraMain.slice(0, 6).map((p) => p.name).join(', ')}${extraMain.length > 6 ? '…' : ''}`));
      }
      if (parsed.pkgs.length > 25) res.warnings.push(t('manyPkgs', parsed.pkgs.length));
      if (parsed.freed) res.totalFreed = parsed.freed;
    }
  }

  if (byKind.flatpak) {
    // dezinstalarea unui Flatpak de sistem cere parola prin polkit
    if (byKind.flatpak.some((i) => i.installation !== 'user')) res.needsPassword = true;
    res.sections.push({
      title: kindLabel('flatpak'),
      lines: byKind.flatpak.map((i) => ({ text: i.name, sub: `${i.appId} · ${i.installation === 'user' ? t('onlyYou') : t('wholeSystem')}`, size: humanSize(i.size) })),
    });
  }
  if (byKind.snap) {
    res.needsPassword = true;
    res.sections.push({ title: kindLabel('snap'), lines: byKind.snap.map((i) => ({ text: i.name, sub: i.snap, size: humanSize(i.size) })) });
  }
  for (const kind of ['appimage', 'manual', 'shortcut']) {
    if (!byKind[kind]) continue;
    const lines = [];
    for (const it of byKind[kind]) {
      for (const f of await filesFor(d, it)) {
        if (!d.isHome(f)) res.needsPassword = true;
        lines.push({ text: path.basename(f), sub: f, size: f === it.installDir || f === it.path ? humanSize(it.size) : '' });
      }
    }
    res.sections.push({ title: kindLabel(kind), lines });
  }

  for (const it of items) {
    if (it.kind === 'shortcut') continue;
    for (const l of await findLeftovers(d, it)) {
      if (!res.leftovers.some((x) => x.path === l.path)) res.leftovers.push({ ...l, app: it.name });
    }
  }
  return res;
}

// ---------------------------------------------------------------- dezinstalare
async function uninstall(items, options, progress = () => {}, overrides) {
  const d = makeDeps(overrides);
  const chosen = new Set(options.leftovers || []);
  const log = [];
  const failed = [];
  const note = (t) => { log.push(t); progress(t); };

  const byKind = {};
  for (const it of items) if (!it.protected) (byKind[it.kind] = byKind[it.kind] || []).push(it);

  if (byKind.rpm) {
    const names = byKind.rpm.map((i) => i.pkg);
    note(t('progRemoving', names.join(', ')));
    const r = await d.root(['rpm-remove', ...names]);
    log.push(r.stdout, r.stderr);
    if (AUTH_FAILED(r)) return { ok: false, cancelled: true, log: log.join('\n') };
    if (r.code !== 0) failed.push(...byKind.rpm.map((i) => i.name));
  }

  for (const it of byKind.flatpak || []) {
    note(t('progRemovingKind', it.name, 'Flatpak'));
    const args = ['uninstall', '-y', '--noninteractive', it.installation === 'user' ? '--user' : '--system'];
    if (it.dataDir && chosen.has(it.dataDir)) { args.push('--delete-data'); chosen.delete(it.dataDir); }
    args.push(it.appId);
    const r = await d.ctx.run('flatpak', args, { timeout: 30 * 60 * 1000 });
    log.push(r.stdout, r.stderr);
    if (r.code !== 0) failed.push(it.name);
  }

  for (const it of byKind.snap || []) {
    note(t('progRemovingKind', it.name, 'Snap'));
    // --purge nu atinge ~/snap/<nume>; folderul rămâne în „chosen” și ajunge în Coș mai jos
    const purge = it.dataDir && chosen.has(it.dataDir);
    const r = await d.root(['snap-remove', it.snap, ...(purge ? ['--purge'] : [])]);
    log.push(r.stdout, r.stderr);
    if (AUTH_FAILED(r)) return { ok: false, cancelled: true, log: log.join('\n') };
    if (r.code !== 0) failed.push(it.name);
  }

  for (const kind of ['appimage', 'manual', 'shortcut']) {
    for (const it of byKind[kind] || []) {
      note(t('progEliminating', it.name));
      const files = await filesFor(d, it);
      const home = files.filter((f) => d.isHome(f));
      const sys = files.filter((f) => !d.isHome(f));
      let ok = true;
      for (const f of home) {
        try { if (await exists(f)) await d.trash(f); } catch (e) { ok = false; log.push(t('trashFailed', f, e.message)); }
      }
      if (sys.length) {
        const r = await d.root(['rm-paths', ...sys]);
        log.push(r.stdout, r.stderr);
        if (AUTH_FAILED(r)) return { ok: false, cancelled: true, log: log.join('\n') };
        if (r.code !== 0) ok = false;
      }
      if (!ok) failed.push(it.name);
    }
  }

  const rest = [...chosen].filter((p) => d.isHome(p));
  if (rest.length) {
    note(t('progLeftovers'));
    for (const p of rest) {
      try { if (await exists(p)) await d.trash(p); } catch (e) { log.push(t('trashFailed', p, e.message)); }
    }
  }

  await d.ctx.run('update-desktop-database', [d.ctx.hp('.local/share/applications')], { timeout: 15000 });
  return { ok: failed.length === 0, failed, log: log.filter(Boolean).join('\n').trim() };
}

async function cleanUnusedFlatpak(progress = () => {}) {
  progress(t('flatpakSearching'));
  const out = [];
  let removed = 0;
  for (const scope of ['--user', '--system']) {
    const r = await run('flatpak', ['uninstall', '--unused', '-y', '--noninteractive', scope], { timeout: 30 * 60 * 1000 });
    out.push(r.stdout, r.stderr);
    removed += (r.stdout.match(/^\s*\d+\.\s/gm) || []).length;
  }
  const text = out.join('\n');
  return { ok: true, removed, nothing: /Nothing unused/i.test(text) && removed === 0, log: text };
}

module.exports = { preview, uninstall, cleanUnusedFlatpak, parseDnfRemove, findLeftovers, filesFor, makeDeps };
