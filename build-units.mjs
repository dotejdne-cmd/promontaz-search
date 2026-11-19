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
