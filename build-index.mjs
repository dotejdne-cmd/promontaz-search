// Stáhne produktový feed (formát Heureka) a postaví z něj kompaktní vyhledávací index.
// Produkty, které ve feedu chybí (např. vyřazené z Heureky), doplní z mapy webu (sitemap) a jejich stránek.
// Použití: node build-index.mjs [výstupní složka]
// Proměnné: FEED_URL (URL nebo cesta k souboru), MIN_ITEMS (pojistka proti prázdnému feedu),
//           SITEMAP_URL (prázdná hodnota = nedoplňovat z webu), EXTRA_MAX (max. počet stránek k doplnění)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const FEED = process.env.FEED_URL || 'https://www.promontaz.cz/heureka/export/products.xml';
const SITEMAP = process.env.SITEMAP_URL ?? 'https://www.promontaz.cz/sitemap.xml';
const EXTRA_MAX = Number(process.env.EXTRA_MAX || 3000);
const OUT = process.argv[2] || 'public';
const MIN_ITEMS = Number(process.env.MIN_ITEMS || 1000);
const UA = { 'User-Agent': 'promontaz-search-builder' };

async function getText(url) {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return (buf[0] === 0x1f && buf[1] === 0x8b ? zlib.gunzipSync(buf) : buf).toString('utf8');
}

async function sitemapUrls() {
  const locsOf = (xml) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => decode(m[1]));
  const root = locsOf(await getText(SITEMAP));
  const subs = root.filter(u => /\.xml(\.gz)?$/i.test(u));
  const out = root.filter(u => !subs.includes(u));
  for (const s of subs) out.push(...locsOf(await getText(s)));
  return out;
}

// Najde v HTML objekt "product": {...} (datová vrstva Shoptetu) a vrátí ho jako JSON.
function extractProduct(html) {
  const key = '"product":';
  let from = 0;
  while ((from = html.indexOf(key, from)) >= 0) {
    const start = html.indexOf('{', from + key.length);
    if (start < 0) return null;
    from += key.length;
    if (!/^\s*$/.test(html.slice(from, start))) continue;
    let depth = 0, inStr = false, esc = false, i = start;
    for (; i < html.length; i++) {
      const ch = html[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === '{') depth++;
      else if (ch === '}' && --depth === 0) break;
    }
    try {
      const o = JSON.parse(html.slice(start, i + 1));
      if (o && typeof o.name === 'string' && (o.code || o.id)) return o;
    } catch {}
  }
  return null;
}

async function pageProduct(url) {
  const html = await getText(url);
  const o = extractProduct(html);
  if (!o) return null;
  const img = (html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) || [])[1] || '';
  const avail = (html.match(/class="availability-label"[^>]*>([^<]*)</i) || [])[1] || '';
  const codes = [o.code, ...(Array.isArray(o.codes) ? o.codes.map(c => c && c.code) : [])].filter(Boolean).map(String);
  return {
    name: o.name.trim(),
    url,
    img: decode(img),
    price: Number(o.priceWithVat),
    manu: o.manufacturer || '',
    cat: o.defaultCategory || o.currentCategory || '',
    codes: new Set(codes),
    stock: /skladem/i.test(avail) ? 1 : 0,
    variants: o.hasVariants ? 2 : 1,
  };
}

async function runPool(list, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < list.length) await fn(list[i++]); }));
}

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

const fromFeed = byUrl.size;
if (SITEMAP) {
  try {
    const locs = await sitemapUrls();
    const todo = [...new Set(locs.map(u => u.split('?')[0].split('#')[0]))]
      .filter(u => /^https?:\/\/[^/]+\/[^/]+\/[^/]+\/$/.test(u) && !byUrl.has(u))
      .slice(0, EXTRA_MAX);
    console.log(`Sitemap: ${locs.length} adres, mimo feed ${todo.length} ke kontrole`);
    let added = 0, notProduct = 0, failed = 0;
    await runPool(todo, 4, async (u) => {
      try {
        const p = await pageProduct(u);
        if (p) { byUrl.set(u, p); added++; } else notProduct++;
      } catch (e) {
        failed++;
        if (failed <= 5) console.warn(`  chyba: ${e.message}`);
      }
    });
    console.log(`Doplněno z webu: ${added} produktů (stránky bez produktu: ${notProduct}, chyby: ${failed})`);
  } catch (e) {
    console.warn(`Doplnění ze sitemap přeskočeno: ${e.message}`);
  }
}

const products = [...byUrl.values()];
console.log(`Celkem: ${products.length} produktů (z feedu ${fromFeed})`);
if (products.length < MIN_ITEMS) {
  throw new Error(`Jen ${products.length} produktů (minimum ${MIN_ITEMS}). Index nezveřejňuji, aby se nerozbilo vyhledávání.`);
}

// Klíčová slova z exportu produktů (řada, typ, barva, objednací kód…), párováno podle kódu produktu
let kwMap = {};
if (fs.existsSync('keywords.json')) {
  kwMap = JSON.parse(fs.readFileSync('keywords.json', 'utf8'));
  const seen = new Set();
  let withKw = 0;
  for (const p of products) {
    const kws = [];
    for (const c of p.codes) if (c in kwMap) { seen.add(c); if (kwMap[c]) kws.push(kwMap[c]); }
    p.kw = [...new Set(kws.join(' ').split(' '))].filter(Boolean).join(' ');
    if (p.kw) withKw++;
  }
  const missing = Object.keys(kwMap).filter(c => !seen.has(c));
  console.log(`Klíčová slova: ${withKw} produktů; v exportu, ale ne na webu ani ve feedu: ${missing.length}`);
  if (missing.length) console.log(`  např. ${missing.slice(0, 40).join(', ')}`);
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
  p.kw || '',
]);

fs.mkdirSync(OUT, { recursive: true });
const data = { v: 1, built: new Date().toISOString(), base, imgBase, cats, manus, items };
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(data));
for (const f of ['search.js', 'search-v2.js', 'demo.html']) {
  if (fs.existsSync(f)) fs.copyFileSync(f, path.join(OUT, f));
}
const kb = Math.round(fs.statSync(path.join(OUT, 'index.json')).size / 1024);
console.log(`Index: ${items.length} produktů, ${kb} kB → ${OUT}/index.json`);
