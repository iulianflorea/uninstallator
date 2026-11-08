'use strict';
const path = require('path');
const {
  makeContext, readdirSafe, statSafe, exists, pool, parseHumanSize, dirSize, fsp,
} = require('./util');
const { parseDesktopFile, execProgram, buildIconIndex, resolveIcon } = require('./desktop');
const { t, getLang } = require('./i18n');

const SELF_PKG = 'dezinstalator';

// Pachete fără de care sistemul nu mai pornește sau nu mai are interfață.
const PROTECTED = [
  /^kernel(-.*)?$/, /^systemd(-.*)?$/, /^glibc(-.*)?$/, /^dnf5?(-.*)?$/, /^libdnf5?(-.*)?$/, /^rpm(-.*)?$/,
  /^bash$/, /^coreutils(-.*)?$/, /^util-linux(-.*)?$/, /^filesystem$/, /^setup$/, /^basesystem$/,
  /^fedora-(release|repos|gpg-keys|logos).*$/, /^generic-release.*$/, /^sudo$/, /^polkit(-.*)?$/, /^pam$/,
  /^gnome-shell$/, /^gnome-session.*$/, /^gdm$/, /^mutter$/, /^gnome-control-center.*$/, /^nautilus$/,
  /^plasma-workspace$/, /^plasma-desktop$/, /^sddm$/, /^kwin.*$/,
  /^NetworkManager(-.*)?$/, /^dbus(-.*)?$/, /^linux-firmware.*$/, /^grub2.*$/, /^shim.*$/, /^dracut.*$/,
  /^selinux-policy.*$/, /^xorg-x11-server.*$/, /^xwayland.*$/i, /^mesa-.*$/, /^pipewire(-.*)?$/,
  /^wireplumber.*$/, /^gnome-software$/, /^PackageKit.*$/, /^flatpak$/, /^ostree.*$/, /^python3$/, /^python3-libs$/,
  /^openssl(-libs)?$/, /^glib2$/, /^gtk[34]$/, /^libadwaita$/, /^passwd$/, /^shadow-utils$/, /^audit$/,
];
const isProtected = (name) => PROTECTED.some((r) => r.test(name));

const FEDORA_REPOS = /^(fedora|updates|updates-testing|fedora-cisco-openh264|anaconda|@System|System)$/;

// Repo-uri temporare (ex. din instalatorul Fedora) au ca nume un hash; acolo contează producătorul.
const HASH_REPO = /^[0-9a-f]{24,}$/i;

function rpmSourceLabel(fromRepo, vendor) {
  if (fromRepo && !HASH_REPO.test(fromRepo)) {
    if (FEDORA_REPOS.test(fromRepo)) return { label: t('srcFedora'), external: false };
    if (fromRepo === '@commandline' || fromRepo === 'commandline') return { label: t('srcCommandline'), external: true };
    if (/^rpmfusion/.test(fromRepo)) return { label: t('srcFusion'), external: true, fusion: true };
    if (/^copr:/.test(fromRepo)) return { label: t('srcCopr', fromRepo.split(':').slice(-2).join('/')), external: true };
    return { label: t('srcRepo', fromRepo), external: true };
  }
  if (vendor === 'Fedora Project') return { label: t('srcFedora'), external: false };
  if (/RPM Fusion/i.test(vendor)) return { label: t('srcFusion'), external: true, fusion: true };
  if (!vendor || vendor === '(none)') return { label: t('srcExternal'), external: true };
  return { label: vendor, external: true };
}

async function listDesktopEntries(ctx) {
  const dirs = {
    system: [ctx.p('/usr/share/applications'), ctx.p('/usr/local/share/applications')],
    flatpak: [ctx.p('/var/lib/flatpak/exports/share/applications'), ctx.hp('.local/share/flatpak/exports/share/applications')],
    snap: [ctx.p('/var/lib/snapd/desktop/applications')],
    user: [ctx.hp('.local/share/applications')],
  };
  const res = { system: [], flatpak: [], snap: [], user: [] };
  for (const [kind, list] of Object.entries(dirs)) {
    for (const d of list) {
      const files = (await readdirSafe(d)).filter((f) => (f.isFile() || f.isSymbolicLink()) && f.name.endsWith('.desktop'));
      const parsed = await pool(files, 16, (f) => parseDesktopFile(path.join(d, f.name)));
      for (const e of parsed) if (e) res[kind].push(e);
    }
  }
  return res;
}

