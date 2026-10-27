/* ProMontaz – vlastní našeptávač nad produktovým feedem. Verze 3.
   Oproti v2: normalizace jednotek (mm, mm², ks…), spojená slova (turbošroub → turbo šroub),
   synonyma i pro tvary slov, bezpečnější překlepy (chránička ≠ chránič), žádné domýšlení
   (čísla se nedoplňují, rozměry se nepřehazují, neznámé slovo se nezahazuje – širší hledání
   je jen volba zákazníka), přednost přesných kódů (EAN, kód, 221-413) a vlastní výsledky
   i na stránce /vyhledavani/.
   Index se stáhne až po kliknutí do vyhledávání (na stránce výsledků hned), rychlost webu neovlivní. */
(function () {
  'use strict';

  var script = typeof document !== 'undefined' ? document.currentScript : null;

  // ===== NASTAVENÍ =====
  var CONFIG = {
    // 'test' = jen po otevření webu s ?psearch3=test, 'all' = pro všechny.
    // Lze přepsat atributem ve vkládacím řádku: <script src="…/search-v3.js" data-mode="test" defer>
    mode: 'all',
    testParam: 'psearch3',
    inputSelector: 'input[name="string"]', // vyhledávací pole Shoptetu
    hideSelector: '.search-whisperer, .sai-SearchWidget__dropdown, #psearch', // původní našeptávač Shoptetu, Saimon a panel v2
    searchUrl: '/vyhledavani/?string=',    // záloha, když pole není ve formuláři
    maxResults: 8,
    minChars: 2,
    accent: '#f28c1e',
    expandLimit: 60,                       // kolik výsledků ukázat po „Zobrazit všechny“
    // Stránka /vyhledavani/: 'prepend' = naše výsledky nad výpisem Shoptetu, 'replace' = výpis Shoptetu skrýt, 'off' = nic
    resultsPage: 'prepend',
    pageLimit: 24,
    // malý náhled 100×100 místo originálu (Shoptet CDN); když neexistuje, použije se původní obrázek
    thumb: function (url) { return url.replace(/\/user\/shop\/(orig|big|detail)\//, '/user/shop/related/'); },
    // Synonyma: slovo bez diakritiky (nebo jeho kmen) → alternativy. Jen technicky rovnocenné výrazy –
    // nikdy nepárovat odlišné výrobky (chránička ≠ chránič, sanitární silikon ≠ střešní silikon).
    synonyms: {
      dibl: ['hmozdinka'], dible: ['hmozdinka'],
      sdk: ['sadrokarton'], sadrokarton: ['sdk'],
      zavitovka: ['zavitova'], zavitovky: ['zavitova'],
      kvh: ['hranol'], hranol: ['kvh'], hranoly: ['kvh'],
      prodluzovacka: ['prodluzovaci', 'prodluz'], prodluzovacky: ['prodluzovaci', 'prodluz'], prodluzka: ['prodluzovaci', 'prodluz'],
      buben: ['bubnu', 'bubny'], bubny: ['buben', 'bubnu'],
      '1nasobny': ['jednonasobny'], '2nasobny': ['dvojnasobny'], '3nasobny': ['trojnasobny'],
      '4nasobny': ['ctyrnasobny'], '5nasobny': ['petinasobny'],
      '1nasobna': ['jednonasobna'], '2nasobna': ['dvojnasobna'], '3nasobna': ['trojnasobna'],
      dvojzasuvka: ['dvojnasobna'],
      // galvanicky pozinkováno: ZB = zinek bílý, ZZ = zinek žlutý (v exportu „zinek bily/zluty/zarovy“)
      pozinkovan: ['zinek', 'zb', 'zz'], pozink: ['zinek', 'zb', 'zz'], zinkovan: ['zinek'],
      // Ytong je obchodní název pórobetonu (plynobetonu)
      ytong: ['porobeton', 'plynobeton'], porobeton: ['ytong', 'plynobeton'], plynobeton: ['porobeton', 'ytong']
    }
  };
  if (typeof window !== 'undefined' && window.PSEARCH_CONFIG) {
    for (var k in window.PSEARCH_CONFIG) CONFIG[k] = window.PSEARCH_CONFIG[k];
  }
  if (script && script.getAttribute('data-mode')) CONFIG.mode = script.getAttribute('data-mode');

  // ===== JÁDRO VYHLEDÁVÁNÍ =====
  var STOP = {
    a: 1, i: 1, s: 1, v: 1, z: 1, k: 1, do: 1, na: 1, pro: 1, se: 1, ve: 1, ze: 1, od: 1, po: 1, x: 1,
    mm: 1, mm2: 1, cm: 1, m: 1, ml: 1, kg: 1, ks: 1, bal: 1,
    cena: 1, levne: 1, levny: 1, levna: 1, nejlevnejsi: 1, koupit: 1, prodej: 1, eshop: 1
  };
  var ENDINGS = ['ami', 'ach', 'ech', 'ich', 'ych', 'ovi', 'ove', 'ova', 'ovy', 'emi', 'ou', 'em', 'ym', 'im', 'y', 'a', 'e', 'i', 'u', 'o'];
  var TOK = /[a-z0-9]+(?:[.\/][a-z0-9]+)*/g;
  var UNIT = /(\d)\s?(?:mm2|mm|cm|ml|kg|ks)(?=\s*[x\/]\s*\d|[^a-z0-9]|$)/g;

  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/²/g, '2')                         // mm² → mm2
      .replace(/(\d),(\d)/g, '$1.$2').replace(/[×*]/g, 'x')
      .replace(/(\d)\.(\d*?)0+(?!\d)/g, function (m, a, b) { return b ? a + '.' + b : a; }) // 1,50 → 1.5, 1,0 → 1
      .replace(UNIT, '$1')                              // 2,5mm2 / 35 mm / 10ks → jen číslo
      .replace(/(\d)\s*[x\/]\s*(?=\d)/g, '$1x');        // 120/100/4000, 120 x 100, 120×100 → 120x100x4000
  }
  function compact(s) { return norm(s).replace(/[^a-z0-9]/g, ''); }
  var isNum = function (t) { return /\d/.test(t); };

  function tokens(s, expand) {
    var n = norm(s), out = [], m = n.match(TOK) || [];
    for (var i = 0; i < m.length; i++) {
      var t = m[i];
      out.push(t);
      // rozměr s písmennou předponou (M14x2000, IP66/67/69, AKU16/5): přidat i čistě číselný tvar
      var pre = expand && t.match(/^[a-z]{1,3}(\d+(?:\.\d+)?x\d[\d.x]*)$/);
      if (pre) { m.push(pre[1]); }
      if (expand && isNum(t) && /[.x\/]/.test(t)) {
        var simp = t.replace(/\.0+(?=[x\/]|$)/g, '');
        if (simp !== t) out.push(simp);
        if (/\d[x\/]|[x\/]\d/.test(simp)) {
          var parts = simp.split(/[x\/]/);
          parts.forEach(function (p) { if (p) out.push(p); });
          // dílčí rozměr ve správném pořadí: 2500x1250x18 → 2500x1250, 1250x18 (nikdy přeházeně)
          if (parts.length >= 3 && parts.every(function (p) { return /^\d+(\.\d+)?$/.test(p); })) {
            for (var len = 2; len < parts.length; len++)
              for (var st = 0; st + len <= parts.length; st++) out.push(parts.slice(st, st + len).join('x'));
          }
        }
      }
    }
    // kódy se spojovníkem (221-413, CYKY-J): i spojený tvar, aby šel najít „221413“ / „cykyj“
    if (expand) (n.match(/[a-z0-9]+(?:-[a-z0-9]+)+/g) || []).forEach(function (c) {
      if (isNum(c) || c.length <= 8) out.push(c.replace(/-/g, ''));
    });
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
    var syn = cfg.synonyms || {};
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
      if (it[9]) tokens(it[9], true).forEach(function (t) { add(t, id, 1); }); // řada, typ, barva… z exportu
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

    // exact = jen přesný tvar a kmen (pro synonyma – „zb“ nesmí chytat „zbytek“)
    function matchToken(q, exact) {
      var res = new Map();
      function put(t, m) { if ((res.get(t) || 0) < m) res.set(t, m); }
      if (post.has(q)) put(q, 1);
      (stems.get(stem(q)) || []).forEach(function (t) { put(t, 0.9); });
      if (exact) return res;
      var num = isNum(q);
      // překlep: 1 znak od 5 písmen, 2 znaky až od 10 písmen; nikdy jen useknutý konec (chránička ≠ chránič)
      var maxD = num ? 0 : q.length >= 10 ? 2 : q.length >= 5 ? 1 : 0;
      // číslo na konci dotazu se nikdy nedoplňuje: m8 ≠ m80, 18 ≠ 180, 2x1 ≠ 2x1.5.
      // Pokračovat smí jen rozměr dalším rozměrovým polem (120x120 → 120x120x5000).
      var endsNum = /\d$/.test(q);
      for (var i = 0; i < vocab.length; i++) {
        var t = vocab[i];
        if (q.length >= 2 && t.length > q.length && t.lastIndexOf(q, 0) === 0) {
          if (endsNum && /[\d.,]/.test(t[q.length])) continue;
          put(t, 0.75 - Math.min(0.25, (t.length - q.length) * 0.02));
        } else if (maxD && t[0] === q[0] && t.length >= 4 && q.lastIndexOf(t, 0) !== 0 && lev(q, t, maxD) <= maxD) {
          put(t, maxD === 1 ? 0.6 : 0.5);
        }
      }
      return res;
    }
    function bestMult(m) { var b = 0; m.forEach(function (v) { if (v > b) b = v; }); return b; }
    function known(w) { return post.has(w) || stems.has(stem(w)); }

    // spojené slovo: turbosroub → turbo + sroub (obě části musí v katalogu existovat)
    function splitCompound(q) {
      if (q.length < 7 || isNum(q)) return null;
      for (var i = 3; i <= q.length - 3; i++) {
        var a = q.slice(0, i), b = q.slice(i);
        if (!STOP[a] && !STOP[b] && known(a) && known(b)) return [a, b];
      }
      return null;
    }

    // přesné kódy: celý dotaz nebo jeho část (EAN, kód produktu, objednací kód)
    function exactCodes(qn) {
      var found = [], seen = {};
      function take(s) {
        var k = compact(s);
        if (k.length < 4 || !isNum(k) || seen[k]) return;
        seen[k] = 1;
        (codes.get(k) || []).forEach(function (id) { if (found.indexOf(id) < 0) found.push(id); });
      }
      take(qn);
      var chunks = qn.split(/\s+/).filter(Boolean);
      chunks.forEach(take);
      for (var i = 0; i + 1 < chunks.length; i++) take(chunks[i] + chunks[i + 1]);
      return found;
    }

    function result(scored, limit, terms, extra) {
      var r = {
        total: scored.length,
        terms: terms,
        missing: [], rest: '', restTotal: 0,
        items: scored.slice(0, limit || cfg.maxResults).map(function (x) {
          var it = items[x.id], cat = data.cats[it[6]] || '';
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
      for (var k in extra) r[k] = extra[k];
      return r;
    }

    function search(query, limit, noRest) {
      var qn = norm(query).trim();
      if (!qn) return result([], limit, []);
      var qts = tokens(qn, false).filter(function (t, i, a) { return a.indexOf(t) === i; });
      var req = qts.filter(function (t) { return !STOP[t]; });
      if (!req.length) req = qts;
      var exact = exactCodes(qn);
      // původní tvar slov pro hlášky („sanitární“, ne „sanitarni“)
      var origOf = {};
      String(query).trim().split(/\s+/).forEach(function (w) {
        tokens(w, false).forEach(function (t) { if (!origOf[t]) origOf[t] = w.replace(/^[„“"'(,.;:]+|[„“"'),.;:]+$/g, ''); });
      });
      var label = function (list) {
        return list.map(function (t) { return origOf[t] || t; }).filter(function (w, i, a) { return a.indexOf(w) === i; });
      };

      var synTerms = [];
      function score(q) {
        var sc = new Map(), alts = [q].concat(syn[q] || syn[stem(q)] || []), best = 0;
        alts.forEach(function (a, ai) {
          var mt = matchToken(a, ai > 0);
          if (ai && mt.size) synTerms.push(a);
          if (!ai) best = bestMult(mt);
          mt.forEach(function (mult, vt) {
            post.get(vt).forEach(function (w, id) {
              var s = w * mult * (ai ? 0.9 : 1);
              if ((sc.get(id) || 0) < s) sc.set(id, s);
            });
          });
        });
        return { sc: sc, best: Math.max(best, sc.size && alts.length > 1 ? 0.9 : 0) };
      }

      // spojená slova rozdělit, když samy nic přesného nenajdou
      var words = [], per = [];
      req.forEach(function (q) {
        var r = score(q), parts = r.best < 0.75 ? splitCompound(q) : null;
        if (parts) parts.forEach(function (p) { words.push(p); per.push(score(p).sc); if (!origOf[p]) origOf[p] = origOf[q] || q; });
        else { words.push(q); per.push(r.sc); }
      });

      // Nic se nedomýšlí: když některé slovo nebo číslo nic nenajde, nebo žádný produkt nesplní všechna,
      // výsledek je prázdný. Širší hledání (jen slova, která něco najdou) se nabídne jako volba zákazníka.
      function none(missing, keepIdx) {
        var kwIdx = keepIdx.filter(function (i) { return !isNum(words[i]); });
        var rest = label(keepIdx.map(function (i) { return words[i]; })).join(' '), restTotal = 0;
        if (rest && kwIdx.length && !noRest) restTotal = search(rest, 1, true).total;
        return result([], limit, [], { missing: label(missing), rest: restTotal ? rest : '', restTotal: restTotal });
      }
      var missing = [], keep = [];
      words.forEach(function (q, i) { if (per[i].size) keep.push(i); else missing.push(q); });
      if (!exact.length && missing.length) return none(missing, keep);

      var acc = new Map();
      per.forEach(function (sc) {
        sc.forEach(function (s, id) {
          var a = acc.get(id) || { s: 0, n: 0 };
          a.s += s; a.n++;
          acc.set(id, a);
        });
      });
      var need = Math.max(words.length, 1), pool = [];
      acc.forEach(function (a, id) { if (a.n === need) pool.push(id); });
      if (!pool.length && !exact.length) {
        // každé slovo něco najde, ale ne společně: nabídnout dotaz bez čísel/rozměrů (pokud nějaké jsou)
        var nums = [], wordIdx = [];
        words.forEach(function (w, i) { if (isNum(w)) nums.push(w); else wordIdx.push(i); });
        return nums.length && wordIdx.length ? none(nums, wordIdx) : result([], limit, []);
      }
      // přesný kód (EAN, kód, objednací kód) má vždy přednost
      exact.forEach(function (id) { if (pool.indexOf(id) < 0) pool.push(id); if (!acc.has(id)) acc.set(id, { s: 0, n: need }); });
      var joined = (qn.match(/[a-z0-9]+(?:-[a-z0-9]+)+/g) || []).map(function (c) { return c.replace(/-/g, ''); });
      var scored = pool.map(function (id) {
        var a = acc.get(id), it = items[id], s = a.s * (a.n / need);
        if (names[id].lastIndexOf(qn, 0) === 0) s += 2;
        else if (names[id].indexOf(qn) >= 0) s += 1.5;
        if (exact.indexOf(id) >= 0) s += 100;
        joined.forEach(function (j) { var m = post.get(j); if (m && m.has(id)) s += 1; }); // GEOS-L, CYKY-J, 221-413
        if (it[7]) s += 0.3;
        s += 0.3 / (1 + names[id].length / 40);
        return { id: id, s: s };
      }).sort(function (x, y) { return y.s - x.s; });
      return result(scored, limit, words.concat(words.map(stem), synTerms));
    }
    return { search: search, size: items.length };
  }

  if (typeof window === 'undefined') {
    module.exports = { createEngine: createEngine, norm: norm, tokens: tokens, stem: stem, CONFIG: CONFIG };
    return;
  }

  // ===== ZAPNUTÍ (testovací režim) =====
  var flag = false, p = new URLSearchParams(location.search).get(CONFIG.testParam);
  try {
    if (p === 'test') localStorage.setItem(CONFIG.testParam, '1');
    if (p === 'off') localStorage.removeItem(CONFIG.testParam);
    flag = localStorage.getItem(CONFIG.testParam) === '1';
  } catch (e) { flag = p === 'test'; }
  if (CONFIG.mode !== 'all' && !flag) return;
  if (window.__psearch3) return; // vloženo dvakrát
  window.__psearch3 = true;

  var INDEX_URL = CONFIG.indexUrl || (script && script.src ? script.src.replace(/search(-v\d+)?\.js(\?.*)?$/, 'index.json') : 'index.json');

  // ===== VZHLED =====
  var A = CONFIG.accent;
  var css = '' +
    'html.psearch-on ' + CONFIG.hideSelector.split(',').join(',html.psearch-on ') + '{display:none!important}' +
    '#psearch3{position:fixed;z-index:99999;background:#fff;color:#23272b;border:1px solid #d9dce0;border-radius:6px;' +
    'box-shadow:0 10px 28px rgba(35,39,43,.18);overflow-y:auto;font:inherit;font-size:14px;line-height:1.35;display:none}' +
    '#psearch3 a{color:inherit;text-decoration:none}' +
    '#psearch3 .ps-item{display:grid;grid-template-columns:48px 1fr auto;gap:12px;align-items:center;padding:8px 12px;border-left:3px solid transparent}' +
    '#psearch3 .ps-item.on,#psearch3 .ps-item:hover{background:#fff6ec;border-left-color:' + A + '}' +
    '#psearch3 .ps-img,#psearch-page .ps-img{width:48px;height:48px;object-fit:contain;background:#f4f5f6;border-radius:4px}' +
    '#psearch3 .ps-name{font-weight:500;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}' +
    '#psearch3 .ps-name b{font-weight:700;box-shadow:inset 0 -2px 0 ' + A + '}' +
    '#psearch3 .ps-meta{color:#6b7177;font-size:12px;margin-top:2px}' +
    '#psearch3 .ps-meta span+span:before{content:", "}' +
    '#psearch3 .ps-price{font-weight:700;white-space:nowrap;text-align:right}' +
    '#psearch3 .ps-stock,#psearch-page .ps-stock{display:block;color:#2e7d32;font-weight:500;font-size:12px}' +
    '#psearch3 .ps-all{display:block;width:100%;padding:11px 12px;border:0;border-top:1px solid #eceef0;background:#f7f8f9;' +
    'font:inherit;font-weight:600;color:#23272b;text-align:left;cursor:pointer}' +
    '#psearch3 .ps-all.on,#psearch3 .ps-all:hover{background:' + A + ';color:#fff}' +
    '#psearch3 .ps-msg{padding:14px 12px;color:#6b7177}' +
    '#psearch3 .ps-note,#psearch-page .ps-note{padding:8px 12px;background:#fff6ec;color:#5b4a33;font-size:13px;border-bottom:1px solid #f3dcc0}' +
    '#psearch-page{margin:0 0 28px}' +
    '#psearch-page h4{margin:0 0 12px}' +
    '#psearch-page .ps-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}' +
    '#psearch-page .ps-card{display:grid;grid-template-columns:48px 1fr;gap:10px;align-items:start;padding:10px;border:1px solid #e3e6e9;border-radius:6px;color:#23272b;text-decoration:none;background:#fff}' +
    '#psearch-page .ps-card:hover{border-color:' + A + '}' +
    '#psearch-page .ps-card .ps-name{font-weight:500;font-size:14px;line-height:1.3}' +
    '#psearch-page .ps-card .ps-price{font-weight:700;margin-top:4px}' +
    '#psearch-page .ps-more{margin-top:12px;padding:10px 16px;border:1px solid ' + A + ';background:#fff;color:#23272b;font:inherit;font-weight:600;border-radius:4px;cursor:pointer}' +
    '#psearch-page .ps-note{margin-bottom:12px;border-radius:4px;border:1px solid #f3dcc0}' +
    '#psearch-page .ps-note a{color:inherit;font-weight:600;text-decoration:underline}' +
    '#psearch-page a.ps-card,#psearch-page a.ps-card *{text-decoration:none!important}' +
    '#psearch-page .ps-card .ps-name,#psearch-page .ps-card .ps-price{display:block}' +
    '@media (max-width:600px){#psearch3 .ps-item{grid-template-columns:40px 1fr auto;gap:10px}#psearch3 .ps-img{width:40px;height:40px}' +
    '#psearch-page .ps-grid{grid-template-columns:1fr}}';
  var st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  var panel = document.createElement('div');
  panel.id = 'psearch3';
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
  var activeInput = null, results = [], cursor = -1, lastQuery = '', idleTimer = null, lastTracked = '', lastTotal = 0, lastMissing = '';
  var fmt = function (n) {
    if (n == null) return '';
    return new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }).format(n) + ' Kč';
  };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function highlight(name, terms) {
    return name.split(/(\s+)/).map(function (w) {
      var n = norm(w).replace(/[^a-z0-9.x\/]/g, '').replace(/\.0+(?=[x\/]|$)/g, '');
      var hit = n && terms.some(function (t) { return t.length >= 2 && (n.lastIndexOf(t, 0) === 0 || stem(n) === t); });
      return hit ? '<b>' + esc(w) + '</b>' : esc(w);
    }).join('');
  }
  function priceHtml(it) { return it.price != null ? (it.from ? 'od ' : '') + fmt(it.price) : ''; }

  function place() {
    if (!activeInput) return;
    var r = activeInput.getBoundingClientRect(), vw = document.documentElement.clientWidth || window.innerWidth;
    var w = Math.min(Math.max(r.width, 380), vw - 16);
    var left = Math.min(Math.max(8, r.left), vw - w - 8);
    var top = r.bottom + 6;
    panel.style.width = w + 'px';
    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
    panel.style.maxHeight = Math.max(200, window.innerHeight - top - 12) + 'px';
  }
  function open() { if (!panel.parentNode) document.body.appendChild(panel); panel.style.display = 'block'; place(); }
  function close() { panel.style.display = 'none'; cursor = -1; expanded = false; }

  var expanded = false, restQuery = '';
  function render(q, res, isExpanded, note) {
    results = res.items; cursor = -1; lastTotal = res.total; expanded = !!isExpanded;
    lastMissing = (res.missing || []).join(' ');
    var shopBtn = '<button type="button" class="ps-all ps-shop" data-i="shop">Hledat „' + esc(activeInput ? activeInput.value.trim() : q) + '“ v celém e-shopu</button>';
    if (!res.items.length) {
      restQuery = res.rest || '';
      var msg = 'Pro tento dotaz jsme nenašli odpovídající produkty.' + (restQuery ? '' : ' Zkuste kratší výraz nebo kód produktu.');
      panel.innerHTML = '<div class="ps-msg">' + msg + '</div>' +
        (restQuery ? '<button type="button" class="ps-all" data-i="rest">Zobrazit výsledky jen pro „' + esc(restQuery) + '“ (' + res.restTotal + ')</button>' : '') +
        shopBtn;
      return open();
    }
    var top = note ? '<div class="ps-note">' + note + '</div>' : '';
    var html = top + res.items.map(function (it, i) {
      var meta = [];
      if (it.manufacturer) meta.push('<span>' + esc(it.manufacturer) + '</span>');
      if (it.code) meta.push('<span>kód ' + esc(it.code) + '</span>');
      return '<a class="ps-item" role="option" data-i="' + i + '" href="' + esc(it.url) + '">' +
        (it.img ? '<img class="ps-img" loading="lazy" alt="" data-o="' + esc(it.img) + '" src="' + esc(CONFIG.thumb(it.img)) + '">' : '<span class="ps-img"></span>') +
        '<span><span class="ps-name">' + highlight(it.name, res.terms) + '</span><span class="ps-meta">' + meta.join('') + '</span></span>' +
        '<span class="ps-price">' + priceHtml(it) + (it.stock ? '<span class="ps-stock">Skladem</span>' : '') + '</span></a>';
    }).join('');
    if (!expanded && res.total > res.items.length) {
      html += '<button type="button" class="ps-all" data-i="all">Zobrazit všechny výsledky (' + res.total + ')</button>';
    } else {
      if (res.total > res.items.length) html += '<div class="ps-msg">Zobrazeno ' + res.items.length + ' z ' + res.total + '. Upřesněte hledání.</div>';
      html += shopBtn;
    }
    panel.innerHTML = html;
    open();
    if (expanded) panel.scrollTop = 0;
  }

  function expand() {
    if (!engine || !lastQuery) return;
    render(lastQuery, engine.search(lastQuery, CONFIG.expandLimit), true);
    track('naseptavac_vse', { search_term: lastQuery, pocet_vysledku: lastTotal });
  }

  function showRest() {
    if (!engine || !restQuery) return;
    var missing = lastMissing, rq = restQuery;
    lastQuery = rq;
    render(rq, engine.search(rq, CONFIG.expandLimit), true, 'Na vaše přání zobrazujeme výsledky jen pro „' + esc(rq) + '“ (bez „' + esc(missing) + '“):');
    track('naseptavac_zbytek', { search_term: activeInput ? activeInput.value.trim() : rq, zbytek: rq, chybi: missing });
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
      if (!lastTotal) track('naseptavac_nic', { search_term: q, chybi: lastMissing });
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
    if (input.__psearch3) return;
    input.__psearch3 = true;
    // Obsadit pole i pro v2 (v2 přeskakuje pole a formuláře s __psearch). Když je v testu řádek v3
    // vložen PŘED řádkem v2, v2 se nepřipojí: jeden našeptávač, jedna obsluha kláves, jedno měření.
    input.__psearch = true;
    if (input.form) input.form.__psearch = true;
    input.setAttribute('autocomplete', 'off');
    var t = null;
    input.addEventListener('focus', function () { activeInput = input; load().catch(function () {}); if (input.value.trim().length >= CONFIG.minChars) run(input); });
    input.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { run(input); }, 60); });
    input.addEventListener('keydown', function (e) {
      if (panel.style.display !== 'block') return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(cursor + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(cursor - 1); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); } // zavře panel, dotaz v poli zůstane
      else if (e.key === 'Enter' && cursor >= 0) {
        e.preventDefault();
        if (cursor < results.length) go(cursor);
        else act(panel.querySelectorAll('.ps-item,.ps-all')[cursor]);
      }
    });
    // Enter (bez vybrané položky) a tlačítko Hledat vždy otevřou stránku /vyhledavani/ (jako v2).
    // Na ní se nad výpis Shoptetu doplní výsledky z tohoto vyhledávání (resultsPage).
    if (input.form && !input.form.__psearch3) {
      input.form.__psearch3 = true;
      input.form.addEventListener('submit', function () { close(); });
    }
  }

  function act(el) {
    if (!el) return;
    var i = el.getAttribute('data-i');
    if (i === 'all') expand();
    else if (i === 'rest') showRest();
    else if (i === 'shop') submitAll();
    else go(Number(i));
  }

  // ===== STRÁNKA VÝSLEDKŮ /vyhledavani/ =====
  function card(it) {
    return '<a class="ps-card" href="' + esc(it.url) + '">' +
      (it.img ? '<img class="ps-img" loading="lazy" alt="" data-o="' + esc(it.img) + '" src="' + esc(CONFIG.thumb(it.img)) + '">' : '<span class="ps-img"></span>') +
      '<span><span class="ps-name">' + esc(it.name) + '</span>' +
      '<span class="ps-price">' + priceHtml(it) + '</span>' + (it.stock ? '<span class="ps-stock">Skladem</span>' : '') + '</span></a>';
  }
  function resultsPage() {
    if (CONFIG.resultsPage === 'off' || location.pathname.indexOf('/vyhledavani') !== 0) return;
    var q = (new URLSearchParams(location.search).get('string') || '').trim();
    if (q.length < CONFIG.minChars) return;
    load().then(function (e) {
      var res = e.search(q, CONFIG.expandLimit);
      track('naseptavac_stranka', { search_term: q, pocet_vysledku: res.total, chybi: (res.missing || []).join(' ') });
      if (!res.total && !res.rest) return; // nic a nic širšího k nabídnutí → stránka Shoptetu beze změny
      var content = document.getElementById('content');
      if (!content) return;
      var shopList = document.getElementById('products-found');
      var box = document.createElement('div');
      box.id = 'psearch-page';
      var html = '';
      if (!res.total) {
        html = '<div class="ps-note">Pro tento dotaz jsme nenašli odpovídající produkty.' +
          (res.rest ? ' <a href="' + esc(CONFIG.searchUrl + encodeURIComponent(res.rest)) + '">Zobrazit výsledky jen pro „' + esc(res.rest) + '“ (' + res.restTotal + ')</a>' : '') + '</div>';
      } else {
        html += '<h4>Nalezené produkty (' + res.total + ')</h4><div class="ps-grid">' +
          res.items.slice(0, CONFIG.pageLimit).map(card).join('') + '</div>';
        if (res.items.length > CONFIG.pageLimit) html += '<button type="button" class="ps-more">Zobrazit další (' + (res.items.length - CONFIG.pageLimit) + ')</button>';
        if (res.total > res.items.length) html += '<p class="ps-msg">Zobrazeno ' + res.items.length + ' z ' + res.total + '. Upřesněte hledání.</p>';
      }
      box.innerHTML = html;
      var more = box.querySelector('.ps-more');
      if (more) more.addEventListener('click', function () {
        box.querySelector('.ps-grid').insertAdjacentHTML('beforeend', res.items.slice(CONFIG.pageLimit).map(card).join(''));
        more.remove();
      });
      box.addEventListener('error', imgFallback, true);
      if (shopList) {
        shopList.parentNode.insertBefore(box, shopList);
        if (CONFIG.resultsPage === 'replace' && res.total) {
          shopList.style.display = 'none';
          var ctl = shopList.parentNode.querySelector('.listingControls');
          if (ctl) ctl.style.display = 'none';
        }
      } else {
        var h = content.querySelector('h1,h2');
        if (h) h.insertAdjacentElement('afterend', box); else content.insertBefore(box, content.firstChild);
      }
      box.addEventListener('click', function (ev) {
        var a = ev.target.closest('a.ps-card');
        if (a) track('naseptavac_stranka_klik', { search_term: q, produkt: a.textContent.slice(0, 100) });
      });
    }).catch(function () {});
  }

  // malý náhled neexistuje → původní obrázek, a když ani ten, skrýt
  function imgFallback(e) {
    var t = e.target;
    if (!t || t.tagName !== 'IMG') return;
    var o = t.getAttribute('data-o');
    if (o && t.src !== o) { t.removeAttribute('data-o'); t.src = o; } else t.style.visibility = 'hidden';
  }

  panel.addEventListener('mousedown', function (e) { e.preventDefault(); });
  panel.addEventListener('click', function (e) {
    var el = e.target.closest('[data-i]');
    if (!el) return;
    e.preventDefault();
    act(el);
  });
  panel.addEventListener('error', imgFallback, true);
  document.addEventListener('mousedown', function (e) {
    if (!panel.contains(e.target) && e.target !== activeInput) close();
  });
  window.addEventListener('resize', place);
  window.addEventListener('scroll', place, { passive: true });

  function scan() { document.querySelectorAll(CONFIG.inputSelector).forEach(attach); }
  function start() {
    // v2 už je k poli připojená (řádek v3 je za řádkem v2) → v3 se raději nezapne, aby nevznikly
    // dva našeptávače a dvojité měření. Zůstane v2 (nebo původní vyhledávání Shoptetu).
    var first = document.querySelector(CONFIG.inputSelector);
    if (first && first.__psearch && !first.__psearch3) {
      if (window.console) console.warn('psearch3: běží už v2 – vložte řádek search-v3.js před search-v2.js');
      st.remove();
      return;
    }
    scan();
    resultsPage();
    var pending = false;
    new MutationObserver(function () {
      if (pending) return;
      pending = true;
      setTimeout(function () { pending = false; scan(); }, 300);
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
