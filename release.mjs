// Sestavení vydání pro GitHub Pages (volá build-index.mjs; samostatně: node release.mjs <výstup> [--index-from URL]).
//   search-v3.js       = channel.js + versions/search-v3-<psearch.stable>.js   ← to vkládá Shoptet (zákazníci)
//   search-v3-next.js  = search-v3.js z repa (nejnovější, otestovaná verze)    ← jen s ?psearch3=next
//   search-v3-<v>.js   = každá verze z versions/ (neměnné, pro rollback a srovnání)
// Rollback: v package.json změnit psearch.stable na předchozí verzi a zveřejnit (push do main,
// nebo Actions → „Vyhledávací index“ → Run workflow → „rychle“ = jen přepnout, index se převezme z webu).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

export function releaseConfig(root = ROOT) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const stable = pkg.psearch && pkg.psearch.stable;
  if (!stable || !fs.existsSync(path.join(root, 'versions', `search-v3-${stable}.js`))) {
    throw new Error(`psearch.stable = ${stable}: chybí versions/search-v3-${stable}.js – nic nezveřejňuji`);
  }
  return { stable };
}

export function writeRelease(out, root = ROOT) {
  const { stable } = releaseConfig(root);
  fs.mkdirSync(out, { recursive: true });
  for (const f of ['search.js', 'search-v2.js', 'ux.css', 'demo.html']) {
    if (fs.existsSync(path.join(root, f))) fs.copyFileSync(path.join(root, f), path.join(out, f));
  }
  const versions = fs.readdirSync(path.join(root, 'versions')).filter(f => /^search-v3-\d+\.\d+\.\d+\.js$/.test(f));
  for (const f of versions) fs.copyFileSync(path.join(root, 'versions', f), path.join(out, f));
  const channel = fs.readFileSync(path.join(root, 'channel.js'), 'utf8');
  const stableSrc = fs.readFileSync(path.join(root, 'versions', `search-v3-${stable}.js`), 'utf8');
  fs.writeFileSync(path.join(out, 'search-v3.js'), channel + '\n' + stableSrc);
  fs.copyFileSync(path.join(root, 'search-v3.js'), path.join(out, 'search-v3-next.js'));
  fs.writeFileSync(path.join(out, 'release.json'), JSON.stringify({ stable, next: 'search-v3-next.js', versions, built: new Date().toISOString() }, null, 1));
  return { stable, versions };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = process.argv[2] || 'public';
  const i = process.argv.indexOf('--index-from');
  if (i > 0) {
    const res = await fetch(process.argv[i + 1], { signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw new Error(`index HTTP ${res.status}`);
    const txt = await res.text();
    const d = JSON.parse(txt);
    if (!Array.isArray(d.items) || d.items.length < 1000) throw new Error(`index má jen ${d.items && d.items.length} položek – nic nezveřejňuji`);
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'index.json'), txt);
    console.log(`Index převzat: ${d.items.length} položek (build ${d.built})`);
  }
  const r = writeRelease(out);
  console.log(`Vydání: search-v3.js = stabilní ${r.stable}; search-v3-next.js = repo; verze: ${r.versions.join(', ')}`);
}