const visible = (e) => e && e.type === 'Application' && !e.noDisplay && !e.hidden;

async function rpmOwner(ctx, file) {
  const r = await ctx.run('rpm', ['-qf', '--qf', '%{NAME}\n', '--', file], { timeout: 15000 });
  if (r.code !== 0) return null;
  const first = r.stdout.split('\n')[0].trim();
  return first && !/not owned|nu aparține/.test(first) ? first : null;
}

// ---------------------------------------------------------------- RPM
async function scanRpm(ctx, desktop, iconIndex) {
  const fmt = '%{NAME}\t%{VERSION}-%{RELEASE}\t%{ARCH}\t%{VENDOR}\t%{SIZE}\t%{INSTALLTIME}\t%{SUMMARY}\n';
  const [list, repos] = await Promise.all([
    ctx.run('rpm', ['-qa', '--qf', fmt], { timeout: 60000 }),
    ctx.run('dnf', ['repoquery', '-C', '-q', '--installed', '--qf', '%{name}\t%{from_repo}\n'], { timeout: 90000 }),
  ]);
  if (list.missing || list.code !== 0) return { items: [], sysEntries: [] };

  const fromRepo = new Map();
  if (repos.code === 0) {
    for (const line of repos.stdout.split('\n')) {
      const [n, r] = line.split('\t');
      if (n && r && !fromRepo.has(n.trim())) fromRepo.set(n.trim(), r.trim());
    }
  }

  const pkgs = new Map();
  for (const line of list.stdout.split('\n')) {
    if (!line.trim()) continue;
    const [name, ver, arch, vendor, size, itime, ...rest] = line.split('\t');
    if (!name || name.startsWith('gpg-pubkey') || name === SELF_PKG) continue;
    const prev = pkgs.get(name);
    if (prev) { prev.size += Number(size) || 0; continue; }
    pkgs.set(name, {
      name, version: ver, arch, vendor: vendor === '(none)' ? '' : vendor,
      size: Number(size) || 0, installed: (Number(itime) || 0) * 1000, summary: rest.join('\t'),
      desktops: [],
    });
  }

  // Ce pachet deține fiecare scurtătură din meniu
  const sysEntries = desktop.system.filter(visible);
  const owners = await pool(sysEntries, 12, (e) => rpmOwner(ctx, e.file));
  sysEntries.forEach((e, i) => {
    e.owner = owners[i] || null;
    if (owners[i] && pkgs.has(owners[i])) pkgs.get(owners[i]).desktops.push(e);
  });

  const items = [];
  for (const p of pkgs.values()) {
    const src = rpmSourceLabel(fromRepo.get(p.name), p.vendor);
    let main = null;
    if (p.desktops.length) {
      main = p.desktops.find((d) => d.id.toLowerCase().includes(p.name.toLowerCase()))
        || p.desktops.find((d) => d.icon) || p.desktops[0];
    }
    const isApp = !!main;
    const prot = isProtected(p.name);
    items.push({
      key: `rpm:${p.name}`,
      kind: 'rpm',
      pkg: p.name,
      name: main ? main.name : p.name,
      description: (main && main.comment) || p.summary,
      version: p.version,
      size: p.size,
      installed: p.installed || null,
      icon: main ? await resolveIcon(iconIndex, main.icon) : null,
      source: src.label,
      vendor: p.vendor,
      isApp,
      // pachetele de sistem (Fedora fără scurtătură, sau biblioteci RPM Fusion) sunt ascunse implicit
      system: !isApp && (!src.external || src.fusion),
      protected: prot,
      desktopFiles: p.desktops.map((d) => d.file),
      extraNames: p.desktops.length > 1 ? p.desktops.map((d) => d.name) : [],
    });
  }
  return { items, sysEntries };
}

