// Testy vyhledávání v3. Spuštění: node --test test/
// Data: test/fixture-index.json = výřez skutečných položek z živého index.json (bez URL a obrázků).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const v3 = require('../search-v3.js');
const data = JSON.parse(fs.readFileSync(new URL('./fixture-index.json', import.meta.url), 'utf8'));
const engine = v3.createEngine(data, v3.CONFIG);
const S = (q, n = 60) => engine.search(q, n);
const names = (q, n = 60) => S(q, n).items.map(i => i.name);

test('normalizace: ×/x, desetinná čárka, mezery, jednotky, diakritika', () => {
  for (const q of ['3x2.5', '3x2,5', '3 x 2,5', '3×2,5', '3X2,5', '3*2,5', '3x2,5mm2', '3x2,5 mm²', '3 x 2,5 mm']) {
    assert.equal(v3.norm(q).trim(), '3x2.5', q);
  }
  assert.equal(v3.norm('120/120/5000'), '120x120x5000');
  assert.equal(v3.norm('3x1,50'), '3x1.5');
  assert.equal(v3.norm('3X1,0MM'), '3x1');
  assert.equal(v3.norm('M10x1,05'), 'm10x1.05');
  assert.equal(v3.norm('Turbošroub'), 'turbosroub');
  assert.equal(v3.norm('Husí krk'), 'husi krk');
  assert.equal(v3.norm('3M páska'), '3m paska', '3M je značka, ne délka');
});

test('cyky 3x2.5 ve všech zápisech najde jen 3x2,5', () => {
  for (const q of ['cyky 3x2.5', 'cyky 3x2,5', 'CYKY 3 x 2,5', 'cyky 3×2,5', 'cyky 3x2,5mm2', 'cyky-j 3x2,5', 'cykyj 3x2,5']) {
    const r = names(q);
    assert.ok(r.length >= 1, q);
    assert.equal(r[0], 'Kabel CYKY-J 3x2,5 (C)', q);
    assert.ok(r.every(n => /3x2,5/.test(n)), q + ' → ' + r.join(' | '));
  }
});

test('rozměry kabelů se nepletou', () => {
  assert.deepEqual(names('cyky 5x2,5'), ['Kabel CYKY-J 5x2,5 (C)']);
  const r = names('cyky 3x1,5');
  assert.deepEqual(r.slice().sort(), ['Kabel CYKY-J 3x1,5 (C)', 'Kabel CYKY-O 3x1,5 (A)']);
  assert.ok(!names('cyky 5x1,5').includes('Kabel CYKY-J 3x1,5 (C)'));
  assert.equal(names('cyky 5x6')[0], 'Kabel CYKY-J 5x6 (C)');
});

test('kvh 120x120 – jen hranoly 120/120', () => {
  for (const q of ['kvh 120x120', 'kvh 120 x 120', 'KVH 120/120', 'kvh 120×120', 'hranol 120x120']) {
    const r = names(q);
    assert.equal(r.length, 5, q + ' → ' + r.join(' | '));
    assert.ok(r.every(n => n.startsWith('KVH 120/120/')), q);
  }
});

test('osb 18 a osb deska 18 – jen tloušťka 18', () => {
  for (const q of ['osb 18', 'osb deska 18', 'OSB 18mm', 'osb desky 18 mm']) {
    const r = names(q);
    assert.equal(r.length, 3, q + ' → ' + r.join(' | '));
    assert.ok(r.every(n => /\/18 /.test(n)), q);
  }
});

test('turbošroub = Den Braven Turbo šroub (spojené slovo)', () => {
  for (const q of ['turbošroub', 'turbosroub', 'turbo šroub', 'turbošroub 7,5x92']) {
    const r = names(q);
    assert.ok(r.length >= 1, q);
    assert.ok(r.every(n => /Turbo šroub/.test(n)), q + ' → ' + r.join(' | '));
  }
  assert.match(names('turbošroub 7,5x92')[0], /92 mm/);
});

test('pozinkovaný vrut → vruty ZB/ZZ (galvanický zinek), ne vázací drát', () => {
  for (const q of ['pozinkovany vrut', 'pozinkovaný vrut', 'pozinkované vruty']) {
    const r = names(q);
    assert.ok(r.length >= 3, q);
    assert.ok(r.every(n => /Vrut/.test(n) && /\b(ZB|ZZ)\b/.test(n)), q + ' → ' + r.join(' | '));
  }
  assert.ok(names('pozinkovany drat').every(n => /Vazací drát/.test(n)));
});

