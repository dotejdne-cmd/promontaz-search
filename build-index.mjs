// Stáhne produktový feed (formát Heureka) a postaví z něj kompaktní vyhledávací index.
// Použití: node build-index.mjs [výstupní složka]
// Proměnné: FEED_URL (URL nebo cesta k souboru), MIN_ITEMS (pojistka proti prázdnému feedu)
import fs from 'node:fs';
import path from 'node:path';

const FEED = process.env.FEED_URL || 'https://www.promontaz.cz/heureka/export/products.xml';
const OUT = process.argv[2] || 'public';
const MIN_ITEMS = Number(process.env.MIN_ITEMS || 1000);

async function loadFeed() {
  if (!/^https?:/i.test(FEED)) return fs.readFileSync(FEED, 'utf8');
  const res = await fetch(FEED, { headers: { 'User-Agent': 'promontaz-search-builder' } });
  if (!res.ok) throw new Error(`Feed vrátil HTTP ${res.status}. Zkontroluj v Shoptetu záložku XML feedy → Zabezpečení.`);
  return res.text();
}

function decode(s) {
  return s
    .replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .trim();
}

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decode(m[1]) : '';
}

function commonPrefix(list) {
  if (!list.length) return '';
  let p = list[0];
  for (const s of list) {
    let i = 0;
    while (i < p.length && i < s.length && p[i] === s[i]) i++;
    p = p.slice(0, i);
    if (!p) break;
  }
  return p.slice(0, p.lastIndexOf('/') + 1);
}

const xml = await loadFeed();
const blocks = xml.split(/<SHOPITEM>/i).slice(1);
console.log(`Feed: ${blocks.length} položek`);

const byUrl = new Map();
for (const b of blocks) {
  const name = tag(b, 'PRODUCTNAME') || tag(b, 'PRODUCT');
  const url = tag(b, 'URL');
  if (!name || !url) continue;
  const key = url.split('?')[0].split('#')[0];
  const price = parseFloat(tag(b, 'PRICE_VAT').replace(/\s/g, '').replace(',', '.'));
  const codes = [tag(b, 'ITEM_ID'), tag(b, 'PRODUCTNO'), tag(b, 'EAN')].filter(Boolean);
  const stock = tag(b, 'DELIVERY_DATE') === '0' ? 1 : 0;
  const prev = byUrl.get(key);
  if (prev) {
    // varianta stejného produktu: sloučit kódy, nejnižší cena, skladem pokud je skladem kterákoli
    prev.variants++;
    for (const c of codes) prev.codes.add(c);
    if (Number.isFinite(price) && (!Number.isFinite(prev.price) || price < prev.price)) prev.price = price;
    prev.stock = Math.max(prev.stock, stock);
    if ((tag(b, 'PRODUCT') || name).length < prev.name.length) prev.name = tag(b, 'PRODUCT') || name;
    continue;
  }
  byUrl.set(key, {
    name,
    url: key,
    img: tag(b, 'IMGURL'),
    price,
    manu: tag(b, 'MANUFACTURER'),
    cat: tag(b, 'CATEGORYTEXT'),
    codes: new Set(codes),
    stock,
    variants: 1,
  });
}

const products = [...byUrl.values()];
if (products.length < MIN_ITEMS) {
  throw new Error(`Jen ${products.length} produktů (minimum ${MIN_ITEMS}). Index nezveřejňuji, aby se nerozbilo vyhledávání.`);
}

const base = commonPrefix(products.map(p => p.url));
const imgBase = commonPrefix(products.map(p => p.img).filter(Boolean));
const cats = [], catIdx = new Map();
const manus = [], manuIdx = new Map();
const idx = (arr, map, v) => { if (!map.has(v)) { map.set(v, arr.length); arr.push(v); } return map.get(v); };

const items = products.map(p => [
  p.name,
  p.url.slice(base.length),
  p.img && p.img.startsWith(imgBase) ? p.img.slice(imgBase.length) : p.img,
  Number.isFinite(p.price) ? Math.round(p.price * 100) / 100 : null,
  idx(manus, manuIdx, p.manu),
  [...p.codes].join(' '),
  idx(cats, catIdx, p.cat),
  p.stock,
  p.variants > 1 ? 1 : 0,
]);

fs.mkdirSync(OUT, { recursive: true });
const data = { v: 1, built: new Date().toISOString(), base, imgBase, cats, manus, items };
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(data));
for (const f of ['search.js', 'demo.html']) {
  if (fs.existsSync(f)) fs.copyFileSync(f, path.join(OUT, f));
}
const kb = Math.round(fs.statSync(path.join(OUT, 'index.json')).size / 1024);
console.log(`Index: ${items.length} produktů, ${kb} kB → ${OUT}/index.json`);