// ---------------------------------------------------------------- Flatpak
async function scanFlatpak(ctx, desktop, iconIndex) {
  const r = await ctx.run('flatpak', ['list', '--app', '--columns=application,name,version,origin,installation,size,description'], { timeout: 30000 });
  if (r.missing || r.code !== 0) return { items: [], available: !r.missing };
  const items = [];
  for (const line of r.stdout.split('\n')) {
    if (!line.trim()) continue;
    const [appId, name, version, origin, installation, size, description] = line.split('\t');
    if (!appId) continue;
    const entry = desktop.flatpak.find((e) => e.id === appId || e.flatpak === appId);
    items.push({
      key: `flatpak:${installation || 'system'}:${appId}`,
      kind: 'flatpak',
      appId,
      installation: (installation || 'system').trim(),
      name: (entry && entry.name) || name || appId,
      description: (entry && entry.comment) || description || '',
      version: version || '',
      size: parseHumanSize(size),
      installed: null,
      icon: await resolveIcon(iconIndex, (entry && entry.icon) || appId),
      source: t('srcFlatpak', origin),
      isApp: true,
      system: false,
      protected: false,
      dataDir: ctx.hp('.var/app', appId),
    });
  }
  // data instalării = data folderului aplicației
  await pool(items, 8, async (it) => {
    const base = it.installation === 'user' ? ctx.hp('.local/share/flatpak/app', it.appId) : ctx.p(`/var/lib/flatpak/app/${it.appId}`);
    const st = await statSafe(base);
    if (st) it.installed = st.mtimeMs;
  });
  return { items, available: true };
}

// ---------------------------------------------------------------- Snap
const SNAP_SYSTEM = /^(core\d*|snapd|bare|gtk-common-themes|gnome-\d+-\d+.*|kde-frameworks-.*|mesa-.*)$/;
async function scanSnap(ctx, desktop, iconIndex) {
  const r = await ctx.run('snap', ['list', '--color=never', '--unicode=never'], { timeout: 30000 });
  if (r.missing || r.code !== 0) return { items: [], available: false };
  const lines = r.stdout.split('\n').filter((l) => l.trim());
  const items = [];
  for (const line of lines.slice(1)) {
    const cols = line.trim().split(/\s+/);
    const [name, version, , , publisher, notes = ''] = cols;
    if (!name) continue;
    const isBase = SNAP_SYSTEM.test(name) || /\bbase\b|\bsnapd\b|\bcore\b/.test(notes);
    const entry = desktop.snap.find((e) => e.id.startsWith(`${name}_`) || e.snap === name);
    let size = 0;
    for (const f of await readdirSafe(ctx.p('/var/lib/snapd/snaps'))) {
      if (f.name.startsWith(`${name}_`) && f.name.endsWith('.snap')) {
        const st = await statSafe(ctx.p(`/var/lib/snapd/snaps/${f.name}`));
        if (st) size += st.size;
      }
    }
    items.push({
      key: `snap:${name}`,
      kind: 'snap',
      snap: name,
      name: (entry && entry.name) || name,
      description: (entry && entry.comment) || (publisher && publisher !== '-' ? t('publishedBy', publisher.replace(/[*✓✪]+$/, '')) : ''),
      version: version || '',
      size: size || null,
      installed: null,
      icon: entry ? await resolveIcon(iconIndex, entry.icon) : null,
      source: 'Snap Store',
      isApp: !!entry,
      system: isBase,
      protected: name === 'snapd',
      dataDir: ctx.hp('snap', name),
    });
  }
  return { items, available: true };
}

// ---------------------------------------------------------------- AppImage
async function xdgDir(ctx, key, fallback) {
  try {
    const txt = await fsp.readFile(ctx.hp('.config/user-dirs.dirs'), 'utf8');
    const m = new RegExp(`^${key}="(.+)"`, 'm').exec(txt);
    if (m) return m[1].replace('$HOME', ctx.home);
  } catch { /* nimic */ }
  return ctx.hp(fallback);
}

