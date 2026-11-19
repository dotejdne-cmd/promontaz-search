# Carousel v6.9 – bez bliknutí velkého banneru
Kde: Shoptet admin → Vzhled a obsah → Editor → HTML kód → **Záhlaví**.
Co nahradit: celý blok od `<style id="pm-carousel-v6-8-style">` po jeho `</style>` **a** celý `<script id="pm-carousel-v6-8">…</script>` → obsahem souboru `carousel-v6-9-zahlavi.html` (oba bloky, stejná id). Rollback: vložit zpět `carousel-v6-8-zaloha.html`.

Změny proti v6.8 (vše ostatní beze změny – rozměry 4:5, šipky, swipe, lazy loading, první karta eager/high):
1. Karty se postaví hned, jak parser dočte nativní carousel (MutationObserver), ne až po DOMContentLoaded.
2. Do postavení je nativní carousel neviditelný a drží přesnou výšku řady karet (`html.pmc-js:not(.pmc-ready):not(.pmc-fail)`), takže nic neposkočí.
3. Fallback: chyba v build() nebo žádné karty do 3,3 s → třída `pmc-fail` → nativní carousel se ukáže jako dřív. Bez JS se nic neskrývá.
