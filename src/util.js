'use strict';
const { execFile } = require('child_process');
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');
const { getLang } = require('./i18n');

/** Rulează o comandă fără shell. Nu aruncă niciodată excepții. */
function run(cmd, args = [], opts = {}) {
  return new Promise((resolve) => {
    execFile(
      cmd,
      args,
      {
        timeout: opts.timeout ?? 120000,
        maxBuffer: 128 * 1024 * 1024,
        env: { ...process.env, LC_ALL: 'C.UTF-8', LANG: 'C.UTF-8', ...(opts.env || {}) },
      },
      (err, stdout, stderr) => {
        resolve({
          code: err ? (typeof err.code === 'number' ? err.code : -1) : 0,
          stdout: String(stdout || ''),
          stderr: String(stderr || ''),
          missing: !!(err && err.code === 'ENOENT'),
        });
      }
    );
  });
}

async function exists(p) {
  try { await fsp.lstat(p); return true; } catch { return false; }
}

async function readdirSafe(p) {
  try { return await fsp.readdir(p, { withFileTypes: true }); } catch { return []; }
}

async function statSafe(p) {
  try { return await fsp.stat(p); } catch { return null; }
}

/** Execută funcții async cu concurență limitată. */
async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try { out[idx] = await fn(items[idx], idx); } catch { out[idx] = undefined; }
    }
  });
  await Promise.all(workers);
  return out;
}

/** Context injectabil (pentru teste): rădăcina sistemului, folderul home, run. */
function makeContext(overrides = {}) {
  const root = overrides.root || '';
  const home = overrides.home || os.homedir();
  return {
    root,
    home,
    run: overrides.run || run,
    p: (abs) => (root ? path.join(root, abs) : abs),
    hp: (...rel) => path.join(home, ...rel),
  };
}

function humanSize(bytes) {
  if (bytes == null || isNaN(bytes)) return '';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let n = Number(bytes);
  while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  const num = String(n >= 100 || i === 0 ? Math.round(n) : n.toFixed(1));
  return `${getLang() === 'ro' ? num.replace('.', ',') : num} ${u[i]}`;
}

/** Transformă „123.4 MB” (din flatpak) în octeți. */
function parseHumanSize(s) {
  const m = /([\d.,]+)\s*([kKMGT]?i?B|bytes?)/.exec(s || '');
  if (!m) return null;
  const n = parseFloat(m[1].replace(',', '.'));
  const unit = m[2].toUpperCase();
  const mult = unit.startsWith('K') ? 1e3 : unit.startsWith('M') ? 1e6 : unit.startsWith('G') ? 1e9 : unit.startsWith('T') ? 1e12 : 1;
  return Math.round(n * mult);
}

async function dirSize(ctx, p) {
  const r = await ctx.run('du', ['-sb', '--', p], { timeout: 8000 });
  const n = parseInt(r.stdout.split(/\s/)[0], 10);
  return isNaN(n) ? null : n;
}

module.exports = { run, exists, readdirSafe, statSafe, pool, makeContext, humanSize, parseHumanSize, dirSize, fsp };
