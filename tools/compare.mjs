// Porovnání v2 × v3 nad indexem. Použití: node tools/compare.mjs [cesta k index.json] [dotazy oddělené |]
// Bez parametrů: test/fixture-index.json a dotazy z auditu + regresní sada.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const v2 = require('../search-v2.js');
const v3 = require('../search-v3.js');

const file = process.argv[2] || new URL('../test/fixture-index.json', import.meta.url);
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const Q = process.argv[3] ? process.argv[3].split('|') : [
  'cyky 3x2.5', 'cyky 3x2,5mm2', 'kvh 120x120', 'osb 18', 'osb deska 18', 'osb 18mm', 'turbošroub', 'husí krk',
  'kabelova chranicka', 'kotva do ytongu', 'pozinkovany vrut', 'sanitarni silikon',
  'WAGO 221-413', '221413', '4050821808442', 'EL_SVO_81585726', 'VR_10796', 'cyky 5x2,5', '3m paska'
];
const e2 = v2.createEngine(data), e3 = v3.createEngine(data, v3.CONFIG);
const short = s => s.length > 48 ? s.slice(0, 47) + '…' : s;
for (const q of Q) {
  const a = e2.search(q, 3), b = e3.search(q, 3);
  console.log(`\n■ ${q}`);
  console.log(`  v2: ${String(a.total).padStart(4)} | ${a.items.map(i => short(i.name)).join(' ‖ ') || '—'}`);
  const note = b.missing.length ? ` [nenalezeno: ${b.missing.join(', ')}${b.rest ? `; nabídne „${b.rest}“ (${b.restTotal})` : ''}]` : '';
  console.log(`  v3: ${String(b.total).padStart(4)} | ${b.items.map(i => short(i.name)).join(' ‖ ') || '—'}${note}`);
}
