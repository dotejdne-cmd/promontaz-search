/* promontaz-search – kanál vydání (vkládá se před stabilní verzi do search-v3.js).
   Zákazníci bez parametru: beze změny běží stabilní verze (package.json → psearch.stable).
   ?psearch3=next   → v TOMTO prohlížeči zkušební verze search-v3-next.js (pamatuje si to, localStorage)
   ?psearch3=stable → zpět na stabilní (také ?psearch3=off) */
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  var p = null, on = false, K = 'psearch3_next';
  try { p = new URLSearchParams(location.search).get('psearch3'); } catch (e) {}
  try {
    if (p === 'next') localStorage.setItem(K, '1');
    if (p === 'stable' || p === 'off') localStorage.removeItem(K);
    on = localStorage.getItem(K) === '1';
  } catch (e) { on = p === 'next'; }
  var cur = document.currentScript;
  if (!on || window.__psearch3 || !cur || !cur.src) return;
  window.__psearch3 = 'next';            // stabilní verze za tímto blokem se pak nezapne
  var s = document.createElement('script');
  s.src = cur.src.replace(/search-v3\.js(\?.*)?$/, 'search-v3-next.js');
  (document.head || document.documentElement).appendChild(s);
})();
