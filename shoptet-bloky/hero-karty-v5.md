# Hero karty v5 → carousel homepage (Shoptet admin → Vzhled a obsah → Bannery → Homepage carousel)
Carousel v6.8 bere jen bannery s alt začínajícím `PMCARD |` (4–8 ks, 4:5). Pořadí = pořadí bannerů.
Soubory (JPG 1080×1350, ~100–200 kB; WebP varianty vedle): https://dotejdne-cmd.github.io/promontaz-search/assets/hero/

| # | Soubor | Odkaz | Alt (přesně) |
|---|---|---|---|
| 1 | hero-karta-1-naceneni-1080x1350.jpg | /nacenit-material/ | PMCARD \| Nechat nacenit seznam materiálu |
| 2 | hero-karta-2-kalkulacky-1080x1350.jpg | /kalkulacky/ | PMCARD \| 12 kalkulaček materiálu zdarma |
| 3 | hero-karta-3-splatnost-1080x1350.jpg | /#pmH | PMCARD \| Faktura se splatností pro firmy |
| 4 | hero-karta-4-dohledame-1080x1350.jpg | /nacenit-material/ | PMCARD \| Nemáme to v e-shopu? Dohledáme |
| 5 | hero-karta-5-pro-sleva-1080x1350.jpg | /vernostni-program/ | PMCARD \| ProMontaz PRO – sleva 2 % hned, až 5 % |
| 6 | hero-karta-6-doprava-1080x1350.jpg | /spojovaci-material/ | PMCARD \| Objednejte materiál online |

Odstranit současné: karta-3-kalkulacky (uvádí „6 kalkulaček“, web jich má 12) a karta-5-spojovak („EXPEDICE DO 48 H · Skladem“ – u dropshippingu neověřené). karta-1 a karta-6 nahrazují karty 1 a 5.
Tvrzení na kartách se kryjí s tím, co web už publikuje (lišta výhod „Nacenění ještě dnes“, blok #pmH „obvykle do 24 hodin“, /vernostni-program/ „2 % hned, s obratem až 5 %“). Při změně kterékoli z těchto podmínek karty stáhnout.
Ověřeno náhledem na živé homepage (Playwright, karty podstrčené do carouselu): desktop 4 karty 279×348, mobil 326×407, bez JS chyb, CLS 0,022 / 0,033.
