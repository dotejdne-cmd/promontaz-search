// Testy sestavení indexu: prodejní jednotka a obsah balení. Spuštění: node --test test/
// Fixtures: skutečné stránky promontaz.cz (11/2026) – výpisy kategorií a stránky produktu (z Jardy).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { normUnit, normPack, listingUnits, pageUnit, refreshUnits } from '../build-units.mjs';

const page = f => zlib.gunzipSync(fs.readFileSync(new URL('./fixtures/' + f + '.html.gz', import.meta.url))).toString('utf8');

test('normUnit: jednotky Shoptetu jako v Jardovi', () => {
  assert.equal(normUnit('\n            /&nbsp;bal\n    '), 'bal');
  assert.equal(normUnit('/&nbsp;ks'), 'ks');
  assert.equal(normUnit('/ m'), 'm');
  assert.equal(normUnit('/&nbsp;m²'), 'm2');
  assert.equal(normUnit('kus'), 'ks');
  assert.equal(normUnit('paleta'), 'paleta');
  assert.equal(normUnit(''), '');
  assert.equal(normUnit(undefined), '');
  assert.equal(normUnit('<b>něco divného a dlouhého</b>'), '', 'nečitelný údaj → prázdný');
});

test('normPack: obsah balení z feedu', () => {
  assert.equal(normPack('1000 ks'), '1000 ks');
  assert.equal(normPack(' 25 kg '), '25 kg');
  assert.equal(normPack('0.5 l'), '0,5 l');
  assert.equal(normPack('310 ml'), '310 ml');
  assert.equal(normPack('Pár'), '', 'bez čísla nic');
  assert.equal(normPack('paleta (42 ks × 25 kg)'), '', 'složený údaj nic nedomýšlí');
  assert.equal(normPack(''), '');
});

test('listingUnits: výpis kategorie → cesta produktu + jednotka', () => {
  const vr = listingUnits(page('vypis-konstrukcni-vruty'));
  assert.equal(vr.length, 20);
  assert.ok(vr.every(([href, u]) => href.startsWith('/konstrukcni-vruty/') && u === 'bal'), JSON.stringify(vr.slice(0, 3)));
  const kb = listingUnits(page('vypis-instalacni-kabely'));
  assert.equal(kb.length, 20);
  assert.ok(kb.every(([, u]) => u === 'm'));
  assert.ok(kb.some(([href]) => href === '/instalacni-kabely/kabel-cyky-j-3x2-5--c-/'));
});

test('pageUnit: stránka produktu (stejné místo jako Jarda: konečná cena)', () => {
  assert.equal(pageUnit(page('vrut-bal')), 'bal');
  assert.equal(pageUnit(page('kabel-m')), 'm');
  assert.equal(pageUnit('<html>bez ceny</html>'), '');
});

test('build-index: nové údaje jen na konci položky, pozice 0–9 beze změny (Jarda 3.0.7 / 3.1.1)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'psearch-build-'));
  const feed = path.join(dir, 'feed.xml');
  const item = (id, name, url, extra) => `<SHOPITEM><ITEM_ID>${id}</ITEM_ID><PRODUCTNAME>${name}</PRODUCTNAME><URL>${url}</URL>` +
    `<IMGURL>https://cdn.example/x/${id}.png</IMGURL><PRICE_VAT>189,00</PRICE_VAT><MANUFACTURER>HASPL</MANUFACTURER>` +
    `<CATEGORYTEXT>Spojovací materiál | Vruty</CATEGORYTEXT><DELIVERY_DATE>0</DELIVERY_DATE><EAN>8591530100053</EAN>${extra}</SHOPITEM>`;
  fs.writeFileSync(feed, '<SHOP>' +
    item('VR_10005', 'HASPL Vrut konstrukční 3,5x35 zápust.hl. TX15 ZZ', 'https://www.promontaz.cz/konstrukcni-vruty/vrut-a/',
      '<PARAM><PARAM_NAME>Obsah balení</PARAM_NAME><VAL>1000 ks</VAL></PARAM>') +
    item('VR_2', 'Vrut bez balení', 'https://www.promontaz.cz/konstrukcni-vruty/vrut-b/', '') +
    '</SHOP>');
  const out = path.join(dir, 'out');
  execFileSync(process.execPath, ['build-index.mjs', out], {
    cwd: new URL('..', import.meta.url).pathname,
    env: { ...process.env, FEED_URL: feed, SITEMAP_URL: '', PREV_INDEX_URL: '', UNIT_PAGES: '0', MIN_ITEMS: '1' },
    stdio: 'pipe',
  });
  const idx = JSON.parse(fs.readFileSync(path.join(out, 'index.json'), 'utf8'));
  const [a, b] = idx.items;
  assert.equal(a[0], 'HASPL Vrut konstrukční 3,5x35 zápust.hl. TX15 ZZ');
  assert.equal(idx.base + a[1], 'https://www.promontaz.cz/konstrukcni-vruty/vrut-a/');
  assert.equal(a[3], 189);
  assert.equal(idx.manus[a[4]], 'HASPL');
  assert.equal(a[5].split(' ')[0], 'VR_10005');
  assert.equal(idx.cats[a[6]], 'Spojovací materiál | Vruty');
  assert.equal(a[7], 1);
  assert.equal(a[8], 0);
  assert.equal(typeof a[9], 'string');
  assert.deepEqual(a.slice(10), ['', '1000 ks'], 'jednotka neznámá (UNIT_PAGES=0) → prázdná, balení z feedu');
  assert.equal(b.length, 10, 'bez jednotky i balení se položka neprodlužuje');
});

