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
