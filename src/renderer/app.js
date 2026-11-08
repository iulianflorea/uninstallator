'use strict';
/* global api */

// ------------------------------------------------------------ iconițe
const I = {
  all: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/></svg>',
  rpm: '<svg viewBox="0 0 24 24"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/></svg>',
  flatpak: '<svg viewBox="0 0 24 24"><path d="M12 3l8.5 4.5L12 12 3.5 7.5z"/><path d="M3.5 12L12 16.5 20.5 12M3.5 16.5L12 21l8.5-4.5"/></svg>',
  appimage: '<svg viewBox="0 0 24 24"><path d="M5 19c1.5-1 3-1.5 3-1.5S7 15 7 13c0-5 5-9.5 12-10 0 7-4.5 12-9.5 12-2 0-4.5-1-4.5-1"/><circle cx="14" cy="9" r="1.6"/></svg>',
  snap: '<svg viewBox="0 0 24 24"><path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z"/></svg>',
  manual: '<svg viewBox="0 0 24 24"><path d="M14.5 6.5a4 4 0 00-5.3 5.2L3.5 17.4a1.6 1.6 0 002.2 2.2l5.7-5.7a4 4 0 005.2-5.3l-2.4 2.4-2.3-.6-.6-2.3z"/></svg>',
  system: '<svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2.4"/><path d="M8 10.5V8a4 4 0 018 0v2.5"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l.9 12.2a1.8 1.8 0 001.8 1.6h5.6a1.8 1.8 0 001.8-1.6L17.5 7"/></svg>',
  folder: '<svg viewBox="0 0 24 24"><path d="M3.5 7.5a2 2 0 012-2h4l2 2h7a2 2 0 012 2v8a2 2 0 01-2 2h-13a2 2 0 01-2-2z"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  warn: '<svg viewBox="0 0 24 24"><path d="M12 4l9 16H3z"/><path d="M12 10v4.5M12 17.5v.01"/></svg>',
  info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.01"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><rect x="5.5" y="10.5" width="13" height="9.5" rx="2.2"/><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5"/></svg>',
  undo: '<svg viewBox="0 0 24 24"><path d="M9 14L4.5 9.5 9 5"/><path d="M4.5 9.5H15a5 5 0 010 10h-3"/></svg>',
};

const KIND = {
  rpm: { label: 'RPM', cls: 'rpm' },
  flatpak: { label: 'Flatpak', cls: 'flatpak' },
  appimage: { label: 'AppImage', cls: 'appimage' },
  snap: { label: 'Snap', cls: 'snap' },
  manual: { label: 'Manual', cls: 'manual' },
  shortcut: { label: 'Scurtătură', cls: 'shortcut' },
};

const VIEWS = [
  { id: 'all', title: 'Toate aplicațiile', icon: 'all', color: 'linear-gradient(160deg,#5e9bff,#2f5bff)', filter: (i) => !i.system },
  { id: 'rpm', title: 'Aplicații RPM', icon: 'rpm', color: 'linear-gradient(160deg,#4fb3ff,#0a6cff)', filter: (i) => i.kind === 'rpm' && !i.system },
  { id: 'flatpak', title: 'Flatpak', icon: 'flatpak', color: 'linear-gradient(160deg,#d58bff,#8a3dff)', filter: (i) => i.kind === 'flatpak' },
  { id: 'appimage', title: 'AppImage', icon: 'appimage', color: 'linear-gradient(160deg,#ffc15e,#ff7a00)', filter: (i) => i.kind === 'appimage' },
  { id: 'snap', title: 'Snap', icon: 'snap', color: 'linear-gradient(160deg,#6ee68a,#1fb04a)', filter: (i) => i.kind === 'snap' && !i.system, needs: 'snap' },
  { id: 'manual', title: 'Instalate manual', icon: 'manual', color: 'linear-gradient(160deg,#6fe0f0,#1597b8)', filter: (i) => i.kind === 'manual' || i.kind === 'shortcut' },
  { id: 'system', title: 'Pachete de sistem', icon: 'system', color: 'linear-gradient(160deg,#a3a3ad,#5f5f6b)', filter: (i) => i.system, sep: true },
];