// ===== obnova jednotek: nic nesmí zůstat zastaralé =====
const O = 'https://www.promontaz.cz';
const listing = (cat, rows, pages = 1) => rows.map(([slug, u]) =>
  `<div class="product"><a href="/${cat}/${slug}/" class="name">x</a><span class="pr-list-unit">/&nbsp;${u}</span></div>`).join('') +
  Array.from({ length: pages - 1 }, (_, i) => `<a href="/${cat}/strana-${i + 2}/">${i + 2}</a>`).join('');
const prods = (...urls) => new Map(urls.map(u => [`${O}/${u}/`, { url: `${O}/${u}/`, unit: '' }]));
const site = (pages) => { const log = []; return { log, fetchText: async (url) => { log.push(url.slice(O.length)); return pages[url.slice(O.length)] ?? ''; } }; };
const prevIndex = (rows, checked) => ({ base: O + '/', unitChecked: checked, items: rows.map(([u, unit]) => ['n', u + '/', '', 1, 0, '', 0, 0, 0, '', unit, '']) });

test('refreshUnits: první noc – jednotky z výpisu, kategorie označena jako zkontrolovaná', async () => {
  const p = prods('vruty/a', 'vruty/b', 'kabely/c');
  const s = site({ '/vruty/': listing('vruty', [['a', 'bal']], 2), '/vruty/strana-2/': listing('vruty', [['b', 'ks']]), '/kabely/': listing('kabely', [['c', 'm']]) });
  const r = await refreshUnits({ products: p, prev: null, origin: O, today: 100, pages: 10, fetchText: s.fetchText });
  assert.deepEqual([...p.values()].map(x => x.unit), ['bal', 'ks', 'm']);
  assert.deepEqual(r.checked, { kabely: 100, vruty: 100 });
});

test('refreshUnits: změna jednotky na webu přepíše starou; produkt zmizelý z výpisu jednotku ztratí', async () => {
  const p = prods('vruty/a', 'vruty/b');
  const prev = prevIndex([['vruty/a', 'ks'], ['vruty/b', 'bal']], { vruty: 98 });
  const s = site({ '/vruty/': listing('vruty', [['a', 'bal']]) });
  const r = await refreshUnits({ products: p, prev, origin: O, today: 100, pages: 10, fetchText: s.fetchText });
  assert.equal(p.get(`${O}/vruty/a/`).unit, 'bal', 'ks → bal');
  assert.equal(p.get(`${O}/vruty/b/`).unit, '', 'b ve výpisu není → prázdné, ne stará hodnota');
  assert.deepEqual([r.stats.changed, r.stats.cleared], [1, 1]);
});

test('refreshUnits: jednotka přečtená dnes ze stránky produktu se nemaže', async () => {
  const p = prods('vruty/a', 'vruty/skryty');
  p.get(`${O}/vruty/skryty/`).unit = 'bal';
  p.get(`${O}/vruty/skryty/`).unitFresh = true;
  const s = site({ '/vruty/': listing('vruty', [['a', 'ks']]) });
  await refreshUnits({ products: p, prev: null, origin: O, today: 100, pages: 10, fetchText: s.fetchText });
  assert.equal(p.get(`${O}/vruty/skryty/`).unit, 'bal');
});

test('refreshUnits: jednotka z kategorie nekontrolované déle než maxAge se zahodí', async () => {
  const p = prods('vruty/a', 'kabely/c');
  const prev = prevIndex([['vruty/a', 'bal'], ['kabely/c', 'm']], { vruty: 80, kabely: 99 });
  const s = site({});
  const r = await refreshUnits({ products: p, prev, origin: O, today: 100, pages: 0, maxAge: 14, fetchText: s.fetchText });
  assert.equal(p.get(`${O}/vruty/a/`).unit, '', '20 dní → zahodit');
  assert.equal(p.get(`${O}/kabely/c/`).unit, 'm', '1 den → převzít');
  assert.deepEqual(r.checked, { kabely: 99 });
  assert.equal(r.stats.expired, 1);
});