test('nulový výsledek: nic nedomýšlet, širší hledání jen jako nabídka', () => {
  let r = S('husí krk');
  assert.equal(r.total, 0);
  assert.deepEqual(r.missing, ['husí', 'krk'], 'hláška v původním tvaru');
  assert.equal(r.rest, '');

  r = S('kabelova chranicka');
  assert.equal(r.total, 0, 'chránička není chránič');
  assert.deepEqual(r.missing, ['chranicka']);
  assert.equal(r.rest, 'kabelova');

  r = S('kotva do ytongu');
  assert.equal(r.total, 0, 'průvlaková kotva do betonu není kotva do pórobetonu');
  assert.deepEqual(r.missing, ['ytongu']);
  assert.equal(r.rest, 'kotva');
  assert.ok(r.restTotal >= 3);

  r = S('sanitarni silikon');
  assert.equal(r.total, 0, 'střešní/akrylový silikon není sanitární');
  assert.deepEqual(r.missing, ['sanitarni']);
  assert.equal(r.rest, 'silikon');
});

test('překlepy: chránič se nesmí zaměnit s chráničkou, běžný překlep projde', () => {
  assert.ok(names('proudovy chranic').length === 3);
  assert.equal(S('chranicka').total, 0);
  assert.ok(names('hmozdimka 8x100').length >= 1, 'jeden překlep');
  assert.ok(names('proudovi chranic').length === 3, 'i/y');
});

test('přesné kódy mají přednost: EAN, kód, objednací kód, WAGO 221-413', () => {
  const first = q => names(q, 5)[0];
  assert.equal(first('4050821808442'), 'Svorka instalační WAGO 3x4mm2 s páčkou 221-413');
  assert.equal(first('EL_SVO_81585726'), 'Svorka instalační WAGO 3x4mm2 s páčkou 221-413');
  assert.equal(first('el_svo_81585726'), 'Svorka instalační WAGO 3x4mm2 s páčkou 221-413');
  for (const q of ['WAGO 221-413', 'wago 221 413', '221-413', '221413', 'wago 221413', 'svorka wago 221-413']) {
    const r = names(q, 5);
    assert.equal(r[0], 'Svorka instalační WAGO 3x4mm2 s páčkou 221-413', q);
    assert.ok(!r.includes('Svorka instalační WAGO 2x4mm2 s páčkou, na licnu 221-412'), q + ' nesmí ukázat 221-412');
  }
  assert.equal(first('VR_10796'), 'HASPL Vrut univerzální 4,0x40 ZHH PZ2 ZZ závit celý');
  assert.equal(first('8591530107960'), 'HASPL Vrut univerzální 4,0x40 ZHH PZ2 ZZ závit celý');
  assert.equal(first('8060BD'), 'Den Braven Turbo šroub s plochou hlavou 7,5 mm × 72 mm — bal. 100 ks');
  assert.equal(first('J_00076'), 'OSB 2500/1250/18 RH');
  // EAN napsaný s textem
  assert.equal(first('wago 4050821808442'), 'Svorka instalační WAGO 3x4mm2 s páčkou 221-413');
  // začátek EAN se nedoplňuje
  assert.equal(S('40508218084').total, 0);
});

test('každý kód a EAN z fixture najde svůj produkt na 1. místě', () => {
  let n = 0;
  data.items.forEach(it => {
    for (const code of it[5].split(' ').filter(Boolean)) {
      const r = engine.search(code, 3).items;
      // varianty/duplicity se stejným kódem: produkt musí být mezi výsledky se stejným kódem
      const top = r.filter(x => x.name === it[0]);
      assert.ok(r.length && (r[0].name === it[0] || top.length), `${code} → ${r.map(x => x.name).join(' | ')}`);
      n++;
    }
  });
  assert.ok(n > 120);
});

test('regrese: značka 3M, hmoždinky, závitová tyč', () => {
  assert.ok(names('3m paska').length === 2);
  assert.equal(names('hmozdinka 8x100')[0], 'HASPL Hmoždinka natloukací 8x100mm zápustná, polypropylen');
  assert.equal(names('zavitova tyc m8')[0], 'HASPL Závitová tyč M8x2000, ZB 4.8');
  assert.equal(names('zavitovka m8')[0], 'HASPL Závitová tyč M8x2000, ZB 4.8');
});