const state = {
  items: [], tools: {}, view: 'all', q: '', sort: 'name', selected: new Set(), loading: true, byKey: new Map(),
};

// ------------------------------------------------------------ utilitare
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fileUrl = (p) => 'file://' + p.split('/').map(encodeURIComponent).join('/');
function humanSize(b) {
  if (b == null || isNaN(b) || b <= 0) return '';
  const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0; let n = b;
  while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return `${(n >= 100 || i === 0 ? Math.round(n) : n.toFixed(1)).toString().replace('.', ',')} ${u[i]}`;
}
const fmtDate = (ms) => (ms ? new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(ms)) : '');
const plural = (n, one, many) => `${n.toLocaleString('ro-RO')} ${n === 1 ? one : (n !== 0 && (n % 100 >= 20 || n % 100 === 0) ? `de ${many}` : many)}`;
function hue(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }

function iconHtml(item) {
  const letter = esc((item.name || '?').trim().charAt(0).toUpperCase());
  const h = hue(item.name || '');
  const fb = `<div class="fallback-icon" style="background:linear-gradient(160deg,hsl(${h} 80% 62%),hsl(${(h + 40) % 360} 75% 45%))">${letter}</div>`;
  if (!item.icon) return `<div class="app-icon">${fb}</div>`;
  return `<div class="app-icon"><img src="${esc(fileUrl(item.icon))}" alt="" loading="lazy" data-fb="${esc(fb)}"></div>`;
}
document.addEventListener('error', (e) => {
  const img = e.target;
  if (img.tagName === 'IMG' && img.dataset.fb) img.outerHTML = img.dataset.fb;
}, true);

function toast(text, type = 'ok') {
  const el = document.createElement('div');
  el.className = `toast glass ${type === 'err' ? 'err' : ''}`;
  el.innerHTML = `${type === 'err' ? I.warn : I.check}<span>${esc(text)}</span>`;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 3800);
}