test('refreshUnits: pořadí od nejdéle nekontrolované; nedokončená kategorie se neoznačí a nic nemaže', async () => {
  const p = prods('a-kat/x', 'b-kat/y', 'c-kat/z', 'c-kat/w');
  const prev = prevIndex([['a-kat/x', 'ks'], ['b-kat/y', 'ks'], ['c-kat/z', 'ks'], ['c-kat/w', 'ks']], { 'a-kat': 99, 'b-kat': 95, 'c-kat': 90 });
  const s = site({ '/c-kat/': listing('c-kat', [['z', 'bal']], 2), '/b-kat/': listing('b-kat', [['y', 'ks']]) });
  const r = await refreshUnits({ products: p, prev, origin: O, today: 100, pages: 1, concurrency: 1, fetchText: s.fetchText });
  assert.deepEqual(s.log, ['/c-kat/'], 'nejstarší (90) první, rozpočet 1 stránka');
  assert.equal(p.get(`${O}/c-kat/w/`).unit, 'ks', 'výpis má 2 stránky, nevejde se → nic se nemaže');
  assert.equal(r.checked['c-kat'], 90, 'nedokončená kategorie zůstává s původním dnem');
  assert.equal(r.unitPages['c-kat'], 2, 'skutečný počet stránek si index zapamatuje');
  // další noc se stejným limitem: c-kat (2 stránky) se nevejde → odloží se, vezme se b-kat
  const s2 = site({ '/c-kat/': listing('c-kat', [['z', 'bal']], 2), '/b-kat/': listing('b-kat', [['y', 'ks']]) });
  const r2 = await refreshUnits({ products: prods('b-kat/y', 'c-kat/z', 'c-kat/w'), prev: { ...prev, unitPages: r.unitPages }, origin: O, today: 101, pages: 1, concurrency: 1, fetchText: s2.fetchText });
  assert.deepEqual(s2.log, ['/b-kat/']);
  assert.equal(r2.checked['b-kat'], 101);
});

test('refreshUnits: chyba stažení stránky – kategorie se neoznačí, jednotky zůstanou', async () => {
  const p = prods('vruty/a', 'vruty/b');
  const prev = prevIndex([['vruty/a', 'bal'], ['vruty/b', 'bal']], { vruty: 99 });
  const s = site({ '/vruty/': listing('vruty', [['a', 'bal']], 2) }); // strana-2 vrátí chybu ('')
  const r = await refreshUnits({ products: p, prev, origin: O, today: 100, pages: 10, fetchText: s.fetchText });
  assert.equal(p.get(`${O}/vruty/b/`).unit, 'bal');
  assert.equal(r.checked.vruty, 99);
  assert.equal(r.stats.failed, 1);
});

test('refreshUnits: kategorie, která se nevejde do limitu, se odloží a vezme se menší', async () => {
  const big = Array.from({ length: 45 }, (_, i) => `velka/p${i}`);   // 3 stránky
  const p = prods(...big, 'mala/x');
  const s = site({ '/mala/': listing('mala', [['x', 'ks']]) });
  const r = await refreshUnits({ products: p, prev: null, origin: O, today: 100, pages: 2, concurrency: 1, fetchText: s.fetchText });
  assert.deepEqual(s.log, ['/mala/']);
  assert.deepEqual(r.checked, { mala: 100 });
  assert.equal(r.stats.skipped, 1);
});

test('refreshUnits: nadřazená kategorie s dlouhým výpisem → čtou se rovnou stránky jejích produktů', async () => {
  const p = prods('elektro/a', 'elektro/b');
  const unitPage = (u) => `<div class="p-final-price-wrapper"><strong>10 Kč<span class="pr-list-unit">/&nbsp;${u}</span></strong></div>`;
  const s = site({ '/elektro/': listing('elektro', [['x', 'ks']], 50), '/elektro/a/': unitPage('bal'), '/elektro/b/': unitPage('m') });
  const r = await refreshUnits({ products: p, prev: null, origin: O, today: 100, pages: 10, concurrency: 1, fetchText: s.fetchText });
  assert.deepEqual(s.log, ['/elektro/', '/elektro/a/', '/elektro/b/'], 'ne 50 stránek výpisu');
  assert.deepEqual([...p.values()].map(x => x.unit), ['bal', 'm']);
  assert.equal(r.checked.elektro, 100);
  assert.equal(r.unitPages.elektro, 50);
  const s2 = site({ '/elektro/a/': unitPage('bal'), '/elektro/b/': unitPage('ks') });
  const r2 = await refreshUnits({ products: prods('elektro/a', 'elektro/b'), prev: { base: O + '/', items: [], unitPages: r.unitPages }, origin: O, today: 101, pages: 10, concurrency: 1, fetchText: s2.fetchText });
  assert.deepEqual(s2.log, ['/elektro/a/', '/elektro/b/'], 'příště rovnou stránky produktů');
  assert.equal(r2.checked.elektro, 101);
});
