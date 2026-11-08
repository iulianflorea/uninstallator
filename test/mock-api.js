// API simulat pentru previzualizarea interfeței într-un browser obișnuit (fără Electron).
// API simulat, ca interfața să poată fi văzută într-un browser obișnuit.
        const ic = (n) => decodeURI(new URL('../../test/fixtures/' + n + '.svg', document.baseURI).pathname);
    const day = 86400000, now = Date.now();
    const items = [
      { key: 'rpm:rustdesk', kind: 'rpm', pkg: 'rustdesk', name: 'RustDesk', description: 'Acces la distanță, open source', version: '1.4.2-0', size: 64e6, installed: now - 40 * day, icon: ic('rustdesk'), source: 'Fișier .rpm descărcat', vendor: 'rustdesk', isApp: true, system: false, location: '' },
      { key: 'flatpak:system:com.spotify.Client', kind: 'flatpak', appId: 'com.spotify.Client', installation: 'system', name: 'Spotify', description: 'Muzică pentru toată lumea', version: '1.2.50', size: 312e6, installed: now - 90 * day, icon: ic('spotify'), source: 'Flatpak · flathub', isApp: true, system: false },
      { key: 'appimage:/home/iulian/AppImages/Obsidian.AppImage', kind: 'appimage', name: 'Obsidian', description: 'Notițe în Markdown, legate între ele', version: '1.6.7', size: 118e6, installed: now - 3 * day, icon: ic('obsidian'), source: 'AppImage', isApp: true, system: false, location: '/home/iulian/AppImages/Obsidian-1.6.7.AppImage' },
      { key: 'rpm:code', kind: 'rpm', pkg: 'code', name: 'Visual Studio Code', description: 'Editor de cod. Redefinit.', version: '1.105.1', size: 412e6, installed: now - 12 * day, icon: ic('vscode'), source: 'Repo code', vendor: 'Microsoft', isApp: true, system: false },
      { key: 'rpm:google-chrome-stable', kind: 'rpm', pkg: 'google-chrome-stable', name: 'Google Chrome', description: 'Navigator web', version: '142.0.7444.59-1', size: 358e6, installed: now - 60 * day, icon: ic('chrome'), source: 'Repo google-chrome', vendor: 'Google LLC', isApp: true, system: false },
      { key: 'flatpak:system:org.gimp.GIMP', kind: 'flatpak', appId: 'org.gimp.GIMP', installation: 'system', name: 'GNU Image Manipulation Program', description: 'Editare de imagini', version: '3.0.6', size: 401e6, installed: now - 120 * day, icon: ic('gimp'), source: 'Flatpak · flathub', isApp: true, system: false },
      { key: 'manual:/opt/Postman', kind: 'manual', name: 'Postman', description: 'Platformă pentru API-uri', version: '', size: 520e6, installed: now - 200 * day, icon: ic('postman'), source: 'Instalat manual în /opt', isApp: true, system: false, location: '/opt/Postman' },
      { key: 'flatpak:user:com.discordapp.Discord', kind: 'flatpak', appId: 'com.discordapp.Discord', installation: 'user', name: 'Discord', description: 'Vorbește, discută, petrece timp', version: '0.0.112', size: 98e6, installed: now - 5 * day, icon: ic('discord'), source: 'Flatpak · flathub', isApp: true, system: false },
      { key: 'rpm:blender', kind: 'rpm', pkg: 'blender', name: 'Blender', description: 'Creație 3D', version: '4.5.3-1.fc45', size: 890e6, installed: now - 30 * day, icon: ic('blender'), source: 'Fedora', vendor: 'Fedora Project', isApp: true, system: false },
      { key: 'rpm:libreoffice-writer', kind: 'rpm', pkg: 'libreoffice-writer', name: 'LibreOffice Writer', description: 'Procesor de text', version: '25.8.2.2-1.fc45', size: 41e6, installed: now - 150 * day, icon: ic('libre'), source: 'Fedora', vendor: 'Fedora Project', isApp: true, system: false },
      { key: 'rpm:docker-ce', kind: 'rpm', pkg: 'docker-ce', name: 'docker-ce', description: 'The open-source application container engine', version: '29.0.1-1.fc45', size: 98e6, installed: now - 25 * day, icon: null, source: 'Repo docker-ce-stable', vendor: 'Docker', isApp: false, system: false },
      { key: 'rpm:mysql-community-server', kind: 'rpm', pkg: 'mysql-community-server', name: 'mysql-community-server', description: 'A very fast and reliable SQL database server', version: '9.7.0-1.fc44', size: 302e6, installed: now - 70 * day, icon: null, source: 'Repo mysql-9.7-community', vendor: 'Oracle', isApp: false, system: false },
      { key: 'shortcut:/home/iulian/.local/share/applications/chrome-yt.desktop', kind: 'shortcut', name: 'YouTube', description: 'Aplicație web (google-chrome-stable)', version: '', size: null, installed: now - 9 * day, icon: null, source: 'Aplicație web', isApp: true, system: false, location: '/home/iulian/.local/share/applications/chrome-yt.desktop' },
      { key: 'manual:/home/iulian/apps/LM-Studio', kind: 'manual', name: 'LM Studio', description: 'Rulează modele AI local', version: '', size: 1.2e9, installed: now - 15 * day, icon: null, source: 'Instalat manual', isApp: true, system: false, location: '/home/iulian/apps/LM-Studio' },
      { key: 'rpm:glibc', kind: 'rpm', pkg: 'glibc', name: 'glibc', description: 'The GNU libc libraries', version: '2.42-3.fc45', size: 6.2e6, installed: now - 400 * day, icon: null, source: 'Fedora', vendor: 'Fedora Project', isApp: false, system: true, protected: true },
      { key: 'rpm:libxdo', kind: 'rpm', pkg: 'libxdo', name: 'libxdo', description: 'Shared library for xdotool', version: '3.20160805-26', size: 71e3, installed: now - 40 * day, icon: null, source: 'Fedora', vendor: 'Fedora Project', isApp: false, system: true },
    ];
    const params = new URLSearchParams(location.search);
    window.api = {
      scan: () => new Promise((r) => setTimeout(() => r({ items, tools: { rpm: true, flatpak: true, snap: false } }), 50)),
      preview: async () => ({
        sections: [
          { title: 'Pachete RPM', lines: [{ text: 'rustdesk', sub: '1.4.2-0 · @commandline', size: '61.1 MiB' }] },
          { title: 'Dependențe care nu mai sunt folosite', lines: [{ text: 'libxdo', sub: '3.20160805-26', size: '71.3 KiB' }] },
        ],
        leftovers: [
          { path: '/home/iulian/.config/rustdesk', label: 'Setări', sizeText: '24 KB', app: 'RustDesk' },
          { path: '/home/iulian/.local/share/rustdesk', label: 'Date', sizeText: '1.2 MB', app: 'RustDesk' },
        ],
        warnings: [], needsPassword: true, totalFreed: '61 MiB', blocked: null,
      }),
      uninstall: async () => ({ ok: true }),
      cleanFlatpak: async () => ({ ok: true, nothing: true }),
      showInFolder: async () => {},
      getTheme: async () => ({ dark: params.get('theme') !== 'light' }),
      setTheme: async (m) => ({ dark: m === 'dark' || (m === 'system' && params.get('theme') !== 'light') }),
      win: () => {}, onProgress: () => {}, onTheme: () => {}, onWindowState: () => {},
    };
    try { localStorage.setItem('theme', params.get('theme') === 'light' ? 'light' : 'dark'); } catch {}

// Stări de demonstrație: preview.html?open=details|confirm|select|system
window.addEventListener('load', () => setTimeout(() => {
  const o = params.get('open');
  const card = (k) => document.querySelector(`.card[data-key="${k}"]`);
  if (o === 'details' || o === 'confirm') card('rpm:rustdesk').click();
  if (o === 'confirm') setTimeout(() => document.querySelector('[data-act=uninstall]').click(), 100);
  if (o === 'confirm') setTimeout(() => { const t = document.querySelector('#allLeft'); t.checked = true; t.dispatchEvent(new Event('change')); }, 400);
  if (o === 'select') ['flatpak:user:com.discordapp.Discord', 'manual:/opt/Postman', 'rpm:mysql-community-server'].forEach((k) => card(k).querySelector('[data-check]').click());
  if (o === 'system') document.querySelector('[data-view=system]').click();
}, 300));
