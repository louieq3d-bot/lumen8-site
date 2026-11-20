/*
 * PostHog product analytics, cookieless until consent (EMPIRE shared loader, 2026-11-20).
 *
 * Use:  <script src="/assets/posthog-consent.js" data-ph-key="phc_..." data-ph-company="<company>"
 *               data-ph-surface="site" defer></script>
 *
 * - No key (or not a phc_ key) -> nothing loads. The key is PostHog's PUBLIC project token; never put a
 *   personal API key (phx_...) here.
 * - Before a choice and after "No": persistence 'memory' (no cookies, no localStorage from PostHog),
 *   anonymous page views only. After "Yes": 'localStorage+cookie' so returning visitors are linked.
 * - Session replay, surveys, heatmap/dead-click/web-vitals extras are off. IP capture is turned off in the
 *   PostHog project settings (EU orgs default to discard).
 * - Skipped for: localhost/dev hosts, automation (navigator.webdriver, headless, probes, bots), Do Not Track /
 *   Global Privacy Control, and browsers marked internal with ?ph_internal=1 (undo: ?ph_internal=0).
 * - The small banner shows once; the choice is kept in localStorage 'ph_consent' = yes|no.
 *   Any element with [data-ph-consent-open] reopens it (e.g. a "Cookie settings" footer link).
 */
