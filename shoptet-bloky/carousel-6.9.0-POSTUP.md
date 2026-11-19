# Carousel 6.9.0 – externí JS (limit záhlaví 8192 znaků)
## 1. Ze Záhlaví ODSTRANIT (6 576 znaků)
- celý `<style id="pm-carousel-v6-8-style"> … </style>`
- celý `<script id="pm-carousel-v6-8"> … </script>`
## 2. Na jejich místo VLOŽIT (976 znaků) – obsah `carousel-zahlavi-6.9.0.html`
## 3. Veřejné URL
- https://dotejdne-cmd.github.io/promontaz-search/assets/carousel/pm-carousel-6.9.0.js (200, application/javascript, max-age=600; obsahuje i styly karet z v6.8 – nic se nezdvojuje)
- zdroj: assets/carousel/pm-carousel-6.9.0.js v repu (verze se nepřepisují; nová verze = nový soubor + změna čísla v záhlaví)
## 4. Rollback
Záhlaví: smazat 3 vložené řádky a vrátit `carousel-v6-8-zaloha.html` (původní 6 576 znaků; vejde se, je to přesně dnešní stav).
Výpadek GitHub Pages řeší blok sám: onerror / 6 s bez karet → třída pmc-fail → nativní carousel Shoptetu.
## Ověřeno (cold, 4G 6,4 Mb/s + RTT 150 ms, CPU 4×, produkční HTML s podstrčeným blokem, JS ze skutečné URL)
- velký banner: dnes vidět 1,8–2,0 s → s 6.9.0 ani jednou (8/8 běhů)
- karty postaveny 60–200 ms po FCP (dnes 1,4–1,8 s po FCP)
- FCP desktop 1,58–1,96 s / mobil 1,58–1,67 s (dnes 1,55–1,67 / 1,52–1,56 – v rozptylu měření)
- CLS desktop 0,010–0,017 (dnes 0,022); mobil 0,128 beze změny (cookie lišta + lišta výhod, ne carousel)
- fallback: JS blokovaný / za 8 s / chyba → nativní carousel viditelný, bez prázdné plochy