test('neexistující rozměr: prázdný výsledek, širší hledání jen jako volba', () => {
  const r = S('osb 19');
  assert.equal(r.total, 0);
  assert.deepEqual(r.missing, ['19']);
  assert.equal(r.rest, 'osb');
  assert.equal(r.restTotal, 17);
  assert.equal(S('19x19x19').total, 0);
  assert.equal(S('19x19x19').rest, '', 'bez slov nic širšího nenabízet');
});

test('čísla se nedoplňují: 2x1 ≠ 2x1,5, 5x1 ≠ 5x1,5, 22 ≠ 22,2, m8 ≠ m80, 18 ≠ 180', () => {
  let r = S('cyky 5x1');
  assert.equal(r.total, 0, '5x1 nesmí vrátit 5x1,5');
  assert.equal(r.rest, 'cyky');
  assert.equal(S('cyky 3x1').total, 0, '3x1 nesmí vrátit 3x1,5');
  assert.equal(S('cyky 5x1,5').total, 1);
  assert.equal(S('cyky 5x1.50').total, 1, 'stejná hodnota v jiném zápisu');
  assert.equal(S('turbo sroub 7,5x9').total, 0, '7,5x9 nesmí vrátit 7,5x92');
  assert.equal(S('osb 1').total, 0, '1 nesmí vrátit 10/12/15/18');
  assert.deepEqual(names('zavitova tyc m8'), ['HASPL Závitová tyč M8x2000, ZB 4.8']);
  assert.equal(S('zavitova tyc m80').total, 0);
});

test('rozměry se nepřehazují; dílčí rozměr jen ve správném pořadí polí', () => {
  assert.equal(S('kvh 4000x100').total, 0, 'přeházené pořadí');
  assert.equal(S('cyky 2x5').total, 0, '5x2,5 není 2x5');
  assert.deepEqual(names('kvh 100x100x4000'), ['KVH 100/100/4000']);
  assert.deepEqual(names('kvh 100x4000'), ['KVH 100/100/4000'], 'výška × délka');
  assert.equal(S('kvh 120x120').total, 5, 'začátek rozměru');
  assert.deepEqual(names('kvh 120x5000'), ['KVH 120/120/5000'], 'konec rozměru (výška × délka)');
  assert.deepEqual(names('osb 1250x18'), ['OSB 2500/1250/18 RH'], 'šířka × tloušťka');
  assert.deepEqual(names('osb 2500x625').sort(), ['OSB 2500/625/12 PD4', 'OSB 2500/625/15 PD4', 'OSB 2500/625/18 PD4', 'OSB 2500/625/22 PD4', 'OSB 2500/625/25 PD4']);
  assert.equal(S('osb 18x1250').total, 0, 'obrácené pořadí');
  // rozměr s písmennou předponou: M8x2000 = 8x2000, M8x80 = 8x80
  assert.deepEqual(names('zavitova tyc 8x2000'), ['HASPL Závitová tyč M8x2000, ZB 4.8']);
  assert.deepEqual(names('kotva pruvlakova 8x80'), ['HASPL Kotva průvlaková LSB M8x80 ZB']);
  assert.equal(S('kotva pruvlakova 80x8').total, 0, 'obrácené pořadí ani s předponou');
  assert.equal(S('kotva pruvlakova 8x8').total, 0, 'M8x80 není 8x8');
});

test('hlášky používají původní tvar slov', () => {
  const r = S('kabelová chránička');
  assert.deepEqual(r.missing, ['chránička']);
  assert.equal(r.rest, 'kabelová');
  assert.ok(r.restTotal > 0);
  assert.deepEqual(S('sanitární silikon').missing, ['sanitární']);
});

test('hlášky nejsou kategorické (index nemá popisy produktů)', () => {
  const src = fs.readFileSync(new URL('../search-v3.js', import.meta.url), 'utf8');
  assert.ok(!/nemáme/i.test(src), 'žádné „nemáme“');
  assert.ok(src.includes('Pro tento dotaz jsme nenašli odpovídající produkty.'));
  assert.ok(!/relaxed|partsMatch/.test(src), 'žádná náhradní shoda rozměrů');
});