(function () {
  'use strict';
  var me = document.currentScript || document.querySelector('script[data-ph-key]');
  if (!me || window.__phConsentLoaded) return;
  window.__phConsentLoaded = true;
  var d = me.dataset || {};
  var KEY = (d.phKey || '').trim();
  if (KEY.indexOf('phc_') !== 0) return;
  var HOST = d.phHost || 'https://eu.i.posthog.com';
  var COMPANY = d.phCompany || '';
  var SURFACE = d.phSurface || 'site';
  var LS_CONSENT = 'ph_consent';
  var LS_INTERNAL = 'ph_internal';

  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { window.localStorage.removeItem(k); } catch (e) {} }

  // Own traffic: mark a browser once with ?ph_internal=1 (undo with ?ph_internal=0).
  try {
    var q = new URLSearchParams(location.search);
    if (q.get('ph_internal') === '1') lsSet(LS_INTERNAL, '1');
    if (q.get('ph_internal') === '0') lsDel(LS_INTERNAL);
  } catch (e) {}
  if (lsGet(LS_INTERNAL) === '1') return;

  var host = location.hostname;
  if (!host || host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || /\.(localhost|test)$/.test(host)) {
    if (d.phDebugLocal !== '1') return;
  }
  var ua = navigator.userAgent || '';
  if (navigator.webdriver || /HeadlessChrome|PhantomJS|Lighthouse|Mothership|health|probe|bot|crawl|spider|slurp|curl|python|node-fetch|axios/i.test(ua)) return;
  if (navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1') return;

  /* Official posthog-js loader stub (queues calls until array.js arrives). */
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags on onFeatureFlags onSessionId identify setPersonProperties group resetGroups reset get_distinct_id getGroups get_session_id alias set_config opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

  var consent = lsGet(LS_CONSENT);
  window.posthog.init(KEY, {
    api_host: HOST,
    ui_host: HOST.indexOf('eu.') >= 0 ? 'https://eu.posthog.com' : 'https://us.posthog.com',
    persistence: consent === 'yes' ? 'localStorage+cookie' : 'memory',
    person_profiles: 'identified_only',
    capture_pageview: 'history_change',
    capture_pageleave: true,
    autocapture: true,
    mask_all_text: false,
    mask_all_element_attributes: false,
    disable_session_recording: true,
    disable_surveys: true,
    capture_dead_clicks: false,
    capture_heatmaps: false,
    capture_performance: false,
    enable_heatmaps: false,
    advanced_disable_toolbar_metrics: true,
    respect_dnt: true,
    loaded: function (ph) {
      ph.register({ company: COMPANY, surface: SURFACE });
    }
  });

  function decide(v) {
    lsSet(LS_CONSENT, v);
    try { window.posthog.set_config({ persistence: v === 'yes' ? 'localStorage+cookie' : 'memory' }); } catch (e) {}
    hide();
  }

  var bar;
  function hide() { if (bar && bar.parentNode) bar.parentNode.removeChild(bar); bar = null; }
  function show() {
    if (bar || !document.body) return;
    var lang = (document.documentElement.lang || 'en').slice(0, 2);
    var T = {
      en: ['We count visits anonymously to improve this site. May we also set a cookie to recognise you on your next visit?', 'Allow', 'No thanks', 'Privacy'],
      de: ['Wir zählen Besuche anonym, um diese Seite zu verbessern. Dürfen wir ein Cookie setzen, um Sie beim nächsten Besuch wiederzuerkennen?', 'Erlauben', 'Nein danke', 'Datenschutz'],
      fr: ['Nous comptons les visites de façon anonyme pour améliorer ce site. Pouvons-nous déposer un cookie pour vous reconnaître lors de votre prochaine visite ?', 'Accepter', 'Non merci', 'Confidentialité'],
      es: ['Contamos las visitas de forma anónima para mejorar este sitio. ¿Podemos usar una cookie para reconocerte en tu próxima visita?', 'Permitir', 'No, gracias', 'Privacidad'],
      nl: ['We tellen bezoeken anoniem om deze site te verbeteren. Mogen we een cookie plaatsen om je bij een volgend bezoek te herkennen?', 'Toestaan', 'Nee, bedankt', 'Privacy'],
      pt: ['Contamos as visitas de forma anónima para melhorar este site. Podemos usar um cookie para o reconhecer na próxima visita?', 'Permitir', 'Não, obrigado', 'Privacidade']
    }[lang] || null;
    if (!T) T = ['We count visits anonymously to improve this site. May we also set a cookie to recognise you on your next visit?', 'Allow', 'No thanks', 'Privacy'];
    var privacy = d.phPrivacy === undefined ? '/privacy' : d.phPrivacy; // data-ph-privacy="" = no link
    bar = document.createElement('div');
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-live', 'polite');
    bar.setAttribute('aria-label', 'Cookies');
    bar.className = 'ph-consent';
    bar.style.cssText = 'position:fixed;z-index:2147483000;left:16px;right:16px;bottom:16px;max-width:520px;margin:0 auto;' +
      'background:#111827;color:#f9fafb;border-radius:12px;padding:14px 16px;box-shadow:0 8px 30px rgba(0,0,0,.25);' +
      'font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;display:flex;flex-wrap:wrap;gap:10px;align-items:center';
    var p = document.createElement('p');
    p.style.cssText = 'margin:0;flex:1 1 260px';
    p.textContent = T[0] + ' ';
    if (privacy) {
      var a = document.createElement('a');
      a.href = privacy; a.textContent = T[3];
      a.style.cssText = 'color:inherit;text-decoration:underline';
      p.appendChild(a);
    }
    function btn(label, primary, v) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = label;
      b.style.cssText = 'cursor:pointer;border-radius:8px;padding:7px 14px;font:inherit;border:1px solid #9ca3af;' +
        (primary ? 'background:#f9fafb;color:#111827;border-color:#f9fafb' : 'background:transparent;color:#f9fafb');
      b.addEventListener('click', function () { decide(v); });
      return b;
    }
    bar.appendChild(p);
    bar.appendChild(btn(T[2], false, 'no'));
    bar.appendChild(btn(T[1], true, 'yes'));
    document.body.appendChild(bar);
  }

  document.addEventListener('click', function (ev) {
    var t = ev.target && ev.target.closest && ev.target.closest('[data-ph-consent-open]');
    if (t) { ev.preventDefault(); show(); }
  });
  if (d.phBanner !== 'off' && consent !== 'yes' && consent !== 'no') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show);
    else show();
  }
})();
