# ProMontaz vyhledávání

Vlastní našeptávač a fulltext pro promontaz.cz. Provoz zdarma na GitHub Pages.

- `build-index.mjs` – každou noc stáhne Heureka feed, doplní produkty, které ve feedu chybí (ze sitemap a stránek produktů), a postaví `index.json`
- `keywords.json` – vyhledávací slova z exportu produktů (řada, typ, barva, objednací kód, vedlejší kategorie). Jen veřejné údaje – žádné nákupní ceny, marže ani sklad.
- `search.js` – našeptávač, vkládá se do Shoptetu jedním řádkem
- `demo.html` – testovací stránka mimo e-shop
- `.github/workflows/build.yml` – noční automatické sestavení a zveřejnění

## Vložení do Shoptetu
```html
<script src="https://dotejdne-cmd.github.io/promontaz-search/search.js" defer></script>
```

## Chování
- Psaní: 8 nejlepších výsledků.
- Enter / tlačítko Hledat / „Zobrazit všechny výsledky“: až 60 výsledků přímo v panelu.
- Druhý Enter nebo „Hledat v celém e-shopu“: klasické vyhledávání Shoptetu.

## Přepnutí režimu
V `search.js` je `mode: 'all'` (pro všechny). Pro testování jen u sebe změň na `mode: 'test'` a otevři https://www.promontaz.cz/?psearch=test (vypnutí: ?psearch=off).

## Vypnutí
V Shoptetu smaž řádek se skriptem. Vrátí se původní vyhledávání.

## Aktualizace klíčových slov
Nový export produktů (xlsx) převést na `keywords.json` (jen veřejné sloupce) a nahrát sem. Nové produkty se do vyhledávání dostanou i bez toho – jen bez doplňkových slov.

## Měření v GA4
Události `naseptavac_hledani` (search_term, pocet_vysledku), `naseptavac_klik` (search_term, pozice, produkt), `naseptavac_vse` (rozbalení všech výsledků) a `naseptavac_nic` (dotazy bez výsledku).
