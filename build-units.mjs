// Prodejní jednotka a obsah balení pro vyhledávací index (používá build-index.mjs, testuje test/build.test.mjs).
// Údaj, který se nepodaří přečíst, je prázdný ('') – nic se nedomýšlí.

function ent(s) {
  return String(s || '')
    .replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1')
    .replace(/&nbsp;|\u00a0/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');
}

// Prodejní jednotka jako v Jardovi (src/buy.js → normUnit): „/&nbsp;bal“ → bal, „kus“ → ks, „m²“ → m2
export function normUnit(u) {
  u = ent(u).replace(/<[^>]+>/g, ' ').replace(/^\s*\/\s*/, '').trim().toLowerCase().replace(/\.$/, '');
  if (/^(ks|kus|kusy|kusů)$/.test(u)) return 'ks';
  if (/^(bal|balení|baleni)$/.test(u)) return 'bal';
  if (/^(m|bm|metr)$/.test(u)) return 'm';
  if (/^(m2|m²)$/.test(u)) return 'm2';
  return /^[a-zá-ž0-9²³]{1,8}$/.test(u) ? u : '';
}
// Obsah balení „1000 ks“, „25 kg“, „0.5 l“ → „1000 ks“, „25 kg“, „0,5 l“; cokoli jiného → ''
export function normPack(v) {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*([a-zA-Zá-žÁ-Ž²³]{1,8})\s*$/.exec(ent(v).replace(/<[^>]+>/g, ' '));
  return m ? `${m[1].replace('.', ',')} ${m[2].toLowerCase()}` : '';
}
// Výpis kategorie Shoptetu → [[cesta produktu, jednotka], …]
export function listingUnits(html) {
  const out = [];
  for (const b of String(html).split(/<div class="product"[\s>]/).slice(1)) {
    const href = (b.match(/href="(\/[^"#?]+\/)"/) || [])[1];
    const unit = normUnit((b.match(/class="pr-list-unit"[^>]*>([\s\S]*?)<\/span>/) || [])[1]);
    if (href && unit) out.push([href, unit]);
  }
  return out;
}
// Stránka produktu → jednotka u konečné ceny („p-final-price-wrapper … pr-list-unit“), jako Jarda
export function pageUnit(html) {
  const wrap = /class="p-final-price-wrapper"[\s\S]*?<\/strong>/.exec(html);
  const un = wrap && /class="pr-list-unit"[^>]*>([\s\S]*?)<\/span>/.exec(wrap[0]);
  return un ? normUnit(un[1]) : '';
}

/* Obnova prodejních jednotek z výpisů kategorií (volá build-index.mjs).
   products: Map url → produkt ({ url, unit, unitFresh? }), mění se na místě.
   prev: minulý index (nebo null), fetchText(url) → HTML ('' při chybě), today: číslo dne.
   - jednotka z minulého indexu se převezme jen z kategorie úplně zkontrolované před nejvýš maxAge dny
   - kategorie se procházejí od nejdéle nekontrolované (nikdy = první), nejvýš `pages` stránek, vždy celé
   - úplně prošlá kategorie: jednotka z výpisu přepíše starou; produkt, který ve výpisu chybí, jednotku ztratí
     (kromě jednotky přečtené dnes přímo ze stránky produktu – unitFresh)
   Vrací { checked: {kategorie: den}, unitPages: {kategorie: počet stránek výpisu}, stats }. */
export async function refreshUnits({ products, prev, origin, today, pages, maxAge = 14, fetchText, concurrency = 2 }) {
  const catOf = (url) => { const m = /^(https?:\/\/[^/]+)\/([^/]+)\/[^/]+\/$/.exec(url); return m && m[1] === origin ? m[2] : null; };
  const stats = { fromPrev: 0, expired: 0, found: 0, changed: 0, cleared: 0, pages: 0, cats: 0, complete: 0, failed: 0, skipped: 0 };
  const prevChecked = (prev && prev.unitChecked) || {};
  if (prev) for (const it of prev.items || []) {
    const p = it[10] && products.get((prev.base || '') + it[1]);
    if (!p || p.unit) continue;
    const cat = catOf(p.url), at = cat != null ? prevChecked[cat] : undefined;
    if (at != null && today - at <= maxAge) { p.unit = normUnit(it[10]); if (p.unit) stats.fromPrev++; }
    else stats.expired++;
  }
  const byCat = new Map();
  for (const p of products.values()) {
    const c = catOf(p.url);
    if (c == null) continue;
    if (!byCat.has(c)) byCat.set(c, []);
    byCat.get(c).push(p);
  }
  const checked = {};
  for (const c of byCat.keys()) if (prevChecked[c] != null && today - prevChecked[c] <= maxAge) checked[c] = prevChecked[c];
  const order = [...byCat.keys()].sort((a, b) => (checked[a] ?? -1e9) - (checked[b] ?? -1e9) || (a < b ? -1 : 1));
  // skutečný počet stránek výpisu z minulé návštěvy (výpis může obsahovat i produkty podkategorií)
  const pagesOf = {};
  for (const c of byCat.keys()) pagesOf[c] = (prev && prev.unitPages && prev.unitPages[c]) || Math.max(1, Math.ceil(byCat.get(c).length / 20));
  let budget = pages, ci = 0;
  const get = async (url) => { stats.pages++; const h = await fetchText(url); if (!h) stats.failed++; return h; };
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (budget > 0 && ci < order.length) {
      const cat = order[ci++];
      // celou kategorii, nebo vůbec: stránky se rezervují předem; co se nevejde, počká na další noc
      // (zůstane první v pořadí) – rozpracovaná kategorie by se nedala označit jako zkontrolovaná
      const own = byCat.get(cat);
      // výpis mnohem delší než vlastní produkty (nadřazená kategorie: „elektromaterial“ 146 stránek kvůli
      // 2 produktům) → číst rovnou stránky těch produktů
      const direct = (n) => n > Math.ceil(own.length / 20) * 3 + 2 && own.length < n;
      const viaPages = async () => {
        let ok = true;
        for (const p of own) {
          const h = await get(p.url);
          if (!h) { ok = false; continue; }
          const unit = pageUnit(h);
          if (p.unit && unit && p.unit !== unit) stats.changed++;
          if (!p.unit && unit) stats.found++;
          if (p.unit && !unit && !p.unitFresh) stats.cleared++;
          p.unit = unit || (p.unitFresh ? p.unit : '');
        }
        if (ok) { checked[cat] = today; stats.complete++; }
      };
      if (direct(pagesOf[cat])) {
        if (own.length > budget) { stats.skipped++; continue; }
        budget -= own.length; stats.cats++;
        await viaPages();
        continue;
      }
      let need = pagesOf[cat];
      if (need > budget) { stats.skipped++; continue; }
      budget -= need; stats.cats++;
      const first = await get(`${origin}/${cat}/`);
      if (!first) { budget += need - 1; continue; }
      const last = Math.max(1, ...[...first.matchAll(new RegExp(`/${cat}/strana-(\\d+)/`, 'g'))].map(m => Number(m[1])));
      pagesOf[cat] = last;
      if (direct(last)) {                    // zjištěno až teď: místo 146 stránek výpisu jen stránky produktů
        budget += need - 1;
        if (own.length > budget) { stats.skipped++; continue; }
        budget -= own.length;
        await viaPages();
        continue;
      }
      if (last < need) { budget += need - last; need = last; }
      if (last > need) {
        if (last - need > budget) { budget += need - 1; stats.skipped++; continue; } // příště už se správným počtem
        budget -= last - need; need = last;
      }
      const htmls = [first];
      let complete = true;
      for (let n = 2; n <= last; n++) {
        const h = await get(`${origin}/${cat}/strana-${n}/`);
        if (!h) { complete = false; continue; }
        htmls.push(h);
      }
      const seen = new Set();
      for (const h of htmls) for (const [href, unit] of listingUnits(h)) {
        const p = products.get(origin + href);
        if (!p) continue;
        seen.add(p);
        if (p.unit && p.unit !== unit) stats.changed++;
        if (!p.unit) stats.found++;
        p.unit = unit;
      }
      if (complete) {
        for (const p of byCat.get(cat)) if (!seen.has(p) && p.unit && !p.unitFresh) { p.unit = ''; stats.cleared++; }
        checked[cat] = today;
        stats.complete++;
      }
    }
  }));
  const unitPages = {};
  for (const c of byCat.keys()) unitPages[c] = pagesOf[c];
  return { checked, unitPages, stats };
}