// ------------------------------------------------------------ temă
let themeMode = 'system';
try { themeMode = localStorage.getItem('theme') || 'system'; } catch { /* nimic */ }
function applyTheme(dark) {
  document.body.classList.toggle('dark', dark);
  document.body.classList.toggle('light', !dark);
}
async function setTheme(mode) {
  themeMode = mode;
  try { localStorage.setItem('theme', mode); } catch { /* nimic */ }
  document.querySelectorAll('#themeSeg button').forEach((b) => b.classList.toggle('on', b.dataset.theme === mode));
  const r = await api.setTheme(mode);
  applyTheme(r.dark);
}
api.onTheme((t) => applyTheme(t.dark));
$('#themeSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setTheme(b.dataset.theme); });

// ------------------------------------------------------------ fereastră
document.querySelectorAll('[data-win]').forEach((b) => b.addEventListener('click', () => api.win(b.dataset.win)));
$('.side-top').addEventListener('dblclick', (e) => { if (!e.target.closest('button')) api.win('max'); });
$('.topbar').addEventListener('dblclick', (e) => { if (!e.target.closest('.tools')) api.win('max'); });

// ------------------------------------------------------------ date
async function load({ quiet } = {}) {
  state.loading = !quiet;
  $('#refresh').classList.add('spin');
  if (!quiet) render();
  try {
    const res = await api.scan();
    state.items = res.items;
    state.tools = res.tools;
    state.byKey = new Map(res.items.map((i) => [i.key, i]));
    for (const k of [...state.selected]) if (!state.byKey.has(k)) state.selected.delete(k);
  } catch (e) {
    toast('Nu am putut citi lista de aplicații', 'err');
    console.error(e);
  }
  state.loading = false;
  $('#refresh').classList.remove('spin');
  $('#cleanFlatpak').hidden = !state.tools.flatpak;
  render();
}

function visibleItems() {
  const v = VIEWS.find((x) => x.id === state.view) || VIEWS[0];
  const q = state.q.trim().toLowerCase();
  let list = state.items.filter(v.filter);
  if (q) {
    list = list.filter((i) => [i.name, i.description, i.pkg, i.appId, i.snap, i.path, i.source]
      .some((s) => s && String(s).toLowerCase().includes(q)));
  }
  const by = {
    name: (a, b) => a.name.localeCompare(b.name, 'ro', { sensitivity: 'base' }),
    size: (a, b) => (b.size || 0) - (a.size || 0),
    recent: (a, b) => (b.installed || 0) - (a.installed || 0),
  }[state.sort];
  return list.sort(by);
}

// ------------------------------------------------------------ randare
function renderNav() {
  const counts = Object.fromEntries(VIEWS.map((v) => [v.id, state.items.filter(v.filter).length]));
  let html = '';
  for (const v of VIEWS) {
    if (v.needs && !state.tools[v.needs] && !counts[v.id]) continue;
    if (v.id !== 'all' && v.id !== 'system' && !counts[v.id] && !state.loading) continue;
    if (v.sep) html += '<div class="nav-label">Avansat</div>';
    else if (v.id === 'rpm') html += '<div class="nav-label">După sursă</div>';
    html += `<button class="nav-item ${state.view === v.id ? 'active' : ''}" data-view="${v.id}">
      <span class="ico" style="background:${v.color}">${I[v.icon]}</span>
      <span class="label">${esc(v.title)}</span>
      <span class="count">${state.loading ? '' : counts[v.id]}</span></button>`;
  }
  $('#nav').innerHTML = html;
  const total = counts.all;
  const size = state.items.filter((i) => !i.system).reduce((s, i) => s + (i.size || 0), 0);
  $('#brandSub').textContent = state.loading ? 'Se caută aplicațiile…' : `${plural(total, 'aplicație', 'aplicații')} · ${humanSize(size)}`;
}

function cardHtml(item, i) {
  const k = KIND[item.kind];
  const tags = [
    `<span class="badge ${k.cls}">${k.label}</span>`,
    item.version ? `<span>${esc(item.version.length > 18 ? item.version.slice(0, 18) + '…' : item.version)}</span>` : '',
    item.size ? `<span class="dot">${humanSize(item.size)}</span>` : '',
    item.protected ? `<span class="badge lock">${I.lock.replace('<svg', '<svg style="width:11px;height:11px"')} Protejat</span>` : '',
  ].join('');
  return `<div class="card ${state.selected.has(item.key) ? 'selected' : ''} ${item.protected ? 'locked' : ''}" data-key="${esc(item.key)}" style="--i:${Math.min(i, 40)}" tabindex="0">
    ${iconHtml(item)}
    <div class="meta">
      <div class="name" title="${esc(item.name)}">${esc(item.name)}</div>
      <div class="desc" title="${esc(item.description)}">${esc(item.description || item.source)}</div>
      <div class="tags">${tags}</div>
    </div>
    <button class="check" data-check aria-label="Selectează">${I.check}</button>
  </div>`;
}

function render() {
  renderNav();
  const v = VIEWS.find((x) => x.id === state.view) || VIEWS[0];
  const grid = $('#grid');
  $('#viewTitle').textContent = v.title;
  document.querySelectorAll('#sortSeg button').forEach((b) => b.classList.toggle('on', b.dataset.sort === state.sort));

  const banner = $('#banner');
  if (state.view === 'system' && !state.loading) {
    banner.hidden = false;
    banner.innerHTML = `${I.warn}<div><b>Ai grijă aici.</b> Acestea sunt componente ale sistemului Fedora, fără scurtătură în meniu. Cele marcate „Protejat” nu pot fi șterse. Pentru restul, înainte de dezinstalare îți arăt exact ce se mai elimină odată cu ele.</div>`;
  } else banner.hidden = true;

  if (state.loading) {
    $('#viewSub').textContent = 'Se caută aplicațiile instalate…';
    grid.className = 'grid';
    grid.innerHTML = Array.from({ length: 12 }, () => '<div class="skeleton"></div>').join('');
    return;
  }

  const list = visibleItems();
  const size = list.reduce((s, i) => s + (i.size || 0), 0);
  $('#viewSub').textContent = `${plural(list.length, 'element', 'elemente')}${size ? ' · ' + humanSize(size) : ''}${state.q ? ` pentru „${state.q}”` : ''}`;
  grid.className = `grid ${state.view === 'system' ? 'list' : ''} ${state.selected.size ? 'selecting' : ''}`;

  if (!list.length) {
    grid.innerHTML = state.q
      ? `<div class="empty"><div class="big">🔍</div><h3>Nimic găsit</h3>Nu există nicio aplicație care să se potrivească cu „${esc(state.q)}”.</div>`
      : '<div class="empty"><div class="big">✨</div><h3>Totul e curat</h3>Nu există nimic instalat în această categorie.</div>';
  } else {
    const max = state.view === 'system' ? 3000 : 1000;
    grid.innerHTML = list.slice(0, max).map(cardHtml).join('');
  }
  renderSelBar();
}

function renderSelBar() {
  const bar = $('#selBar');
  const n = state.selected.size;
  bar.hidden = n === 0;
  if (n) {
    const size = [...state.selected].reduce((s, k) => s + ((state.byKey.get(k) || {}).size || 0), 0);
    $('#selText').textContent = `${plural(n, 'aplicație selectată', 'aplicații selectate')}${size ? ' · ' + humanSize(size) : ''}`;
  }
  $('#grid').classList.toggle('selecting', n > 0);
}

// ------------------------------------------------------------ interacțiuni
$('#nav').addEventListener('click', (e) => {
  const b = e.target.closest('.nav-item');
  if (!b) return;
  state.view = b.dataset.view;
  $('#grid').scrollTop = 0;
  render();
});
$('#search').addEventListener('input', (e) => { state.q = e.target.value; render(); });
$('#sortSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { state.sort = b.dataset.sort; render(); } });
$('#refresh').addEventListener('click', () => load());
$('#selClear').addEventListener('click', () => { state.selected.clear(); render(); });
$('#selGo').addEventListener('click', () => openConfirm([...state.selected]));

const grid = $('#grid');
grid.addEventListener('click', (e) => {
  const card = e.target.closest('.card');
  if (!card) return;
  const key = card.dataset.key;
  const item = state.byKey.get(key);
  if (e.target.closest('[data-check]') || ((e.ctrlKey || e.metaKey) && !item.protected) || (state.selected.size && !item.protected)) {
    if (item.protected) return;
    if (state.selected.has(key)) state.selected.delete(key); else state.selected.add(key);
    card.classList.toggle('selected', state.selected.has(key));
    renderSelBar();
    return;
  }
  openDetails(key);
});
grid.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.classList.contains('card')) openDetails(e.target.dataset.key);
});
// reflexia luminii urmărește mouse-ul
grid.addEventListener('pointermove', (e) => {
  const card = e.target.closest('.card');
  if (!card) return;
  const r = card.getBoundingClientRect();
  card.style.setProperty('--mx', `${e.clientX - r.left}px`);
  card.style.setProperty('--my', `${e.clientY - r.top}px`);
});

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); $('#search').focus(); $('#search').select(); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r') { e.preventDefault(); if (!sheetBusy) load(); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && document.activeElement.tagName !== 'INPUT' && $('#sheetWrap').hidden) {
    e.preventDefault();
    visibleItems().filter((i) => !i.protected).forEach((i) => state.selected.add(i.key));
    render();
  } else if (e.key === 'Escape') {
    if (!$('#sheetWrap').hidden) closeSheet();
    else if (state.selected.size) { state.selected.clear(); render(); }
    else if (state.q) { state.q = ''; $('#search').value = ''; render(); }
  }
});

