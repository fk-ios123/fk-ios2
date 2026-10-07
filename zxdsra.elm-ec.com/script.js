/* Panel localization only — the game itself is the original, unmodified build. */
(function () {
  'use strict';
  var dictionaries = window.LP_TRANSLATIONS || {};
  var supported = Object.keys(dictionaries);
  var LANG_KEY = 'lp_lang_staggering_fb_v1';
  var get = function (d, p) { return p.split('.').reduce(function (v, k) { return v && v[k]; }, d); };
  var norm = function (v) {
    var s = String(v || '').toLowerCase();
    if (s.indexOf('zh') === 0) return 'zh-TW';
    return supported.filter(function (k) { return s === k.toLowerCase() || s.indexOf(k.toLowerCase() + '-') === 0; })[0];
  };
  var saved; try { saved = localStorage.getItem(LANG_KEY); } catch (_) {}
  var lang = norm(new URLSearchParams(location.search).get('lang')) || norm(saved) || norm(navigator.language) || 'en';
  var dict = dictionaries[lang] || dictionaries.en || {};
  var fallback = dictionaries.en || {};
  document.querySelectorAll('[data-i18n]').forEach(function (node) {
    var t = get(dict, node.dataset.i18n) || get(fallback, node.dataset.i18n);
    if (typeof t === 'string') node.textContent = t;
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach(function (node) {
    var t = get(dict, node.dataset.i18nAriaLabel) || get(fallback, node.dataset.i18nAriaLabel);
    if (typeof t === 'string') node.setAttribute('aria-label', t);
  });
  document.documentElement.lang = lang;
  var panel = document.getElementById('fb-browser');
  if (panel) panel.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  try { localStorage.setItem(LANG_KEY, lang); } catch (_) {}
})();
