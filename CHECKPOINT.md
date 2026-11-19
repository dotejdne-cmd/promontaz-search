# Checkpoint – optimalizace v7 (19. 11. 2026)

## Nasazeno
- `ux.css` v15: horní lišta 1200–1599 px v jednom řádku (dřív se po asynchronním načtení ux.css zalomila do 2 řádků → posun celé stránky o 48 px, laboratorní CLS desktop 0,70–0,87 na všech stránkách). GDPR a Reklamační řád v horní liště skryty jen pro 1200–1599 px (zůstávají v patičce), e-mail 1200–1439 px jen ikona (odkaz funguje).
- `ux.css` v15: zrušeno pozdní zviditelnění H1 na homepage (posun 38 px). H1 zůstává v HTML.
- Rollback: `git revert <commit>` + push do main (Pages do ~10 min, max-age=600).

## Čeká na majitele (Shoptet admin – přes API nelze)
Viditelné H1 na homepage bez posunu = vložit do **synchronního** `promontaz-v6.css` (ne do ux.css):
```css
.in-index h1.sr-only{position:static!important;width:auto!important;height:auto!important;margin:14px 16px 4px!important;padding:0!important;overflow:visible!important;clip:auto!important;clip-path:none!important;white-space:normal!important;font-size:15px!important;line-height:1.35!important;font-weight:600!important;color:#4a4a4a!important;font-family:inherit!important;text-transform:none!important}
```
Obecně: pravidla, která mění výšku prvků nad obsahem, nepatří do ux.css (načítá se `media=print onload` = až po vykreslení).

## Pokračování
Měření: Playwright na produkci, `PerformanceObserver('layout-shift')`, šířky 1200/1280/1366/1440/1536/1600/1920 + Pixel 7.

## Ověřeno 19. 11. (produkce)
- CLS po nasazení (lab, Playwright): desktop 1280/1440 homepage 0,01–0,03, kategorie 0,06, kalkulačka 0,001, nacenění 0,017 (dřív 0,70–0,87). Bez JS chyb, bez horizontálního přetečení na mobilu.
- Vyhledávání 3.2.0 živě (desktop + mobil), Jarda stable bez chyb.
- Kalkulačky: všech 12 má doporučení → ověřený vklad do košíku → nacenění; 38/38 odkazovaných produktů existuje se shodným kódem.

## Ke schválení
- Kategorie **Univerzální silikony** (guid eafe7a3e-33f0-11f1-a856-bc2411162930) je skrytá → 67 produktů (např. sanitární silikon 30211RL) má detail 404, chybí ve výpisu i ve vyhledávání („silikon sanitární“ = 0 výsledků). Kalkulačka silikonu je vkládá do košíku jen podle kódu. Náprava: zviditelnit kategorii (1 přepínač, vratné), pak noční index silikony sám doplní.
- Rozdíl viditelné produkty (16 068) × index (15 883) ≈ 185 → pravděpodobně další skryté kategorie, prověřit.
- Mobilní/desktop košík: nativní posun `.cart-row` (CLS 0,11–0,27) – checkout, bez zásahu.

## Vizuály v6 (19. 11.)
**Nasazeno:** přehled `/kalkulacky/` – 12 náhledů z `kalkulacky-1200x800.zip` (ořez 16:9, WebP 480/800, `assets/kalkulacky/`), přes `ux.css` v16 (`content:url`). Bez podpory zůstane původní fotka.

**Trvalé řešení (Shoptet admin → Blog → článek → Obrázek):** nahrát `https://dotejdne-cmd.github.io/promontaz-search/assets/kalkulacky/clanek/<slug>-1200x675.jpg` ke každému článku kalkulačky. Pak se obrázek použije i jako og:image při sdílení a blok v16 v ux.css lze smazat.

**Homepage banner (čeká na schválení, šablona):** nad mřížku `#pmE` (sekce „Spočítejte si materiál“):
```html
<a href="/kalkulacky/" class="pm-kalk-banner" style="display:block;margin:0 0 16px"><picture>
<source media="(max-width:575px)" srcset="https://dotejdne-cmd.github.io/promontaz-search/assets/bannery/kalk-banner-mobil-780x600.webp" width="780" height="600">
<img src="https://dotejdne-cmd.github.io/promontaz-search/assets/bannery/kalk-banner-homepage-1312.webp" srcset="https://dotejdne-cmd.github.io/promontaz-search/assets/bannery/kalk-banner-homepage-2624.webp 2x" width="1312" height="360" loading="lazy" alt="12 kalkulaček zdarma – spočítejte materiál dřív, než objednáte" style="width:100%;height:auto;border-radius:10px"></picture></a>
```
**Vynecháno:** vizuály věrnostního programu („Parťák“ – název a slevové úrovně nejsou schválené), FB/IG formáty 1080×1080/1350 (sociální sítě, ne web).

## CTA kalkulaček v kategoriích (19. 11.)
Do krátkého popisu (`description`) 9 kategorií přidán blok `.pm-kalk-cta` (náhled v6 128×72 z Pages + „Spočítat zdarma ›“ + „Nacenit celý seznam ›“): konstrukční, univerzální, terasové vruty, vruty do SDK, univerzální hmoždinky, pistolové a trubičkové pěny, instalační kabely, povrchové úpravy. Původní text beze změny, `secondDescription` (SEO) nedotčen.
Záloha původních popisů: `backups/kategorie-popis-2026-11-19.json` (rollback = category_update s uloženým `description`).
Měření v GA4: page_referrer kategorie → page_view /kalkulacky/… a události kalkulaček `*_add_to_cart`.