$('#cleanFlatpak').addEventListener('click', async () => {
  const b = $('#cleanFlatpak');
  b.disabled = true;
  b.querySelector('span').textContent = 'Se curăță…';
  try {
    const r = await api.cleanFlatpak();
    toast(r.nothing ? 'Nu există runtime-uri Flatpak nefolosite' : `Am eliberat spațiu: ${r.removed || 'câteva'} runtime-uri eliminate`);
    if (!r.nothing) load({ quiet: true });
  } catch { toast('Curățarea Flatpak a eșuat', 'err'); }
  b.disabled = false;
  b.querySelector('span').textContent = 'Curăță Flatpak nefolosite';
});

// ------------------------------------------------------------ foaia (detalii → confirmare → progres → gata)
let sheetBusy = false;
const sheet = $('#sheet');
function openSheet(html) {
  sheet.innerHTML = html;
  const wrap = $('#sheetWrap');
  wrap.classList.remove('closing');
  wrap.hidden = false;
}
function closeSheet() {
  if (sheetBusy) return;
  const wrap = $('#sheetWrap');
  wrap.classList.add('closing');
  setTimeout(() => { wrap.hidden = true; wrap.classList.remove('closing'); }, 190);
}
$('#sheetWrap').addEventListener('mousedown', (e) => { if (e.target.id === 'sheetWrap') closeSheet(); });
sheet.addEventListener('click', (e) => {
  const a = e.target.closest('[data-act]');
  if (!a) return;
  const act = a.dataset.act;
  if (act === 'close') closeSheet();
  else if (act === 'folder') api.showInFolder(a.dataset.path);
  else if (act === 'uninstall') openConfirm(JSON.parse(a.dataset.keys));
  else if (act === 'confirm') runUninstall(JSON.parse(a.dataset.keys));
});

