/* ============================================================
   De-Extinct: Jurassic Dinosaurs — landing page
   12-language i18n, RTL support, outbound link hardening.

   Language priority: ?lang= > localStorage > navigator.language > en.
   No gate and no player here: this page is informational and every
   outbound link goes to the App Store in a new tab.
   ============================================================ */
(function () {
  'use strict';

  /* One key per page. Written as a real string, never a placeholder: a sentinel
     left in place survives into the shipped file and still looks correct in a
     diff, and a shared key leaks language choice between pages. */
  var LANG_KEY = ['lp', 'lang', 'de-extinct'].join('_');   // lp_lang_de-extinct

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

  var dict = {};
  var currentLang = 'en';
  var enSnapshot = new Map();

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
    var stored = localStorage.getItem(LANG_KEY);
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
    document.querySelectorAll('[data-i18n-alt]').forEach(function (el) {
      var k = 'alt:' + el.getAttribute('data-i18n-alt');
      if (!enSnapshot.has(k)) enSnapshot.set(k, el.getAttribute('alt') || '');
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

    document.querySelectorAll('[data-i18n-alt]').forEach(function (el) {
      var k = el.getAttribute('data-i18n-alt');
      var v = useEnglish ? undefined : t(k);
      if (v !== undefined) el.setAttribute('alt', v);
      else if (useEnglish && enSnapshot.has('alt:' + k)) {
        el.setAttribute('alt', enSnapshot.get('alt:' + k));
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
    });
  }

  /* Every outbound anchor opens in a new tab; nothing else gets target=_blank.
     The App Store link is the single conversion target. */
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
    loadDict(currentLang).then(function () {
      applyI18n();
      applyDir(currentLang);
      markCurrent();
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
