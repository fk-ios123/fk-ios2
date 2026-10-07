(function () {
  'use strict';
  const ua = navigator.userAgent || '';
  const params = new URLSearchParams(location.search);
  // fbclid also occurs on organic shares; it is deliberately not an ad signal.
  // ponytail: UA is heuristic; unknown/stripped Facebook UAs fail closed.
  const eligible = /iPhone/i.test(ua) && /FBAN\/FBIOS|FB_IAB\/FB4A|\bFBAV\//i.test(ua)
    && !/Instagram|Messenger|FBAN\/(?:Messenger|Orca)/i.test(ua)
    && params.get('fb_ad') === '1' && location.protocol === 'https:';
  if (!eligible) return;

  const panel = document.getElementById('fb-browser');
  const open = document.getElementById('fb-open');
  const help = document.getElementById('fb-help');
  const input = document.getElementById('fb-url');
  const status = document.getElementById('fb-status');
  const key = 'dating-fb:safari:' + location.pathname;
  let timer;
  let copyStatus = null;
  let dismissed = false;
  const read = () => { try { return sessionStorage.getItem(key); } catch (_) { return null; } };
  const remember = value => { try { sessionStorage.setItem(key, value); } catch (_) {} };
  function pageUrl () {
    const url = new URL(location.href);
    // Carry selected language across the separate browser storage contexts.
    url.searchParams.set('lang', document.documentElement.lang || 'en');
    return url.href;
  }
  function refresh () {
    // 已显示的复制结果也在语言切换后同步更新。
    if (copyStatus) status.textContent = document.getElementById(copyStatus).textContent;
    input.value = pageUrl();
    open.href = input.value.replace(/^https:/, 'x-safari-https:');
  }
  function show (fallback) {
    if (dismissed || document.hidden) return;
    refresh();
    panel.hidden = false;
    if (fallback) help.open = true;
  }
  function schedule (fallback) {
    clearTimeout(timer);
    timer = setTimeout(() => show(fallback), 1500);
  }
  open.addEventListener('click', () => {
    refresh(); // Native anchor navigation retains the user's activation.
    schedule(true);
  });
  document.getElementById('fb-dismiss').addEventListener('click', () => {
    dismissed = true;
    panel.hidden = true;
    clearTimeout(timer);
    remember('dismissed');
  });
  document.getElementById('fb-copy').addEventListener('click', async () => {
    refresh();
    try {
      await navigator.clipboard.writeText(input.value);
      copyStatus = 'fb-copied-text';
      refresh();
    } catch (_) {
      copyStatus = 'fb-copy-failed-text';
      refresh();
      input.focus();
      input.select();
      input.setSelectionRange(0, input.value.length);
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimeout(timer);
    else show(false); // Returning to Facebook is not proof the handoff succeeded.
  });
  window.addEventListener('pagehide', () => clearTimeout(timer));
  window.addEventListener('pageshow', event => { if (event.persisted) show(false); });
  new MutationObserver(refresh).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  if (read() === 'dismissed') { dismissed = true; return; }
  refresh();
  if (read()) { show(false); return; }
  remember('attempted');
  // Best effort only: iOS/Facebook can block this or display a confirmation.
  // Do not retry automatically; keep the original landing page available.
  schedule(false);
  try { location.assign(open.href); } catch (_) { show(false); }
})();
