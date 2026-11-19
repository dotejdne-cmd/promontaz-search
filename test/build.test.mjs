// Testy sestavení indexu: prodejní jednotka a obsah balení. Spuštění: node --test test/
// Fixtures: skutečné stránky promontaz.cz (11/2026) – výpisy kategorií a stránky produktu (z Jardy).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { normUnit, normPack, listingUnits, pageUnit } from '../build-units.mjs';

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