function head(item, extra = '') {
  return `<button class="sheet-x" data-act="close" aria-label="Închide">${I.x}</button>
  <div class="sheet-head">${iconHtml(item)}<div style="min-width:0">
    <h2>${esc(item.name)}</h2><p>${esc(item.description || '')}</p>
    <span class="badge ${KIND[item.kind].cls}">${KIND[item.kind].label}</span> ${extra}
  </div></div>`;
}

function openDetails(key) {
  const it = state.byKey.get(key);
  if (!it) return;
  const rows = [
    ['Sursă', it.source],
    ['Versiune', it.version],
    ['Mărime', humanSize(it.size)],
    [it.kind === 'rpm' ? 'Instalat la' : 'Data', fmtDate(it.installed)],
    ['Pachet', it.pkg],
    ['ID Flatpak', it.appId],
    ['Instalare', it.installation ? (it.installation === 'user' ? 'Doar pentru tine' : 'Pentru tot sistemul') : ''],
    ['Snap', it.snap],
    ['Locație', it.location],
    ['Producător', it.kind === 'rpm' ? it.vendor : ''],
    ['Include', (it.extraNames || []).join(', ')],
  ].filter(([, v]) => v);
  const lockNote = it.protected
    ? `<div class="note warn">${I.lock}<div>Această componentă e esențială pentru Fedora. Dacă ar fi ștearsă, sistemul ar putea să nu mai pornească, așa că dezinstalarea e blocată.</div></div>` : '';
  const sysNote = it.system && !it.protected
    ? `<div class="note warn">${I.warn}<div>E un pachet de sistem. Alte programe s-ar putea baza pe el. Înainte de dezinstalare îți arăt tot ce s-ar elimina împreună cu el.</div></div>` : '';
  openSheet(`${head(it)}
    <div class="sheet-body">${lockNote}${sysNote}
      <div class="info">${rows.map(([k, v]) => `<div class="k">${esc(k)}</div><div class="v">${esc(v)}</div>`).join('')}</div>
    </div>
    <div class="sheet-foot">
      ${it.location ? `<button class="btn plain" data-act="folder" data-path="${esc(it.location)}">${I.folder} Arată în Fișiere</button>` : ''}
      <button class="btn danger" data-act="uninstall" data-keys='${esc(JSON.stringify([it.key]))}' ${it.protected ? 'disabled' : ''}>${I.trash} Dezinstalează…</button>
    </div>`);
}

