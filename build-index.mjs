// Stáhne produktový feed (formát Heureka) a postaví z něj kompaktní vyhledávací index.
// Produkty, které ve feedu chybí (např. vyřazené z Heureky), doplní z mapy webu (sitemap) a jejich stránek.
// Použití: node build-index.mjs [výstupní složka]
// Proměnné: FEED_URL (URL nebo cesta k souboru), MIN_ITEMS (pojistka proti prázdnému feedu),
//           SITEMAP_URL (prázdná hodnota = nedoplňovat z webu), EXTRA_MAX (max. počet stránek k doplnění),
//           PREV_INDEX_URL (minulý index, URL nebo soubor – zdroj už zjištěných jednotek; prázdná hodnota = nepoužít),
//           UNIT_PAGES (max. počet stránek výpisu kategorií za jeden build; 0 = jednotky nezjišťovat)
//
// Prodejní jednotka (ks / bal / m …) v Heureka feedu není, je jen na webu („189 Kč / bal“). Build ji čte
// z výpisů kategorií (20 produktů na stránku) – každou noc nejvýš UNIT_PAGES stránek, po dvou souběžně
// s pauzou, a kategorie střídá dokola. Už zjištěné jednotky přebírá z minulého indexu, takže se e-shop
// prochází postupně a nezatěžuje. Obsah balení („1000 ks“) je parametr „Obsah balení“ přímo ve feedu.
// Údaj, který se nepodaří zjistit, zůstane prázdný – nic se nedomýšlí.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { normUnit, normPack, listingUnits, pageUnit } from './build-units.mjs';