async function isAppImageFile(file) {
  try {
    const fh = await fsp.open(file, 'r');
    const buf = Buffer.alloc(11);
    await fh.read(buf, 0, 11, 0);
    await fh.close();
    return buf[0] === 0x7f && buf[1] === 0x45 && buf[8] === 0x41 && buf[9] === 0x49 && (buf[10] === 1 || buf[10] === 2);
  } catch { return false; }
}

async function findAppImages(ctx) {
  const dedicated = ['Applications', 'AppImages', 'Apps', 'apps', '.local/bin', 'bin', '.local/share/AppImage', '.local/share/appimagekit']
    .map((d) => ctx.hp(d));
  const loose = [await xdgDir(ctx, 'XDG_DOWNLOAD_DIR', 'Downloads'), await xdgDir(ctx, 'XDG_DESKTOP_DIR', 'Desktop'), ctx.home];
  const found = new Set();
  const walk = async (dir, depth, strict) => {
    for (const f of await readdirSafe(dir)) {
      const full = path.join(dir, f.name);
      if (f.isDirectory() && depth > 0 && !f.name.startsWith('.')) await walk(full, depth - 1, strict);
      else if (f.isFile()) {
        if (/\.appimage$/i.test(f.name)) found.add(full);
        else if (!strict && !f.name.includes('.') && (await isAppImageFile(full))) found.add(full);
      }
    }
  };
  for (const d of dedicated) await walk(d, 2, false);
  for (const d of loose) await walk(d, 0, true);
  await walk(ctx.p('/opt'), 2, true);
  return [...found];
}

function prettyAppImageName(file) {
  let n = path.basename(file).replace(/\.appimage$/i, '');
  n = n.replace(/[-_. ]+(x86[_-]64|amd64|aarch64|arm64|linux|x64|i386).*$/i, '');
  n = n.replace(/[-_ ]+v?\d[\d.]*.*$/, '');
  return n.replace(/[-_]+/g, ' ').trim() || path.basename(file);
}

async function scanAppImages(ctx, desktop, iconIndex) {
  const files = await findAppImages(ctx);
  const allEntries = [...desktop.user, ...desktop.system];
  const items = [];
  for (const file of files) {
    const st = await statSafe(file);
    const base = path.basename(file);
    const linked = allEntries.filter((e) => {
      const { program } = execProgram(e.exec);
      return program === file || (program && path.basename(program) === base) || e.exec.includes(file);
    });
    linked.forEach((e) => { e.claimed = true; });
    const main = linked.find(visible) || linked[0];
    items.push({
      key: `appimage:${file}`,
      kind: 'appimage',
      path: file,
      name: (main && main.name) || prettyAppImageName(file),
      description: (main && main.comment) || t('portable'),
      version: (/[-_ ]v?(\d+(?:\.\d+)+)/.exec(base) || [])[1] || '',
      size: st ? st.size : null,
      installed: st ? st.mtimeMs : null,
      icon: main ? await resolveIcon(iconIndex, main.icon) : null,
      iconName: main ? main.icon : '',
      source: 'AppImage',
      isApp: true,
      system: false,
      protected: false,
      desktopFiles: linked.map((e) => e.file),
      location: file,
    });
  }
  return items;
}

// ---------------------------------------------------------------- Manual / scurtături
const GENERIC_DIRS = (ctx) => new Set([
  ctx.home, ctx.hp('.local'), ctx.hp('.local/bin'), ctx.hp('bin'), ctx.hp('.local/share'), ctx.hp('Desktop'),
  ctx.hp('Downloads'), ctx.hp('Applications'), ctx.hp('Apps'), ctx.hp('apps'), ctx.hp('opt'),
  ctx.p('/opt'), ctx.p('/usr/local'), ctx.p('/usr/local/bin'), ctx.p('/usr/local/share'), ctx.p('/usr/bin'), ctx.p('/usr'),
]);

