// Regrese v3: search-v3.js z gitu (výchozí main) × pracovní kopie nad stejným indexem.
// Použití: node tools/regress.mjs [index.json] [git ref] [--md]
//   bez indexu: test/fixture-index.json; dotazy: tools/regress-queries.txt (jeden na řádek, # = komentář)
// Vypíše každý dotaz, u kterého se změnil počet nebo pořadí prvních 60 výsledků, a co přibylo/ubylo.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const md = process.argv.includes('--md');
const file = args[0] || new URL('../test/fixture-index.json', import.meta.url);
const ref = args[1] || 'main';
const root = new URL('..', import.meta.url).pathname;

const oldSrc = execFileSync('git', ['show', `${ref}:search-v3.js`], { cwd: root }).toString();
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'psearch-')), 'search-v3-old.js');
fs.writeFileSync(tmp, oldSrc);
const vOld = require(tmp), vNew = require('../search-v3.js');

const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const Q = fs.readFileSync(new URL('./regress-queries.txt', import.meta.url), 'utf8')
  .split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#'));
const eOld = vOld.createEngine(data, vOld.CONFIG), eNew = vNew.createEngine(data, vNew.CONFIG);

let changed = 0;
const rows = [];
for (const q of Q) {
  const a = eOld.search(q, 60), b = eNew.search(q, 60);
  const an = a.items.map(i => i.name), bn = b.items.map(i => i.name);
  const same = a.total === b.total && an.join('\n') === bn.join('\n');
  if (same) { rows.push({ q, a: a.total, b: b.total, same }); continue; }
  changed++;
  rows.push({ q, a: a.total, b: b.total, same, plus: bn.filter(n => !an.includes(n)), minus: an.filter(n => !bn.includes(n)), top: bn[0] || '—', missing: b.missing });
}

if (md) {
  console.log('| dotaz | před | po | změna |');
  console.log('|---|---:|---:|---|');
  for (const r of rows) {
    const note = r.same ? 'beze změny' :
      [r.minus.length ? `ubylo ${r.minus.length}: ${r.minus.slice(0, 3).join('; ')}${r.minus.length > 3 ? '…' : ''}` : '',
        r.plus.length ? `přibylo ${r.plus.length}: ${r.plus.slice(0, 3).join('; ')}${r.plus.length > 3 ? '…' : ''}` : '',
        !r.minus.length && !r.plus.length ? 'jiné pořadí' : ''].filter(Boolean).join(' · ');
    console.log(`| \`${r.q}\` | ${r.a} | ${r.b} | ${note.replace(/\|/g, '\\|')} |`);
  }
} else {
  for (const r of rows) {
    if (r.same) continue;
    console.log(`\n■ ${r.q}: ${r.a} → ${r.b}  (1. ${r.top})`);
    if (r.minus.length) console.log('  − ' + r.minus.join('\n  − '));
    if (r.plus.length) console.log('  + ' + r.plus.join('\n  + '));
  }
}
console.log(`\n${Q.length} dotazů, změněno ${changed}`);