const FEED = process.env.FEED_URL || 'https://www.promontaz.cz/heureka/export/products.xml';
const SITEMAP = process.env.SITEMAP_URL ?? 'https://www.promontaz.cz/sitemap.xml';
const EXTRA_MAX = Number(process.env.EXTRA_MAX || 3000);
const OUT = process.argv[2] || 'public';
const MIN_ITEMS = Number(process.env.MIN_ITEMS || 1000);
const PREV_INDEX = process.env.PREV_INDEX_URL ?? 'https://dotejdne-cmd.github.io/promontaz-search/index.json';
const UNIT_PAGES = Number(process.env.UNIT_PAGES ?? 200);
const UA = { 'User-Agent': 'promontaz-search-builder' };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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
  const pk = /Obsah balení[\s\S]{0,200}?<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/.exec(html);
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
    unit: pageUnit(html),
    pack: pk ? normPack(pk[1].replace(/<[^>]+>/g, ' ')) : '',
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
  const pm = b.match(/<PARAM_NAME>\s*Obsah balení\s*<\/PARAM_NAME>\s*<VAL>([\s\S]*?)<\/VAL>/i);
  const pack = pm ? normPack(pm[1]) : '';
  const prev = byUrl.get(key);
  if (prev) {
    // varianta stejného produktu: sloučit kódy, nejnižší cena, skladem pokud je skladem kterákoli
    prev.variants++;
    for (const c of codes) prev.codes.add(c);
    if (Number.isFinite(price) && (!Number.isFinite(prev.price) || price < prev.price)) prev.price = price;
    prev.stock = Math.max(prev.stock, stock);
    if ((tag(b, 'PRODUCT') || name).length < prev.name.length) prev.name = tag(b, 'PRODUCT') || name;
    if (prev.pack !== pack) prev.pack = ''; // varianty s různým balením → údaj nechat prázdný
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
    unit: '',
    pack,
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

// ===== Prodejní jednotky =====
// 1) z minulého indexu (už zjištěné), 2) z výpisů kategorií – nejvýš UNIT_PAGES stránek za noc, dokola.
if (UNIT_PAGES > 0) {
  let fromPrev = 0;
  if (PREV_INDEX) {
    try {
      const prev = JSON.parse(/^https?:/i.test(PREV_INDEX) ? await getText(PREV_INDEX) : fs.readFileSync(PREV_INDEX, 'utf8'));
      for (const it of prev.items || []) {
        const p = it[10] && byUrl.get((prev.base || '') + it[1]);
        if (p && !p.unit) { p.unit = normUnit(it[10]); if (p.unit) fromPrev++; }
      }
    } catch (e) {
      console.warn(`Minulý index nenačten (${e.message}) – jednotky jen z dnešních stránek`);
    }
  }
  const origin = (() => { try { return new URL(FEED).origin; } catch { return 'https://www.promontaz.cz'; } })();
  const byCat = new Map();
  for (const p of byUrl.values()) {
    const m = /^(https?:\/\/[^/]+)\/([^/]+)\/[^/]+\/$/.exec(p.url);
    if (!m || m[1] !== origin) continue;
    if (!byCat.has(m[2])) byCat.set(m[2], { missing: 0, n: 0 });
    byCat.get(m[2]).n++;
    if (!p.unit) byCat.get(m[2]).missing++;
  }
  // Kategorie bez zjištěných jednotek napřed. Začátek se každý den posune o UNIT_PAGES odhadovaných
  // stránek (20 produktů na stránku), takže se postupně a rovnoměrně obnoví všechny kategorie.
  const day = Math.floor(Date.now() / 864e5);
  const rot = (a) => {
    if (!a.length) return a;
    const est = a.map(c => Math.max(1, Math.ceil(byCat.get(c).n / 20))), total = est.reduce((x, y) => x + y, 0);
    let at = day * UNIT_PAGES % total, i = 0;
    while (i < a.length - 1 && at >= est[i]) at -= est[i++];
    return a.slice(i).concat(a.slice(0, i));
  };
  const names = [...byCat.keys()].sort();
  const order = rot(names.filter(c => byCat.get(c).missing)).concat(rot(names.filter(c => !byCat.get(c).missing)));
  let budget = UNIT_PAGES, pages = 0, found = 0, changed = 0, failed = 0, ci = 0;
  const take = (html) => {
    for (const [href, unit] of listingUnits(html)) {
      const p = byUrl.get(origin + href);
      if (!p) continue;
      if (p.unit && p.unit !== unit) changed++;
      if (!p.unit) found++;
      p.unit = unit;
    }
  };
  const fetchPage = async (url) => {
    pages++;
    try { const h = await getText(url); await sleep(300); return h; }
    catch (e) { failed++; if (failed <= 5) console.warn(`  jednotky: ${e.message}`); return ''; }
  };
  // dva souběžné průchody, každý s pauzou 300 ms po stránce
  await Promise.all([0, 1].map(async () => {
    while (budget > 0 && ci < order.length) {
      const cat = order[ci++];
      budget--;
      const first = await fetchPage(`${origin}/${cat}/`);
      if (!first) continue;
      take(first);
      const last = Math.max(1, ...[...first.matchAll(new RegExp(`/${cat}/strana-(\\d+)/`, 'g'))].map(m => Number(m[1])));
      for (let n = 2; n <= last && budget > 0; n++) { budget--; take(await fetchPage(`${origin}/${cat}/strana-${n}/`)); }
    }
  }));
  const known = [...byUrl.values()].filter(p => p.unit).length;
  console.log(`Jednotky: ${known}/${byUrl.size} produktů (z minulého indexu ${fromPrev}, dnes nově ${found}, změněno ${changed}; ` +
    `${pages} stránek výpisu, ${ci}/${order.length} kategorií, chyby ${failed})`);
}

const products = [...byUrl.values()];
console.log(`Celkem: ${products.length} produktů (z feedu ${fromFeed}); obsah balení u ${products.filter(p => p.pack).length}`);
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
  // nové údaje jen na konec položky (Jarda 3.0.7 / 3.1.1 čte pozice 0–9): prodejní jednotka, obsah balení
  // U produktu s variantami se jednotka nezapisuje: varianty mohou mít různou (pytel × paleta).
  ...((p.variants > 1 ? '' : p.unit) || p.pack ? [p.variants > 1 ? '' : p.unit || '', p.pack || ''] : []),
]);

fs.mkdirSync(OUT, { recursive: true });
const data = { v: 1, built: new Date().toISOString(), base, imgBase, cats, manus, items };
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(data));
for (const f of ['search.js', 'search-v2.js', 'search-v3.js', 'ux.css', 'demo.html']) {
  if (fs.existsSync(f)) fs.copyFileSync(f, path.join(OUT, f));
}
const kb = Math.round(fs.statSync(path.join(OUT, 'index.json')).size / 1024);
console.log(`Index: ${items.length} produktů, ${kb} kB → ${OUT}/index.json`);