async function resolveProgram(ctx, program) {
  if (!program) return null;
  let p = program;
  if (p.startsWith('~/')) p = ctx.hp(p.slice(2));
  if (!p.startsWith('/')) {
    const dirs = [ctx.hp('.local/bin'), ctx.hp('bin'), ctx.p('/usr/local/bin'), ctx.p('/usr/bin'), ctx.p('/bin'), ctx.p('/usr/sbin')];
    let hit = null;
    for (const d of dirs) if (await exists(path.join(d, p))) { hit = path.join(d, p); break; }
    if (!hit) return { path: null, real: null, link: null };
    p = hit;
  } else if (ctx.root && !p.startsWith(ctx.root)) {
    p = ctx.p(p);
  }
  let real = p;
  try { real = await fsp.realpath(p); } catch { /* nu există */ }
  const lst = await (async () => { try { return await fsp.lstat(p); } catch { return null; } })();
  return { path: p, real, link: lst && lst.isSymbolicLink() ? p : null, exists: !!lst };
}

/** Folderul de instalare al unui program copiat manual. */
function guessInstallDir(ctx, real) {
  if (!real) return null;
  const generic = GENERIC_DIRS(ctx);
  const optRoot = ctx.p('/opt') + path.sep;
  if (real.startsWith(optRoot)) {
    const top = real.slice(optRoot.length).split(path.sep)[0];
    return path.join(ctx.p('/opt'), top);
  }
  let dir = path.dirname(real);
  if (path.basename(dir) === 'bin' && !generic.has(path.dirname(dir))) dir = path.dirname(dir);
  if (generic.has(dir) || dir === path.dirname(ctx.home) || dir === '/' ) return null;
  if (!dir.startsWith(ctx.home + path.sep) && !dir.startsWith(ctx.p('/usr/local') + path.sep)) return null;
  return dir;
}

