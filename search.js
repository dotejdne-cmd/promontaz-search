/* ProMontaz – vlastní našeptávač nad produktovým feedem.
   Index se stáhne až po kliknutí do vyhledávání, rychlost webu neovlivní. */
(function () {
  'use strict';

  // ===== NASTAVENÍ =====
  var CONFIG = {
    mode: 'test',                          // 'test' = jen po otevření webu s ?psearch=test, 'all' = pro všechny
    inputSelector: 'input[name="string"]', // vyhledávací pole Shoptetu
    hideSelector: '.search-whisperer',     // původní našeptávač Shoptetu (skryje se, až náš naběhne)
    searchUrl: '/vyhledavani/?string=',    // záloha, když pole není ve formuláři
    maxResults: 8,
    minChars: 2,
    accent: '#f28c1e',
    thumb: function (url) { return url; }, // případná záměna na menší náhled obrázku
    // Slang a zkratky – jedno slovo bez diakritiky → alternativy
    synonyms: {
      dibl: ['hmozdinka'], dible: ['hmozdinka'],
      sdk: ['sadrokarton'], sadrokarton: ['sdk'],
      zavitovka: ['zavitova'], zavitovky: ['zavitova'],
      kvh: ['hranol'], hranol: ['kvh'], hranoly: ['kvh']
    }
  };
  if (typeof window !== 'undefined' && window.PSEARCH_CONFIG) {
    for (var k in window.PSEARCH_CONFIG) CONFIG[k] = window.PSEARCH_CONFIG[k];
  }

  // ===== JÁDRO VYHLEDÁVÁNÍ =====
  var STOP = { a: 1, i: 1, s: 1, v: 1, z: 1, k: 1, do: 1, na: 1, pro: 1, se: 1, ve: 1, ze: 1, od: 1, po: 1, x: 1, mm: 1, cm: 1, m: 1, ks: 1, bal: 1 };
  var ENDINGS = ['ami', 'ach', 'ech', 'ich', 'ych', 'ovi', 'ove', 'ova', 'ovy', 'emi', 'ou', 'em', 'ym', 'im', 'y', 'a', 'e', 'i', 'u', 'o'];
  var TOK = /[a-z0-9]+(?:[.\/][a-z0-9]+)*/g;

  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/(\d),(\d)/g, '$1.$2').replace(/[×*]/g, 'x')
      .replace(/(\d)\s*[x\/]\s*(?=\d)/g, '$1x'); // rozměry 120/100/4000, 120 x 100, 120×100 → 120x100x4000
  }
  function compact(s) { return norm(s).replace(/[^a-z0-9]/g, ''); }

  function tokens(s, expand) {
    var out = [], m = norm(s).match(TOK) || [];
    for (var i = 0; i < m.length; i++) {
      var t = m[i];
      out.push(t);
      if (expand && /\d/.test(t) && /[.x\/]/.test(t)) {
        var simp = t.replace(/\.0+(?=[x\/]|$)/g, '');
        if (simp !== t) out.push(simp);
        if (/\d[x\/]|[x\/]\d/.test(simp)) simp.split(/[x\/]/).forEach(function (p) { if (p) out.push(p); });
      }
    }
    return out;
  }

  function stem(t) {
    if (t.length < 5 || !/^[a-z]+$/.test(t)) return t;
    for (var i = 0; i < ENDINGS.length; i++) {
      var e = ENDINGS[i];
      if (t.length - e.length >= 4 && t.slice(-e.length) === e) return t.slice(0, -e.length);
    }
    return t;
  }

  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var prev = [], cur, i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i];
      var rowMin = i;
      for (j = 1; j <= b.length; j++) {
        var c = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        cur[j] = c;
        if (c < rowMin) rowMin = c;
      }
      if (rowMin > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }

  function createEngine(data, cfg) {
    cfg = cfg || CONFIG;
    var items = data.items, post = new Map(), codes = new Map(), names = [];
    function add(t, id, w) {
      var m = post.get(t);
      if (!m) { m = new Map(); post.set(t, m); }
      if ((m.get(id) || 0) < w) m.set(id, w);
    }
    items.forEach(function (it, id) {
      names[id] = norm(it[0]);
      tokens(it[0], true).forEach(function (t) { add(t, id, 3); });
      tokens(data.manus[it[4]], true).forEach(function (t) { add(t, id, 2); });
      tokens(data.cats[it[6]], true).forEach(function (t) { add(t, id, 1); });
      (it[5] || '').split(' ').forEach(function (c) {
        if (!c) return;
        var k = compact(c);
        if (k.length >= 3) { if (!codes.has(k)) codes.set(k, []); codes.get(k).push(id); }
        tokens(c, true).forEach(function (t) { add(t, id, 2); });
      });
    });
    var vocab = Array.from(post.keys()), stems = new Map();
    vocab.forEach(function (t) {
      var s = stem(t);
      if (!stems.has(s)) stems.set(s, []);
      stems.get(s).push(t);
    });

    function matchToken(q) {
      var res = new Map();
      function put(t, m) { if ((res.get(t) || 0) < m) res.set(t, m); }
      if (post.has(q)) put(q, 1);
      (stems.get(stem(q)) || []).forEach(function (t) { put(t, 0.9); });
      var isNum = /\d/.test(q);
      var maxD = isNum ? 0 : q.length >= 8 ? 2 : q.length >= 4 ? 1 : 0;
      for (var i = 0; i < vocab.length; i++) {
        var t = vocab[i];
        if (q.length >= 2 && t.length > q.length && t.lastIndexOf(q, 0) === 0) {
          put(t, 0.75 - Math.min(0.25, (t.length - q.length) * 0.02));
        } else if (maxD && t[0] === q[0] && lev(q, t, maxD) <= maxD) {
          put(t, maxD === 1 ? 0.6 : 0.5);
        }
      }
      return res;
    }

    // rozměr rozložený na čísla: produkt musí obsahovat všechna (v libovolném pořadí)
    function partsMatch(q) {
      if (!/\dx\d/.test(q)) return null;
      var parts = q.replace(/\.0+(?=x|$)/g, '').split('x').filter(Boolean);
      if (parts.length < 2 || !parts.every(function (p) { return /\d/.test(p); })) return null;
      var ids = null;
      parts.forEach(function (p) {
        var m = post.get(p), next = new Map();
        if (m) m.forEach(function (w, id) { if (!ids || ids.has(id)) next.set(id, ids ? Math.min(w, ids.get(id)) : w); });
        ids = next;
      });
      // stejné číslo vícekrát (120x120): produkt ho musí mít také vícekrát
      var need = {}, dup = false;
      parts.forEach(function (p) { need[p] = (need[p] || 0) + 1; if (need[p] > 1) dup = true; });
      if (dup) ids.forEach(function (w, id) {
        var have = {};
        (names[id].match(TOK) || []).forEach(function (t) {
          t.replace(/\.0+(?=x|$)/g, '').split('x').forEach(function (p) { if (p) have[p] = (have[p] || 0) + 1; });
        });
        for (var p in need) if ((have[p] || 0) < need[p]) { ids.delete(id); break; }
      });
      return { ids: ids, parts: parts };
    }

    function search(query, limit) {
      var qn = norm(query).trim();
      if (!qn) return { items: [], total: 0, terms: [] };
      var qts = tokens(qn, false).filter(function (t, i, a) { return a.indexOf(t) === i; });
      var req = qts.filter(function (t) { return !STOP[t]; });
      if (!req.length) req = qts;
      var dimParts = [];
      var per = req.map(function (q) {
        var sc = new Map(), alts = [q].concat(cfg.synonyms[q] || []);
        alts.forEach(function (a, ai) {
          matchToken(a).forEach(function (mult, vt) {
            post.get(vt).forEach(function (w, id) {
              var s = w * mult * (ai ? 0.9 : 1);
              if ((sc.get(id) || 0) < s) sc.set(id, s);
            });
          });
        });
        // rozměr v jiném pořadí (120x100 najde i 100/120/4000)
        var pm = partsMatch(q);
        if (pm) {
          dimParts = dimParts.concat(pm.parts);
          pm.ids.forEach(function (w, id) {
            var s = w * 0.7;
            if ((sc.get(id) || 0) < s) sc.set(id, s);
          });
        }
        return sc;
      });
      var isNum = function (t) { return /\d/.test(t); };
      var exact = codes.get(compact(query)) || [];
      // slovo, které v katalogu vůbec není: když zbydou jen čísla, raději nic (jinak "kvh 120" = kabely)
      var known = [], unknownWord = false;
      req.forEach(function (q, i) { if (per[i].size) known.push(i); else if (!isNum(q)) unknownWord = true; });
      var wordCount = known.filter(function (i) { return !isNum(req[i]); }).length;
      if (!known.length || (unknownWord && !wordCount)) { known = []; wordCount = 0; }
      req = known.map(function (i) { return req[i]; });
      per = known.map(function (i) { return per[i]; });
      if (!req.length && !exact.length) return { items: [], total: 0, terms: [] };
      var acc = new Map();
      per.forEach(function (sc, i) {
        var word = !isNum(req[i]);
        sc.forEach(function (s, id) {
          var a = acc.get(id) || { s: 0, n: 0, w: 0 };
          a.s += s; a.n++; if (word) a.w++;
          acc.set(id, a);
        });
      });
      var need = Math.max(req.length, 1), full = [];
      acc.forEach(function (a, id) { if (a.n === req.length) full.push(id); });
      var pool = req.length ? full : [];
      if (!pool.length && req.length > 1) {
        // volnější shoda: všechna slova musí sedět, chybět smí jen číslo/rozměr
        acc.forEach(function (a, id) { if (wordCount ? a.w === wordCount : a.n >= need - 1) pool.push(id); });
      }
      exact.forEach(function (id) { if (pool.indexOf(id) < 0) pool.push(id); if (!acc.has(id)) acc.set(id, { s: 0, n: need, w: 0 }); });
      var scored = pool.map(function (id) {
        var a = acc.get(id), it = items[id], s = a.s * (a.n / need);
        if (names[id].lastIndexOf(qn, 0) === 0) s += 2;
        else if (names[id].indexOf(qn) >= 0) s += 1.5;
        if (exact.indexOf(id) >= 0) s += 20;
        if (it[7]) s += 0.3;
        s += 0.3 / (1 + names[id].length / 40);
        return { id: id, s: s };
      }).sort(function (x, y) { return y.s - x.s; });
      return {
        total: scored.length,
        terms: req.concat(req.map(stem), dimParts),
        items: scored.slice(0, limit || cfg.maxResults).map(function (r) {
          var it = items[r.id], cat = data.cats[it[6]] || '';
          return {
            name: it[0],
            url: data.base + it[1],
            img: it[2] ? (/^https?:/.test(it[2]) ? it[2] : data.imgBase + it[2]) : '',
            price: it[3],
            from: !!it[8],
            manufacturer: data.manus[it[4]] || '',
            code: (it[5] || '').split(' ')[0],
            category: cat.split('|').pop().trim(),
            stock: !!it[7]
          };
        })
      };
    }
    return { search: search, size: items.length };
  }

  if (typeof window === 'undefined') {
    module.exports = { createEngine: createEngine, norm: norm, tokens: tokens, stem: stem };
    return;
  }

  // ===== ZAPNUTÍ (testovací režim) =====
  var flag = false, p = new URLSearchParams(location.search).get('psearch');
  try {
    if (p === 'test') localStorage.setItem('psearch', '1');
    if (p === 'off') localStorage.removeItem('psearch');
    flag = localStorage.getItem('psearch') === '1';
  } catch (e) { flag = p === 'test'; }
  if (CONFIG.mode !== 'all' && !flag) return;

  var script = document.currentScript;
  var INDEX_URL = CONFIG.indexUrl || (script && script.src ? script.src.replace(/search\.js(\?.*)?$/, 'index.json') : 'index.json');

  // ===== VZHLED =====
  var css = '' +
    'html.psearch-on ' + CONFIG.hideSelector + '{display:none!important}' +
    '#psearch{position:fixed;z-index:99999;background:#fff;color:#23272b;border:1px solid #d9dce0;border-radius:6px;' +
    'box-shadow:0 10px 28px rgba(35,39,43,.18);overflow-y:auto;font:inherit;font-size:14px;line-height:1.35;display:none}' +
    '#psearch a{color:inherit;text-decoration:none}' +
    '#psearch .ps-item{display:grid;grid-template-columns:48px 1fr auto;gap:12px;align-items:center;padding:8px 12px;border-left:3px solid transparent}' +
    '#psearch .ps-item.on,#psearch .ps-item:hover{background:#fff6ec;border-left-color:' + CONFIG.accent + '}' +
    '#psearch .ps-img{width:48px;height:48px;object-fit:contain;background:#f4f5f6;border-radius:4px}' +
    '#psearch .ps-name{font-weight:500;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}' +
    '#psearch .ps-name b{font-weight:700;box-shadow:inset 0 -2px 0 ' + CONFIG.accent + '}' +
    '#psearch .ps-meta{color:#6b7177;font-size:12px;margin-top:2px}' +
    '#psearch .ps-meta span+span:before{content:", "}' +
    '#psearch .ps-price{font-weight:700;white-space:nowrap;text-align:right}' +
    '#psearch .ps-stock{display:block;color:#2e7d32;font-weight:500;font-size:12px}' +
    '#psearch .ps-all{display:block;width:100%;padding:11px 12px;border:0;border-top:1px solid #eceef0;background:#f7f8f9;' +
    'font:inherit;font-weight:600;color:#23272b;text-align:left;cursor:pointer}' +
    '#psearch .ps-all.on,#psearch .ps-all:hover{background:' + CONFIG.accent + ';color:#fff}' +
    '#psearch .ps-msg{padding:14px 12px;color:#6b7177}' +
    '@media (max-width:600px){#psearch .ps-item{grid-template-columns:40px 1fr auto;gap:10px}#psearch .ps-img{width:40px;height:40px}}';
  var st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  var panel = document.createElement('div');
  panel.id = 'psearch';
  panel.setAttribute('role', 'listbox');

  // ===== NAČTENÍ INDEXU =====
  var enginePromise = null, engine = null;
  function load() {
    if (!enginePromise) {
      enginePromise = fetch(INDEX_URL).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }).then(function (d) {
        engine = createEngine(d, CONFIG);
        document.documentElement.classList.add('psearch-on');
        return engine;
      }).catch(function (e) {
        enginePromise = null; // při chybě zůstane původní vyhledávání Shoptetu
        if (window.console) console.warn('psearch: index se nenačetl', e);
        throw e;
      });
    }
    return enginePromise;
  }

  // ===== MĚŘENÍ (GA4) =====
  function track(name, params) {
    try {
      if (typeof window.gtag === 'function') window.gtag('event', name, params);
      else (window.dataLayer = window.dataLayer || []).push(Object.assign({ event: name }, params));
    } catch (e) {}
  }

  // ===== UI =====
  var activeInput = null, results = [], cursor = -1, lastQuery = '', idleTimer = null, lastTracked = '', lastTotal = 0;
  var fmt = function (n) {
    if (n == null) return '';
    return new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }).format(n) + '\u00a0Kč';
  };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function highlight(name, terms) {
    return name.split(/(\s+)/).map(function (w) {
      var n = norm(w).replace(/[^a-z0-9.x\/]/g, '').replace(/\.0+(?=[x\/]|$)/g, '');
      var hit = n && terms.some(function (t) { return t.length >= 2 && (n.lastIndexOf(t, 0) === 0 || stem(n) === t); });
      return hit ? '<b>' + esc(w) + '</b>' : esc(w);
    }).join('');
  }

  function place() {
    if (!activeInput) return;
    var r = activeInput.getBoundingClientRect(), vw = window.innerWidth;
    var w = Math.min(Math.max(r.width, 380), vw - 16);
    var left = Math.min(Math.max(8, r.left), vw - w - 8);
    var top = r.bottom + 6;
    panel.style.width = w + 'px';
    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
    panel.style.maxHeight = Math.max(200, window.innerHeight - top - 12) + 'px';
  }
  function open() { if (!panel.parentNode) document.body.appendChild(panel); panel.style.display = 'block'; place(); }
  function close() { panel.style.display = 'none'; cursor = -1; }

  function render(q, res) {
    results = res.items; cursor = -1; lastTotal = res.total;
    if (!res.items.length) {
      panel.innerHTML = '<div class="ps-msg">Pro „' + esc(q) + '“ jsme nic nenašli. Zkuste kratší výraz nebo kód produktu.</div>';
      return open();
    }
    var html = res.items.map(function (it, i) {
      var meta = [];
      if (it.manufacturer) meta.push('<span>' + esc(it.manufacturer) + '</span>');
      if (it.code) meta.push('<span>kód ' + esc(it.code) + '</span>');
      return '<a class="ps-item" role="option" data-i="' + i + '" href="' + esc(it.url) + '">' +
        (it.img ? '<img class="ps-img" loading="lazy" alt="" onerror="this.style.visibility=\'hidden\'" src="' + esc(CONFIG.thumb(it.img)) + '">' : '<span class="ps-img"></span>') +
        '<span><span class="ps-name">' + highlight(it.name, res.terms) + '</span><span class="ps-meta">' + meta.join('') + '</span></span>' +
        '<span class="ps-price">' + (it.price != null ? (it.from ? 'od ' : '') + fmt(it.price) : '') +
        (it.stock ? '<span class="ps-stock">Skladem</span>' : '') + '</span></a>';
    }).join('');
    html += '<button type="button" class="ps-all" data-i="all">Zobrazit všechny výsledky (' + res.total + ')</button>';
    panel.innerHTML = html;
    open();
  }

  function setCursor(i) {
    var nodes = panel.querySelectorAll('.ps-item,.ps-all');
    if (!nodes.length) return;
    cursor = (i + nodes.length) % nodes.length;
    nodes.forEach(function (n, j) { n.classList.toggle('on', j === cursor); });
    nodes[cursor].scrollIntoView({ block: 'nearest' });
  }

  function submitAll() {
    var q = activeInput.value.trim();
    var form = activeInput.form;
    if (form) form.submit();
    else location.href = CONFIG.searchUrl + encodeURIComponent(q);
  }

  function go(i) {
    var it = results[i];
    if (!it) return;
    track('naseptavac_klik', { search_term: activeInput.value.trim(), pozice: i + 1, produkt: it.name });
    location.href = it.url;
  }

  function scheduleTrack(q) {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      if (q.length < 3 || q === lastTracked) return;
      lastTracked = q;
      track('naseptavac_hledani', { search_term: q, pocet_vysledku: lastTotal });
      if (!lastTotal) track('naseptavac_nic', { search_term: q });
    }, 1500);
  }

  function run(input) {
    activeInput = input;
    var q = input.value.trim();
    lastQuery = q;
    if (q.length < CONFIG.minChars) return close();
    if (!engine) {
      panel.innerHTML = '<div class="ps-msg">Načítám produkty…</div>';
      open();
    }
    load().then(function (e) {
      if (q !== lastQuery) return;
      render(q, e.search(q));
      scheduleTrack(q);
    }, function () { close(); });
  }

  function attach(input) {
    if (input.__psearch) return;
    input.__psearch = true;
    input.setAttribute('autocomplete', 'off');
    var t = null;
    input.addEventListener('focus', function () { activeInput = input; load().catch(function () {}); if (input.value.trim().length >= CONFIG.minChars) run(input); });
    input.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { run(input); }, 60); });
    input.addEventListener('keydown', function (e) {
      if (panel.style.display !== 'block') return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(cursor + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(cursor - 1); }
      else if (e.key === 'Escape') { close(); }
      else if (e.key === 'Enter' && cursor >= 0) {
        e.preventDefault();
        if (cursor < results.length) go(cursor); else submitAll();
      }
    });
  }

  panel.addEventListener('mousedown', function (e) { e.preventDefault(); });
  panel.addEventListener('click', function (e) {
    var el = e.target.closest('[data-i]');
    if (!el) return;
    e.preventDefault();
    if (el.getAttribute('data-i') === 'all') submitAll(); else go(Number(el.getAttribute('data-i')));
  });
  document.addEventListener('mousedown', function (e) {
    if (!panel.contains(e.target) && e.target !== activeInput) close();
  });
  window.addEventListener('resize', place);
  window.addEventListener('scroll', place, { passive: true });

  function scan() { document.querySelectorAll(CONFIG.inputSelector).forEach(attach); }
  function start() {
    scan();
    var pending = false;
    new MutationObserver(function () {
      if (pending) return;
      pending = true;
      setTimeout(function () { pending = false; scan(); }, 300);
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
