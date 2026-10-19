# ProMontaz vyhledávání

Vlastní našeptávač a fulltext pro promontaz.cz. Provoz zdarma na GitHub Pages.

- `build-index.mjs` – každou noc stáhne Heureka feed a postaví `index.json`
- `search.js` – našeptávač, vkládá se do Shoptetu jedním řádkem
- `demo.html` – testovací stránka mimo e-shop
- `.github/workflows/build.yml` – noční automatické sestavení a zveřejnění

## Zapnutí pro všechny
V `search.js` změň `mode: 'test'` na `mode: 'all'` a ulož (Commit). Za ~2 minuty platí.

## Vypnutí
V Shoptetu smaž řádek se skriptem. Vrátí se původní vyhledávání.

## Testovací režim
- zapnout ve svém prohlížeči: https://www.promontaz.cz/?psearch=test
- vypnout: https://www.promontaz.cz/?psearch=off

## Měření v GA4
Události `naseptavac_hledani` (search_term, pocet_vysledku), `naseptavac_klik` (search_term, pozice, produkt) a `naseptavac_nic` (dotazy bez výsledku).
