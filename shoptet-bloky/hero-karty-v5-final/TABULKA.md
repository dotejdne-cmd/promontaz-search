# Hero karty v5 – nahrání do Shoptetu (carousel na homepage)
Admin: Vzhled a obsah → Bannery → pozice homepage carousel. Rozměr 1080×1350 (4:5). Carousel v6.8 zobrazí jen bannery, jejichž alt začíná `PMCARD |`; pořadí karet = pořadí bannerů.

| Pořadí | Soubor | Cílová URL | ALT (přesně, včetně „PMCARD | “) |
|---|---|---|---|
| 1 | hero-karta-1-naceneni-1080x1350.jpg | /nacenit-material/ | PMCARD \| Nechat nacenit seznam materiálu |
| 2 | hero-karta-2-kalkulacky-1080x1350.jpg | /kalkulacky/ | PMCARD \| 12 kalkulaček materiálu zdarma |
| 3 | hero-karta-3-splatnost-1080x1350.jpg | /#pmH | PMCARD \| Faktura se splatností pro firmy |
| 4 | hero-karta-4-dohledame-1080x1350.jpg | /nacenit-material/ | PMCARD \| Nemáme to v e-shopu? Dohledáme |
| 5 | hero-karta-5-pro-sleva-1080x1350.jpg | /vernostni-program/ | PMCARD \| ProMontaz PRO – sleva 2 % hned, až 5 % |
| 6 | hero-karta-6-doprava-1080x1350.jpg | /spojovaci-material/ | PMCARD \| Objednejte materiál online |

Postup: 1) nahrát 6 bannerů v tomto pořadí s odkazem a ALT z tabulky, 2) smazat 4 současné bannery PMCARD (karta-1-naceneni, karta-3-kalkulacky, karta-5-spojovak, karta-6-pro-firmy), 3) uložit. Carousel se přestaví sám (JS se nemění).

Upravená tvrzení (bez časových a cenových garancí):
- karta 1: štítek „ZDARMA · NACENÍ ČLOVĚK“ → „FOTKA · EXCEL · VÝKAZ“; podtitulek „U nás v pracovní dny ještě týž den…“ → „Pošlete fotku, Excel i výkaz výměr. Seznam nacení člověk, ne robot.“
- karta 3: „Odpověď obvykle do 24 hodin“ → „Faktura na IČO, splatnost na žádost. Podmínky domluvíme pro vaši firmu.“
- karta 4: „Najdeme, ověříme dostupnost a naceníme“ → „Napište, co sháníte. Ověříme dostupnost a ozveme se.“
- karty 2, 5, 6 beze změny: 12 kalkulaček (na webu 12), „2 % sleva hned, až 5 %“ (/vernostni-program/), „Materiál pošleme k vám nebo rovnou na stavbu“ (homepage).

Ověřeno simulací na živé homepage (6 položek PMCARD vložených do HTML jako po nahrání): desktop i mobil 6 karet ve správném pořadí, všechny načtené v 1080 px, posun šipkou/swipem funguje, všech 6 prokliků → správná URL (200, kotva #pmH existuje), bez JS chyb, CLS shodné s dnešní produkcí.
