/* ============================================================
   Wolf Game: Wild Animal Wars — PACK COMMAND
   12-language i18n, RTL, tap-to-enter gate with a 3 s cover.

   Language priority: ?lang= > localStorage > navigator.language > en.
   Entry: tap -> 3 s cover that doubles as the first-paint window. The short
   wait is intentional dwell time and runs on every visit, reloads included,
   so no session or storage flag skips it. No age marker is shown.
   ============================================================ */
(function () {
  'use strict';

  /* One key per page. Written as a real string, never a placeholder: a sentinel
     left in place survives into the shipped file and still looks correct in a
     diff, and a shared key leaks language choice between pages. */
  var LANG_KEY = ['lp', 'lang', 'wolfgame-alphas'].join('_');   // lp_lang_wolfgame-alphas

  var LANGS = [
    { code: 'en',    label: 'English',    native: 'English' },
    { code: 'de',    label: 'German',     native: 'Deutsch' },
    { code: 'fr',    label: 'French',     native: 'Français' },
    { code: 'es',    label: 'Spanish',    native: 'Español' },
    { code: 'pt',    label: 'Portuguese', native: 'Português' },
    { code: 'ru',    label: 'Russian',    native: 'Русский' },
    { code: 'ja',    label: 'Japanese',   native: '日本語' },
    { code: 'ko',    label: 'Korean',     native: '한국어' },
    { code: 'th',    label: 'Thai',       native: 'ไทย' },
    { code: 'vi',    label: 'Vietnamese', native: 'Tiếng Việt' },
    { code: 'ar',    label: 'Arabic',     native: 'العربية' },
    { code: 'zh-TW', label: 'Chinese (TW)', native: '繁體中文' }
  ];

  var TICKS = 18;   // cover tick-rail cells

  var TIMING = {
    minimumDwellMs: 900,
    countdownMs: 3000,
    preloadTimeoutMs: 4000,
    pauseWhenHidden: true
  };

  var dict = {};
  var currentLang = 'en';
  var enSnapshot = new Map();

  /* ---------------------------------------------------------
     i18n
     --------------------------------------------------------- */
  function t (path) {
    var cur = dict;
    var parts = path.split('.');
    for (var i = 0; i < parts.length; i++) {
      if (!cur || typeof cur !== 'object') return undefined;
      cur = cur[parts[i]];
    }
    return typeof cur === 'string' ? cur : undefined;
  }

  function pickLang () {
    var q = new URLSearchParams(location.search).get('lang');
    if (q && LANGS.some(function (l) { return l.code === q; })) return q;
    var stored = null;
    try { stored = localStorage.getItem(LANG_KEY); } catch (e) { stored = null; }
    if (stored && LANGS.some(function (l) { return l.code === stored; })) return stored;
    var nav = (navigator.language || 'en').toLowerCase();
    var m = LANGS.find(function (l) {
      var c = l.code.toLowerCase();
      return nav === c || nav.indexOf(c + '-') === 0;
    });
    return m ? m.code : 'en';
  }

  function loadDict (lang) {
    return fetch('i18n/' + lang + '.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; })
      .then(function (d) { dict = d || {}; });
  }

  /* The HTML carries English defaults so the page reads correctly before JS
     runs. Snapshot them once so switching back to `en` restores the original
     markup rather than whatever locale happened to be applied last. */
  function snapshotEnglish () {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var k = el.getAttribute('data-i18n');
      if (!enSnapshot.has(k)) enSnapshot.set(k, el.innerHTML);
    });
    document.querySelectorAll('[data-i18n-content]').forEach(function (el) {
      var k = 'content:' + el.getAttribute('data-i18n-content');
      if (!enSnapshot.has(k)) enSnapshot.set(k, el.getAttribute('content') || '');
    });
  }

  function applyI18n () {
    var useEnglish = currentLang === 'en';

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var k = el.getAttribute('data-i18n');
      var v = useEnglish ? undefined : t(k);
      if (v === undefined) {
        if (useEnglish && enSnapshot.has(k)) el.innerHTML = enSnapshot.get(k);
        return;
      }
      /* Values carrying \n are authored as HTML so the break survives */
      if (v.indexOf('\n') !== -1 || /<[a-z][^>]*>/i.test(v)) el.innerHTML = v;
      else el.textContent = v;
    });

    document.querySelectorAll('[data-i18n-content]').forEach(function (el) {
      var k = el.getAttribute('data-i18n-content');
      var v = useEnglish ? undefined : t(k);
      if (v !== undefined) el.setAttribute('content', v);
      else if (useEnglish && enSnapshot.has('content:' + k)) {
        el.setAttribute('content', enSnapshot.get('content:' + k));
      }
    });

    var titleEl = document.querySelector('title[data-i18n]');
    if (titleEl) {
      var tv = useEnglish ? undefined : t('meta.title');
      if (tv) titleEl.textContent = tv;
      else if (useEnglish && enSnapshot.has('meta.title')) {
        titleEl.textContent = enSnapshot.get('meta.title');
      }
    }
  }

  /* Arabic is the only RTL locale in the set. */
  function applyDir (lang) {
    var rtl = lang === 'ar';
    document.documentElement.setAttribute('dir', rtl ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lang);
  }

  function setupLangMenu () {
    var menu = document.getElementById('lang-list');
    var btn = document.getElementById('lang-btn');
    var code = document.getElementById('lang-code');
    if (!menu || !btn) return;

    LANGS.forEach(function (l) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'option');
      b.setAttribute('data-lang', l.code);
      b.innerHTML = '<span>' + l.label + '</span><span class="lang-native">' + l.native + '</span>';
      b.addEventListener('click', function () { switchLang(l.code); });
      li.appendChild(b);
      menu.appendChild(li);
    });

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = !menu.hidden;
      menu.hidden = open;
      btn.setAttribute('aria-expanded', String(!open));
    });

    document.addEventListener('click', function (e) {
      if (!menu.hidden && !menu.contains(e.target) && e.target !== btn) {
        menu.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) {
        menu.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
        btn.focus();
      }
    });

    if (code) code.textContent = currentLang === 'zh-TW' ? '繁中' : currentLang.toUpperCase();
  }

  function markCurrent () {
    document.querySelectorAll('#lang-list button').forEach(function (b) {
      b.setAttribute('aria-current', String(b.getAttribute('data-lang') === currentLang));
    });
  }

  function switchLang (lang) {
    if (!LANGS.some(function (l) { return l.code === lang; })) return;
    currentLang = lang;
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
    var code = document.getElementById('lang-code');
    if (code) code.textContent = lang === 'zh-TW' ? '繁中' : lang.toUpperCase();
    var menu = document.getElementById('lang-list');
    var btn = document.getElementById('lang-btn');
    if (menu) menu.hidden = true;
    if (btn) btn.setAttribute('aria-expanded', 'false');
    loadDict(lang).then(function () {
      applyI18n();
      applyDir(lang);
      markCurrent();
      applyCoverCopy();
    });
  }

  /* The cover owns its own copy, and the cover may still be on screen when the
     language changes. Re-read it after every dictionary swap. */
  function applyCoverCopy () {
    var label = document.querySelector('.cover-label');
    if (!label) return;
    var v = currentLang === 'en' ? undefined : t('cover.label');
    if (v) label.textContent = v;
  }

  /* ---------------------------------------------------------
     ENTRY — tap, then a 3 s cover.
     Markup ships visible and JS only removes it, so a failed script cannot
     leave a blank page. Runs on every visit, reloads included: the short wait
     is deliberate dwell, so no session or storage flag skips it.
     --------------------------------------------------------- */
  function setupEntry () {
    var gate = document.getElementById('gate');
    var cover = document.getElementById('gate-cover');
    var enter = document.getElementById('gate-enter');
    if (!gate || !cover) return;

    document.body.classList.add('gate-open');

    var proceed = function () {
      gate.remove();
      runCover();
    };

    if (enter) enter.addEventListener('click', proceed, { once: true });
  }

  function runCover () {
    var cover = document.getElementById('gate-cover');
    if (!cover) return;
    cover.hidden = false;

    var countEl = document.getElementById('cover-count');
    var ticksEl = document.getElementById('cover-ticks');
    var ticks = [];
    if (ticksEl && !ticksEl.children.length) {
      var frag = document.createDocumentFragment();
      for (var i = 0; i < TICKS; i++) {
        var sp = document.createElement('span');
        frag.appendChild(sp);
        ticks.push(sp);
      }
      ticksEl.appendChild(frag);
    } else if (ticksEl) {
      ticks = Array.prototype.slice.call(ticksEl.children);
    }

    var total = Math.max(600, TIMING.countdownMs);
    var dwell = Math.max(0, TIMING.minimumDwellMs);

    var visibleMs = 0;
    var last = performance.now();
    var done = false;
    var heroReady = false;

    var heroImg = document.querySelector('.plate img');
    if (heroImg) {
      var markReady = function () { heroReady = true; };
      if (heroImg.complete && heroImg.naturalWidth > 0) heroReady = true;
      else {
        heroImg.addEventListener('load', markReady, { once: true });
        heroImg.addEventListener('error', markReady, { once: true });
      }
    } else {
      heroReady = true;
    }

    var ceiling = window.setTimeout(finish, total + TIMING.preloadTimeoutMs);

    function tick (now) {
      if (done) return;
      var dt = now - last;
      last = now;

      if (!TIMING.pauseWhenHidden || document.visibilityState === 'visible') {
        visibleMs += dt;
      }

      var pct = Math.min(1, visibleMs / total);
      var left = Math.max(1, Math.ceil((total - visibleMs) / 1000));
      if (countEl) countEl.textContent = String(left);

      // Ticks fill left-to-right across the countdown.
      var lit = Math.round(pct * ticks.length);
      for (var i = 0; i < ticks.length; i++) {
        ticks[i].classList.toggle('on', i < lit);
      }

      var gateMs = Math.max(dwell, total);
      var dwellOk = visibleMs >= gateMs;
      var readyOk = heroReady || visibleMs >= (gateMs + TIMING.preloadTimeoutMs);

      if (dwellOk && readyOk) { finish(); return; }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    function finish () {
      if (done) return;
      done = true;
      window.clearTimeout(ceiling);
      document.body.classList.remove('gate-open');
      cover.hidden = true;
      document.documentElement.dataset.entered = '1';
    }
  }

  /* Every outbound anchor opens in a new tab; nothing else gets target=_blank.
     The store link is the single conversion target. */
  function hardenOutbound () {
    document.querySelectorAll('a[href]').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      if (href.charAt(0) === '#' || href.indexOf('javascript:') === 0) return;
      if (/^https?:/i.test(href)) {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      }
    });
  }

  function boot () {
    snapshotEnglish();
    currentLang = pickLang();
    setupLangMenu();
    hardenOutbound();
    setupEntry();
    loadDict(currentLang).then(function () {
      applyI18n();
      applyDir(currentLang);
      markCurrent();
      applyCoverCopy();
      if (currentLang !== 'en') {
        var code = document.getElementById('lang-code');
        if (code) code.textContent = currentLang === 'zh-TW' ? '繁中' : currentLang.toUpperCase();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