async function scanManual(ctx, desktop, iconIndex, rpmSysEntries) {
  const items = [];
  const systemIds = new Set(desktop.system.map((e) => e.id));
  const byDir = new Map();

  const candidates = [
    ...desktop.user.map((e) => ({ e, scope: 'user' })),
    ...rpmSysEntries.filter((e) => !e.owner).map((e) => ({ e, scope: 'system' })),
  ];

  for (const { e, scope } of candidates) {
    if (e.claimed || !visible(e)) continue;
    if (e.flatpak || e.snap) continue;
    const { program, args } = execProgram(e.exec);
    if (/(^|\/)flatpak$/.test(program) || /^\/snap\//.test(program) || /(^|\/)snap$/.test(program)) continue;
    if (scope === 'user' && systemIds.has(e.id)) continue; // personalizare a unei aplicații de sistem

    const prog = await resolveProgram(ctx, program);
    const owner = prog && prog.real && prog.exists ? await rpmOwner(ctx, prog.real) : null;
    const icon = await resolveIcon(iconIndex, e.icon);

    // AppImage aflat într-un loc neobișnuit, găsit doar prin scurtătură
    if (e.appimage && prog && prog.exists && !owner) {
      const st = await statSafe(prog.real);
      items.push({
        key: `appimage:${prog.real}`, kind: 'appimage', path: prog.real,
        name: e.name, description: e.comment || t('portable'), version: '',
        size: st ? st.size : null, installed: st ? st.mtimeMs : null, icon, iconName: e.icon,
        source: 'AppImage', isApp: true, system: false, protected: false,
        desktopFiles: [e.file], location: prog.real,
      });
      continue;
    }

    // Scurtătură către o aplicație deja instalată (ex. aplicații web Chrome) sau către un fișier care nu mai există
    if (owner || !prog || !prog.exists) {
      const broken = !prog || !prog.exists;
      const web = args.some((a) => /^--app(-id)?=/.test(a));
      items.push({
        key: `shortcut:${e.file}`,
        kind: 'shortcut',
        name: e.name,
        description: broken
          ? t('brokenShortcut')
          : web ? t('webApp', owner) : t('shortcutTo', owner || program),
        version: '',
        size: null,
        installed: (await statSafe(e.file))?.mtimeMs || null,
        icon,
        iconName: e.icon,
        source: broken ? t('srcBroken') : web ? t('srcWeb') : t('srcShortcut'),
        isApp: true,
        system: false,
        protected: false,
        desktopFiles: [e.file],
        scope,
        broken,
        location: e.file,
      });
      continue;
    }

    const installDir = guessInstallDir(ctx, prog.real);
    const groupKey = installDir || prog.real;
    if (byDir.has(groupKey)) { byDir.get(groupKey).desktopFiles.push(e.file); continue; }
    const extraPaths = [];
    if (prog.link) extraPaths.push(prog.link);
    if (!installDir) extraPaths.push(prog.real);
    const st = await statSafe(installDir || prog.real);
    const item = {
      key: `manual:${groupKey}`,
      kind: 'manual',
      name: e.name,
      description: e.comment || t('manualDesc'),
      version: '',
      size: null,
      installed: st ? st.mtimeMs : null,
      icon,
      iconName: e.icon,
      source: installDir && installDir.startsWith(ctx.p('/opt') + path.sep) ? t('srcManualOpt') : t('srcManual'),
      isApp: true,
      system: false,
      protected: false,
      desktopFiles: [e.file],
      installDir,
      extraPaths,
      location: installDir || prog.real,
    };
    byDir.set(groupKey, item);
    items.push(item);
  }

  // Foldere din /opt care nu aparțin niciunui pachet și n-au scurtătură
  for (const d of await readdirSafe(ctx.p('/opt'))) {
    if (!d.isDirectory()) continue;
    const full = path.join(ctx.p('/opt'), d.name);
    if (byDir.has(full) || d.name === 'Dezinstalator') continue;
    if (await rpmOwner(ctx, full)) continue;
    const st = await statSafe(full);
    const item = {
      key: `manual:${full}`,
      kind: 'manual',
      name: d.name,
      description: t('optOrphan'),
      version: '', size: null, installed: st ? st.mtimeMs : null, icon: null,
      source: t('srcManualOpt'), isApp: false, system: false, protected: false,
      desktopFiles: [], installDir: full, extraPaths: [], location: full,
    };
    byDir.set(full, item);
    items.push(item);
  }

  // Legături din /usr/local/bin către folderele găsite
  for (const f of await readdirSafe(ctx.p('/usr/local/bin'))) {
    if (!f.isSymbolicLink()) continue;
    const link = path.join(ctx.p('/usr/local/bin'), f.name);
    let real;
    try { real = await fsp.realpath(link); } catch { continue; }
    for (const it of byDir.values()) {
      if (it.installDir && real.startsWith(it.installDir + path.sep) && !it.extraPaths.includes(link)) it.extraPaths.push(link);
    }
  }

  await pool(items.filter((i) => i.kind === 'manual'), 4, async (it) => {
    if (it.installDir) it.size = await dirSize(ctx, it.installDir);
    else { const st = await statSafe(it.extraPaths[it.extraPaths.length - 1]); it.size = st ? st.size : null; }
  });
  return items;
}

// ---------------------------------------------------------------- Total
async function scanAll(overrides) {
  const ctx = makeContext(overrides);
  const t0 = Date.now();
  const [desktop, iconIndex] = await Promise.all([listDesktopEntries(ctx), buildIconIndex(ctx)]);
  const [rpm, flatpak, snap] = await Promise.all([
    scanRpm(ctx, desktop, iconIndex),
    scanFlatpak(ctx, desktop, iconIndex),
    scanSnap(ctx, desktop, iconIndex),
  ]);
  const appimages = await scanAppImages(ctx, desktop, iconIndex);
  const manual = await scanManual(ctx, desktop, iconIndex, rpm.sysEntries || []);
  const items = [...(rpm.items || []), ...flatpak.items, ...snap.items, ...appimages, ...manual];
  items.sort((a, b) => a.name.localeCompare(b.name, getLang(), { sensitivity: 'base' }));
  return {
    items,
    tools: { rpm: (rpm.items || []).length > 0, flatpak: flatpak.available, snap: snap.available },
    ms: Date.now() - t0,
  };
}

module.exports = { scanAll, isProtected, rpmSourceLabel, prettyAppImageName, guessInstallDir, listDesktopEntries };
