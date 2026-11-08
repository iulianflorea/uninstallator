'use strict';
// Teste pe un sistem simulat (folder temporar + comenzi simulate). Rulează: npm test
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const scanner = require('../src/scanner');
const un = require('../src/uninstaller');
const { splitExec, execProgram, parseDesktopText } = require('../src/desktop');
const i18n = require('../src/i18n');

let passed = 0;
const t = async (name, fn) => {
  try { await fn(); passed++; console.log('  ✓', name); } catch (e) { console.error('  ✗', name, '\n', e); process.exitCode = 1; }
};

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'dz-root-'));
const HOME = path.join(ROOT, 'home/iulian');
const w = (rel, content = '', mode) => {
  const f = rel.startsWith('/') ? path.join(ROOT, rel) : path.join(HOME, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
  if (mode) fs.chmodSync(f, mode);
  return f;
};
const desk = (name, exec, icon = '', extra = '') => `[Desktop Entry]\nType=Application\nName=${name}\nExec=${exec}\nIcon=${icon}\n${extra}`;

// ---- sistem simulat
w('/usr/share/applications/rustdesk.desktop', desk('RustDesk', '/usr/bin/rustdesk %u', 'rustdesk'));
w('/usr/share/applications/org.gnome.Nautilus.desktop', desk('Fișiere', 'nautilus --new-window', 'org.gnome.Nautilus'));
w('/usr/share/applications/hidden.desktop', desk('Ascuns', 'foo', '', 'NoDisplay=true'));
w('/usr/share/applications/postman.desktop', desk('Postman', '/opt/Postman/Postman', '/opt/Postman/icon.png'));
w('/usr/bin/rustdesk', 'bin', 0o755);
w('/usr/bin/nautilus', 'bin', 0o755);
w('/opt/Postman/Postman', 'bin', 0o755);
w('/opt/Postman/icon.png', 'png');
w('/opt/OrphanTool/run.sh', 'x');
w('/opt/google/chrome/google-chrome', 'bin', 0o755);
w('/usr/share/icons/hicolor/256x256/apps/rustdesk.png', 'png');
w('/usr/share/icons/hicolor/scalable/apps/rustdesk.svg', '<svg/>');
w('/usr/share/icons/hicolor/48x48/apps/org.gnome.Nautilus.png', 'png');
w('/var/lib/flatpak/exports/share/applications/com.spotify.Client.desktop', desk('Spotify', '/usr/bin/flatpak run com.spotify.Client', 'com.spotify.Client', 'X-Flatpak=com.spotify.Client'));
w('/var/lib/flatpak/exports/share/icons/hicolor/128x128/apps/com.spotify.Client.png', 'png');
fs.mkdirSync(path.join(ROOT, 'var/lib/flatpak/app/com.spotify.Client'), { recursive: true });
fs.mkdirSync(path.join(ROOT, 'usr/local/bin'), { recursive: true });
fs.symlinkSync(path.join(ROOT, 'opt/Postman/Postman'), path.join(ROOT, 'usr/local/bin/postman'));

// ---- home simulat
const appimg = w('AppImages/Obsidian-1.6.7.AppImage', '\x7fELF....', 0o755);
w('.local/share/applications/obsidian.desktop', desk('Obsidian', `${appimg} --no-sandbox %U`, 'obsidian'));
w('.local/share/icons/hicolor/256x256/apps/obsidian.png', 'png');
w('.local/share/applications/chrome-abc-Default.desktop', desk('YouTube', '/opt/google/chrome/google-chrome --profile-directory=Default --app-id=abc', 'chrome-abc-Default'));
w('.local/share/icons/hicolor/128x128/apps/chrome-abc-Default.png', 'png');
w('.local/share/applications/vechi.desktop', desk('Program Vechi', '/home/iulian/gone/vechi', ''));
const foo = w('apps/FooEditor/bin/fooeditor', 'bin', 0o755);
w('apps/FooEditor/lib/x.so', 'so');
w('.local/share/applications/fooeditor.desktop', desk('Foo Editor', `"${foo}" %F`, 'fooeditor'));
w('.local/share/applications/org.gnome.Nautilus.desktop', desk('Fișiere (personalizat)', 'nautilus', ''));
w('Downloads/Random-2.0-x86_64.AppImage', 'x', 0o755);
w('.config/rustdesk/RustDesk.toml', 'cfg');
w('.config/obsidian/x.json', '{}');
w('.config/git/config', 'x'); // nu trebuie considerat rest
w('.cache/fooeditor/c', 'c');
w('.var/app/com.spotify.Client/data', 'd');

const unroot = (p) => (p.startsWith(ROOT) ? p.slice(ROOT.length) : p);
const OWNERS = { '/usr/share/applications/rustdesk.desktop': 'rustdesk', '/usr/share/applications/org.gnome.Nautilus.desktop': 'nautilus',
  '/usr/bin/rustdesk': 'rustdesk', '/usr/bin/nautilus': 'nautilus', '/opt/google/chrome/google-chrome': 'google-chrome-stable',
  '/opt/google': 'google-chrome-stable', '/usr/share/applications/hidden.desktop': 'foo' };

const DNF_PREVIEW = `Package                 Arch    Version          Repository        Size
Removing:
 rustdesk               x86_64  1.4.2-0          @commandline   61.1 MiB
Removing unused dependencies:
 libxdo                 x86_64  3.20160805-26    fedora         71.3 KiB

Transaction Summary:
 Removing:          2 packages

After this operation, 61 MiB will be freed (install 0 B, remove 61 MiB).
Operation aborted by the user.
`;

const calls = [];
const fakeRun = async (cmd, args) => {
  calls.push([cmd, ...args]);
  const ok = (stdout) => ({ code: 0, stdout, stderr: '' });
  if (cmd === 'rpm' && args[0] === '-qa') {
    return ok([
      'rustdesk\t1.4.2-0\tx86_64\trustdesk\t64000000\t1730000000\tRemote desktop',
      'nautilus\t49.0-1.fc45\tx86_64\tFedora Project\t9000000\t1720000000\tFile manager',
      'glibc\t2.42-1.fc45\tx86_64\tFedora Project\t6000000\t1720000000\tC library',
      'mysql-community-server\t9.7.0-1\tx86_64\tOracle and/or its affiliates\t300000000\t1725000000\tMySQL server',
      'google-chrome-stable\t142.0-1\tx86_64\tGoogle Inc.\t350000000\t1726000000\tChrome',
      'gpg-pubkey\t1-1\tnoarch\t(none)\t0\t0\tkey',
    ].join('\n') + '\n');
  }
  if (cmd === 'dnf' && args[0] === 'repoquery') return ok('rustdesk\t@commandline\nnautilus\tfedora\nglibc\tfedora\nmysql-community-server\tmysql-9.7-community\ngoogle-chrome-stable\tgoogle-chrome\n');
  if (cmd === 'rpm' && args[0] === '-qf') {
    const f = unroot(args[args.length - 1]);
    return OWNERS[f] ? ok(OWNERS[f] + '\n') : { code: 1, stdout: `file ${f} is not owned by any package\n`, stderr: '' };
  }
  if (cmd === 'flatpak' && args[0] === 'list') return ok('com.spotify.Client\tSpotify\t1.2.50\tflathub\tsystem\t312.5 MB\tMusic\n');
  if (cmd === 'snap') return { code: -1, stdout: '', stderr: '', missing: true };
  if (cmd === 'du') return ok(`4096\t${args[args.length - 1]}\n`);
  return ok('');
};

(async () => {
  console.log('Parsare');
  await t('splitExec respectă ghilimelele și scoate %U', () => {
    assert.deepStrictEqual(splitExec('"/home/a b/x" --flag %U'), ['/home/a b/x', '--flag']);
  });
  await t('execProgram ignoră env VAR=', () => {
    assert.strictEqual(execProgram('env BAMF=1 GDK=x /snap/bin/foo %U').program, '/snap/bin/foo');
  });
  await t('parseDesktopText preferă Name[ro]', () => {
    const e = parseDesktopText('[Desktop Entry]\nType=Application\nName=Files\nName[ro]=Fișiere\nExec=x\n[Desktop Action new]\nName=Nou', 'x.desktop');
    assert.strictEqual(e.name, 'Fișiere');
  });
  await t('parseDnfRemove separă pachetele de dependențe', () => {
    const r = un.parseDnfRemove(DNF_PREVIEW);
    assert.strictEqual(r.pkgs.length, 2);
    assert.strictEqual(r.pkgs[0].name, 'rustdesk');
    assert.strictEqual(r.pkgs[1].dependency, true);
    assert.strictEqual(r.freed, '61 MiB');
  });
  await t('parseDnfRemove raportează pachete protejate', () => {
    const r = un.parseDnfRemove('Failed to resolve the transaction:\nProblem: The operation would result in removing the following protected packages: sudo\n');
    assert.strictEqual(r.pkgs.length, 0);
    assert.ok(/protected/.test(r.problem));
  });
  await t('parseDnfRemove (dnf5): scoate epoca 0: și normalizează mărimea', () => {
    const r = un.parseDnfRemove('Package Arch Version Repository Size\nRemoving:\n nano  x86_64 0:9.2-1.fc45 fedora  2.9 MiB\nRemoving dependent packages:\n default-editor noarch 0:9.2-1.fc45 fedora  0.0   B\n');
    assert.strictEqual(r.pkgs.length, 2);
    assert.strictEqual(r.pkgs[0].version, '9.2-1.fc45');
    assert.strictEqual(r.pkgs[1].size, '0.0 B');
    assert.strictEqual(r.pkgs[1].dependency, false);
  });
  await t('repo cu nume hash + producător Fedora → pachet Fedora', () => {
    assert.deepStrictEqual(scanner.rpmSourceLabel('19278be6a81040f5b6cbc7bacea5148e', 'Fedora Project'), { label: 'Fedora', external: false });
    assert.strictEqual(scanner.rpmSourceLabel('19278be6a81040f5b6cbc7bacea5148e', 'Acme').external, true);
  });
  await t('traduceri: engleză în backend și Name[en] din .desktop', () => {
    i18n.setLang('en');
    try {
      assert.strictEqual(scanner.rpmSourceLabel('@commandline', '').label, 'Downloaded .rpm file');
      const e = parseDesktopText('[Desktop Entry]\nType=Application\nName=Fișiere\nName[en_GB]=Files\nExec=x', 'x.desktop');
      assert.strictEqual(e.name, 'Files');
      assert.strictEqual(require('../src/util').humanSize(1500000), '1.5 MB');
    } finally { i18n.setLang('ro'); }
    assert.strictEqual(require('../src/util').humanSize(1500000), '1,5 MB');
    for (const k of Object.keys(i18n.STR.ro)) assert.ok(k in i18n.STR.en, `lipsește traducerea ${k}`);
  });
  await t('nume frumos pentru AppImage', () => {
    assert.strictEqual(scanner.prettyAppImageName('/x/Obsidian-1.6.7.AppImage'), 'Obsidian');
    assert.strictEqual(scanner.prettyAppImageName('/x/LM_Studio-0.3.5-x86_64.AppImage'), 'LM Studio');
  });

  console.log('Scanare');
  const res = await scanner.scanAll({ root: ROOT, home: HOME, run: fakeRun });
  const by = (k) => res.items.find((i) => i.key === k);
  const names = res.items.map((i) => `${i.kind}:${i.name}`);
  await t('RustDesk RPM e aplicație, cu iconiță svg și sursă „Fișier .rpm descărcat”', () => {
    const r = by('rpm:rustdesk');
    assert.ok(r && r.isApp && !r.system);
    assert.ok(r.icon.endsWith('scalable/apps/rustdesk.svg'), r.icon);
    assert.strictEqual(r.source, 'Fișier .rpm descărcat');
  });
  await t('glibc e pachet de sistem protejat', () => {
    const g = by('rpm:glibc'); assert.ok(g.system && g.protected);
  });
  await t('MySQL (repo extern, fără interfață) apare în aplicații', () => {
    const m = by('rpm:mysql-community-server'); assert.ok(m && !m.system); assert.strictEqual(m.source, 'Repo mysql-9.7-community');
  });
  await t('Flatpak Spotify cu iconiță și folder de date', () => {
    const s = by('flatpak:system:com.spotify.Client');
    assert.ok(s && s.icon && s.icon.endsWith('com.spotify.Client.png'));
    assert.strictEqual(s.size, 312500000);
  });
  await t('AppImage Obsidian legat de scurtătura lui', () => {
    const a = by(`appimage:${appimg}`);
    assert.ok(a, names.join(', '));
    assert.strictEqual(a.name, 'Obsidian');
    assert.strictEqual(a.desktopFiles.length, 1);
  });
  await t('AppImage din Downloads e găsit', () => {
    assert.ok(res.items.some((i) => i.kind === 'appimage' && i.name === 'Random'));
  });
  await t('Program manual Foo Editor → folderul ~/apps/FooEditor', () => {
    const f = res.items.find((i) => i.kind === 'manual' && i.name === 'Foo Editor');
    assert.ok(f, names.join(', '));
    assert.strictEqual(f.installDir, path.join(HOME, 'apps/FooEditor'));
  });
  await t('Postman în /opt, cu legătura din /usr/local/bin', () => {
    const p = res.items.find((i) => i.kind === 'manual' && i.name === 'Postman');
    assert.ok(p, names.join(', '));
    assert.strictEqual(p.installDir, path.join(ROOT, 'opt/Postman'));
    assert.ok(p.extraPaths.some((x) => x.endsWith('usr/local/bin/postman')));
  });
  await t('Folder orfan /opt/OrphanTool apare, /opt/google (deținut de RPM) nu', () => {
    assert.ok(res.items.some((i) => i.name === 'OrphanTool'));
    assert.ok(!res.items.some((i) => i.kind === 'manual' && i.name === 'google'));
  });
  await t('Aplicația web Chrome e scurtătură, iar cea ruptă e marcată', () => {
    const y = res.items.find((i) => i.name === 'YouTube');
    assert.strictEqual(y.kind, 'shortcut'); assert.strictEqual(y.source, 'Aplicație web');
    const v = res.items.find((i) => i.name === 'Program Vechi');
    assert.ok(v.broken);
  });
  await t('Personalizarea Nautilus din home nu e listată separat', () => {
    assert.ok(!res.items.some((i) => i.name === 'Fișiere (personalizat)'));
  });
  await t('Scurtăturile ascunse și cheile gpg nu apar', () => {
    assert.ok(!res.items.some((i) => i.name === 'Ascuns' || i.pkg === 'gpg-pubkey'));
  });

  console.log('Previzualizare și dezinstalare');
  const rootCalls = [];
  const trashed = [];
  const ov = {
    root: ROOT, home: HOME, run: fakeRun,
    rootRun: async (args) => { rootCalls.push(args); return args[0] === 'rpm-preview' ? { code: 0, stdout: DNF_PREVIEW, stderr: '' } : { code: 0, stdout: 'ok', stderr: '' }; },
    trash: async (p) => { trashed.push(p); fs.rmSync(p, { recursive: true, force: true }); },
  };
  await t('Previzualizare RustDesk: pachete + setări rămase', async () => {
    const p = await un.preview([by('rpm:rustdesk')], ov);
    assert.strictEqual(p.blocked, null);
    assert.strictEqual(p.sections[0].lines[0].text, 'rustdesk');
    assert.strictEqual(p.sections[1].title, 'Dependențe care nu mai sunt folosite');
    assert.ok(p.leftovers.some((l) => l.path === path.join(HOME, '.config/rustdesk')));
    assert.ok(p.needsPassword);
  });
  await t('Pachetele protejate sunt blocate fără să ceară parola', async () => {
    const n = rootCalls.length;
    const p = await un.preview([by('rpm:glibc')], ov);
    assert.ok(p.blocked); assert.strictEqual(rootCalls.length, n);
  });
  await t('Previzualizare Obsidian: fișier, scurtătură, iconiță, setări', async () => {
    const p = await un.preview([by(`appimage:${appimg}`)], ov);
    const all = p.sections.flatMap((s) => s.lines.map((l) => l.sub));
    assert.ok(all.includes(appimg));
    assert.ok(all.some((x) => x.endsWith('obsidian.desktop')));
    assert.ok(all.some((x) => x.endsWith('256x256/apps/obsidian.png')));
    assert.ok(p.leftovers.some((l) => l.path.endsWith('.config/obsidian')));
    assert.ok(!p.leftovers.some((l) => l.path.endsWith('.config/git')));
    assert.ok(!p.needsPassword);
  });
  await t('Dezinstalare Obsidian + setări → totul în Coș, fără parolă', async () => {
    const before = rootCalls.length;
    const r = await un.uninstall([by(`appimage:${appimg}`)], { leftovers: [path.join(HOME, '.config/obsidian')] }, () => {}, ov);
    assert.ok(r.ok, r.log);
    assert.ok(!fs.existsSync(appimg));
    assert.ok(trashed.some((x) => x.endsWith('.config/obsidian')));
    assert.strictEqual(rootCalls.length, before);
  });
  await t('Dezinstalare Postman → ștergere privilegiată pentru /opt și /usr/local/bin', async () => {
    const p = res.items.find((i) => i.name === 'Postman');
    const r = await un.uninstall([p], {}, () => {}, ov);
    assert.ok(r.ok);
    const last = rootCalls[rootCalls.length - 1];
    assert.strictEqual(last[0], 'rm-paths');
    assert.ok(last.includes(path.join(ROOT, 'opt/Postman')));
  });
  await t('Dezinstalare Flatpak cu date → --delete-data', async () => {
    const s = by('flatpak:system:com.spotify.Client');
    await un.uninstall([s], { leftovers: [s.dataDir] }, () => {}, ov);
    const c = calls.filter((x) => x[0] === 'flatpak' && x[1] === 'uninstall').pop();
    assert.ok(c.includes('--delete-data') && c.includes('--system') && c.includes('com.spotify.Client'));
  });
  await t('Flatpak de sistem → avertizează că poate cere parola', async () => {
    const p = await un.preview([by('flatpak:system:com.spotify.Client')], ov);
    assert.ok(p.needsPassword);
  });
  await t('Parola refuzată → anulare curată', async () => {
    const r = await un.uninstall([by('rpm:rustdesk')], {}, () => {}, { ...ov, rootRun: async () => ({ code: 126, stdout: '', stderr: '' }) });
    assert.ok(r.cancelled);
  });

  console.log(`\n${passed} teste trecute${process.exitCode ? ', unele au eșuat' : ''}.`);
  fs.rmSync(ROOT, { recursive: true, force: true });
})();
