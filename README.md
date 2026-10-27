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

## Verze 3 (`search-v3.js`)
Změny proti v2 (v2 zůstává beze změny jako záloha):
- normalizace: `×`/`*`/`x`, desetinná čárka i tečka, mezery kolem `x`, jednotky (`mm`, `mm2`, `mm²`, `cm`, `ml`, `kg`, `ks`), diakritika
- spojená slova: `turbošroub` → `turbo šroub` (jen když obě části v katalogu existují)
- synonyma i pro tvary slov (`pozinkovaný/é/ých` → ZB, ZZ, zinek; `ytong` ↔ `pórobeton`) – nikdy nepárovat technicky odlišné výrobky
- překlepy bezpečněji: 1 znak od 5 písmen, 2 znaky od 10; useknutý konec se nebere (`chránička` ≠ `chránič`)
- čísla se nikdy nedoplňují (`m8` ≠ `m80`, `18` ≠ `180`, `2x1` ≠ `2x1,5`) a rozměry se nepřehazují (`4000x100` ≠ `100/100/4000`); stejná hodnota v jiném zápisu se najde (`3x1,50` = `3x1.5`, `3 x 2,5 mm²` = `3x2,5`)
- dílčí rozměr jen ve správném pořadí polí: `120x120` i `120x5000` najdou `KVH 120/120/5000`, `1250x18` najde `OSB 2500/1250/18`
- když některé slovo nebo číslo nic nenajde, výsledek je prázdný („Pro tento dotaz jsme nenašli odpovídající produkty.“) – nic se nedomýšlí; tlačítko „Zobrazit výsledky jen pro …“ nabídne širší hledání jako volbu zákazníka. Index nemá popisy produktů, proto hláška netvrdí, že zboží v sortimentu není.
- přesné kódy (EAN, kód, objednací kód, `221-413`, `221413`) mají vždy přednost
- stránka `/vyhledavani/`: nad výpis Shoptetu se vloží „Nalezené produkty“ z tohoto vyhledávání (`resultsPage: 'prepend'`; `'replace'` výpis Shoptetu skryje; `'off'` vypne)
- GA4 navíc: `naseptavac_stranka`, `naseptavac_stranka_klik`, `naseptavac_zbytek`; `naseptavac_nic` má parametr `chybi`

Testovací režim bez úpravy souboru: `<script src="https://dotejdne-cmd.github.io/promontaz-search/search-v3.js" data-mode="test" defer></script>`
a otevřít https://www.promontaz.cz/?psearch3=test (vypnutí `?psearch3=off`). Řádek v3 vložte **před** řádek v2: aktivní v3 pak v2 k poli nepustí (jeden našeptávač, jedna obsluha kláves, jedno měření); bez testovacího parametru se v3 nezapne a běží jen v2. Je-li řádek v3 až za v2, v3 se pro jistotu nezapne vůbec.

Testy: `npm test`; v GitHub Actions běží pro každý pull request a vedlejší větev (`test.yml`) a před každým zveřejněním z main (`build.yml`). Porovnání v2 × v3: `npm run compare` nebo `node tools/compare.mjs cesta/k/index.json "dotaz1|dotaz2"`.