function statusView(inner) {
  return `<div class="sheet-body"><div class="status">${inner}</div></div>`;
}

async function openConfirm(keys) {
  const items = keys.map((k) => state.byKey.get(k)).filter(Boolean);
  if (!items.length) return;
  const one = items.length === 1 ? items[0] : null;
  const title = one ? `Dezinstalezi ${esc(one.name)}?` : `Dezinstalezi ${plural(items.length, 'aplicație', 'aplicații')}?`;
  const needsRpm = items.some((i) => i.kind === 'rpm');
  sheetBusy = true;
  openSheet(statusView(`<div class="ring"></div><h3>Pregătesc dezinstalarea…</h3>
    <p>${needsRpm ? 'Îți va cere parola ca să verific ce pachete se elimină.' : 'Verific ce fișiere și setări rămân în urmă.'}</p>`));
  let p;
  try { p = await api.preview(keys); } catch (e) { p = { blocked: 'A apărut o eroare neașteptată.', raw: String(e) }; }
  sheetBusy = false;

  if (p.blocked) {
    openSheet(`${statusView(`<div class="done-mark bad">${I.x}</div><h3>${p.authFailed ? 'Anulat' : 'Nu se poate dezinstala'}</h3><p>${esc(p.blocked)}</p>
      ${p.raw ? `<details class="log"><summary>Detalii tehnice</summary><pre>${esc(p.raw)}</pre></details>` : ''}`)}
      <div class="sheet-foot"><button class="btn plain" data-act="close">Închide</button></div>`);
    return;
  }

  const groups = p.sections.map((s) => `<div class="group"><h4>${esc(s.title)}</h4><div class="rows">
    ${s.lines.slice(0, 60).map((l) => `<div class="row"><div class="grow"><div class="t">${esc(l.text)}</div>${l.sub ? `<div class="s">${esc(l.sub)}</div>` : ''}</div>${l.size ? `<div class="sz">${esc(l.size)}</div>` : ''}</div>`).join('')}
    ${s.lines.length > 60 ? `<div class="row"><div class="s">…și încă ${s.lines.length - 60}</div></div>` : ''}
  </div></div>`).join('');

  const warns = p.warnings.map((w) => `<div class="note warn">${I.warn}<div>${esc(w)}</div></div>`).join('');

  const left = p.leftovers.length ? `<div class="group"><h4>Date rămase în folderul tău</h4><div class="rows">
      <div class="row"><div class="grow"><div class="t">Șterge și setările și datele</div><div class="s">Recomandat dacă nu mai folosești aplicația. Ajung în Coș, de unde le poți recupera.</div></div>
      <input type="checkbox" class="toggle" id="allLeft"></div>
      ${p.leftovers.map((l, i) => `<div class="row"><label><input type="checkbox" class="cbox left" data-i="${i}">
        <div class="grow"><div class="t">${esc(l.label)}${items.length > 1 ? ` · ${esc(l.app)}` : ''}</div><div class="s">${esc(l.path)}</div></div>
        <div class="sz">${esc(l.sizeText || '')}</div></label></div>`).join('')}
    </div></div>` : '';

  const trashNote = items.some((i) => ['appimage', 'manual', 'shortcut'].includes(i.kind))
    ? `<div class="note">${I.undo}<div>Fișierele din folderul tău personal sunt mutate în Coș, nu șterse definitiv.</div></div>` : '';

  openSheet(`${one ? head(one) : `<button class="sheet-x" data-act="close">${I.x}</button><div class="sheet-head"><div class="app-icon"><div class="fallback-icon" style="background:linear-gradient(160deg,#ff6b6b,#ff3b30)">${I.trash.replace('<svg', '<svg style="width:34px;height:34px;stroke:#fff"')}</div></div><div><h2>${title}</h2><p>${esc(items.map((i) => i.name).join(', '))}</p></div></div>`}
    <div class="sheet-body">
      ${one ? `<div class="group"><h4 style="font-size:17px;text-transform:none;letter-spacing:-0.01em;color:var(--text)">${title}</h4></div>` : ''}
      ${warns}${p.raw ? `<details class="log" style="margin-bottom:14px"><summary>Textul complet de la dnf</summary><pre>${esc(p.raw)}</pre></details>` : ''}${groups}${left}${trashNote}
    </div>
    <div class="sheet-foot">
      <div class="left">${p.needsPassword ? `${I.lock} Îți poate cere parola` : ''}${p.totalFreed ? ` · eliberează ${esc(p.totalFreed)}` : ''}</div>
      <button class="btn plain" data-act="close">Renunță</button>
      <button class="btn danger" data-act="confirm" data-keys='${esc(JSON.stringify(keys))}'>${I.trash} Dezinstalează</button>
    </div>`);

  sheet._leftovers = p.leftovers;
  const all = sheet.querySelector('#allLeft');
  if (all) {
    const boxes = [...sheet.querySelectorAll('.cbox.left')];
    all.addEventListener('change', () => boxes.forEach((b) => { b.checked = all.checked; }));
    boxes.forEach((b) => b.addEventListener('change', () => { all.checked = boxes.every((x) => x.checked); }));
  }
}

