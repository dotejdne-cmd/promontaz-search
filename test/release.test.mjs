// Kanál vydání: search-v3.js = channel.js + stabilní verze z versions/, search-v3-next.js = repo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { writeRelease, releaseConfig } from '../release.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'psearch-rel-'));
const rel = writeRelease(out);
const read = f => fs.readFileSync(path.join(out, f), 'utf8');

test('stabilní verze je beze změny zálohovaná a zákazníkům jde přesně ona', () => {
  const { stable } = releaseConfig();
  const src = fs.readFileSync(path.join(ROOT, 'versions', `search-v3-${stable}.js`), 'utf8');
  assert.ok(read('search-v3.js').endsWith(src), 'search-v3.js končí bajtově shodnou stabilní verzí');
  assert.ok(read('search-v3.js').startsWith(fs.readFileSync(path.join(ROOT, 'channel.js'), 'utf8')));
  assert.equal(read(`search-v3-${stable}.js`), src);
  assert.equal(read('search-v3-next.js'), fs.readFileSync(path.join(ROOT, 'search-v3.js'), 'utf8'));
  assert.ok(rel.versions.includes('search-v3-3.1.0.js'), 'záloha 3.1.0 se zveřejňuje vždy');
  for (const f of ['search.js', 'search-v2.js', 'ux.css', 'demo.html', 'release.json', 'assets/kalkulacky/kalk-osb-800.webp']) assert.ok(fs.existsSync(path.join(out, f)), f);
});

test('záloha 3.1.0 = verze, která běžela na promontaz.cz do 11/2026 (otisk)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'versions', 'search-v3-3.1.0.js'));
  assert.equal(src.length, 35190);
  assert.match(src.toString(), /v3\.1: záložní varianty dotazu/);
});

// prohlížeč naoko: jen to, co channel.js a začátek stabilní verze potřebují
function browser(search, stored) {
  const store = new Map(Object.entries(stored || {})), added = [];
  const el = (tag) => ({ tagName: tag, attrs: {}, setAttribute() {}, appendChild() {}, addEventListener() {}, style: {} });
  const document = {
    currentScript: { src: 'https://dotejdne-cmd.github.io/promontaz-search/search-v3.js', getAttribute: () => null },
    head: { appendChild: (n) => added.push(n) },
    createElement: el,
    documentElement: { classList: { add() {} } },
    readyState: 'complete', querySelector: () => null, querySelectorAll: () => [],
    addEventListener() {}, body: {},
  };
  const window = { addEventListener() {} };
  const ctx = vm.createContext({
    window, document, location: { search, pathname: '/' }, URLSearchParams,
    localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    MutationObserver: function () { this.observe = () => {}; }, setTimeout, console,
  });
  ctx.window.document = document;
  return { ctx, window, added, store };
}
const runChannel = (b) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'channel.js'), 'utf8'), b.ctx);

test('kanál: bez parametru nic nemění (zákazníci dostanou stabilní verzi)', () => {
  const b = browser('');
  runChannel(b);
  assert.equal(b.window.__psearch3, undefined);
  assert.equal(b.added.length, 0);
});

test('kanál: ?psearch3=next zapne zkušební verzi a zapamatuje si to; ?psearch3=stable vrátí', () => {
  const b = browser('?psearch3=next');
  runChannel(b);
  assert.equal(b.window.__psearch3, 'next', 'stabilní verze za kanálem se nezapne');
  assert.equal(b.added[0].src, 'https://dotejdne-cmd.github.io/promontaz-search/search-v3-next.js');
  assert.equal(b.store.get('psearch3_next'), '1');
  const b2 = browser('', { psearch3_next: '1' });
  runChannel(b2);
  assert.equal(b2.added.length, 1, 'zapamatováno i bez parametru');
  const b3 = browser('?psearch3=stable', { psearch3_next: '1' });
  runChannel(b3);
  assert.equal(b3.added.length, 0);
  assert.equal(b3.store.has('psearch3_next'), false);
});

test('kanál + stabilní 3.1.0 v jednom souboru: při ?psearch3=next se 3.1.0 nezapne', () => {
  const b = browser('?psearch3=next');
  vm.runInContext(read('search-v3.js'), b.ctx);
  assert.equal(b.window.__psearch3, 'next', '3.1.0 skončila na kontrole window.__psearch3');
  assert.equal(b.added.length, 1, 'žádný styl ani panel 3.1.0, jen načtení zkušební verze');
});

test('zkušební verze: najde index.json i z názvu search-v3-next.js', () => {
  const src = read('search-v3-next.js');
  assert.match(src, /\(-next\|-\\d\+\\\.\\d\+\\\.\\d\+\)\?\\\.js/);
  const re = /search(-v\d+)?(-next|-\d+\.\d+\.\d+)?\.js(\?.*)?$/;
  for (const f of ['search-v3.js', 'search-v3-next.js', 'search-v3-3.1.0.js', 'search-v3.js?x=1']) {
    assert.equal(('https://x/promontaz-search/' + f).replace(re, 'index.json'), 'https://x/promontaz-search/index.json', f);
  }
});