async function runUninstall(keys) {
  const leftovers = [...sheet.querySelectorAll('.cbox.left:checked')].map((b) => sheet._leftovers[+b.dataset.i].path);
  const items = keys.map((k) => state.byKey.get(k)).filter(Boolean);
  const label = items.length === 1 ? items[0].name : plural(items.length, 'aplicație', 'aplicații');
  sheetBusy = true;
  openSheet(statusView(`<div class="ring"></div><h3>Se dezinstalează ${esc(label)}</h3><p id="prog">Începem…</p>`));
  let r;
  try { r = await api.uninstall(keys, { leftovers }); } catch (e) { r = { ok: false, log: String(e) }; }
  sheetBusy = false;

  if (r.cancelled) {
    openSheet(`${statusView(`<div class="done-mark bad">${I.x}</div><h3>Anulat</h3><p>Parola nu a fost introdusă, așa că nu s-a dezinstalat nimic.</p>`)}
      <div class="sheet-foot"><button class="btn plain" data-act="close">Închide</button></div>`);
    return;
  }
  if (r.ok) {
    openSheet(`${statusView(`<div class="done-mark">${I.check}</div><h3>Gata!</h3><p>${esc(label)} ${items.length === 1 ? 'a fost dezinstalată' : 'au fost dezinstalate'}.</p>`)}
      <div class="sheet-foot"><button class="btn primary" data-act="close">Gata</button></div>`);
    toast(`${label} — dezinstalat`);
  } else {
    openSheet(`${statusView(`<div class="done-mark bad">${I.x}</div><h3>Nu a mers complet</h3>
      <p>${r.failed && r.failed.length ? `Nu am putut dezinstala: ${esc(r.failed.join(', '))}.` : 'A apărut o eroare.'}</p>
      <details class="log"><summary>Detalii tehnice</summary><pre>${esc(r.log || '')}</pre></details>`)}
      <div class="sheet-foot"><button class="btn plain" data-act="close">Închide</button></div>`);
  }
  for (const k of keys) state.selected.delete(k);
  await load({ quiet: true });
}

api.onProgress((t) => { const el = document.getElementById('prog'); if (el) el.textContent = t; });

// ------------------------------------------------------------ pornire
(async () => {
  document.querySelectorAll('#themeSeg button').forEach((b) => b.classList.toggle('on', b.dataset.theme === themeMode));
  const r = await api.setTheme(themeMode);
  applyTheme(r.dark);
  load();
})();
