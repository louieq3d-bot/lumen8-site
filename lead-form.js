/* lumen8.ai "Request a study" form (L8-L-17): posts JSON to /api/lead, answered by the lumen8-site-edge Worker
   (_edge/worker.js), which stores the lead and mails it to sales@lumen8.ai (Mothership Mail).
   Success is shown only on a 2xx; anything else points the visitor at sales@lumen8.ai so no request is lost.
   The visit's first utm tags, referrer and landing page are kept in sessionStorage so the lead records its source. */
(function () {
  'use strict';
  var KEY = 'l8-src';
  try {
    if (!sessionStorage.getItem(KEY)) {
      var q = new URLSearchParams(location.search), utm = [];
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(function (k) {
        if (q.get(k)) utm.push(k.slice(4) + '=' + q.get(k).slice(0, 60));
      });
      var ref = '';
      try { ref = document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) { /* bad referrer */ }
      if (ref === location.hostname) ref = '';
      sessionStorage.setItem(KEY, JSON.stringify({ utm: utm.join('&'), ref: ref, landing: location.pathname }));
    }
  } catch (e) { /* storage blocked: the lead simply has no source */ }

  var form = document.getElementById('lead-form');
  if (!form) return;
  var status = form.querySelector('.form-status');
  var button = form.querySelector('button[type=submit]');
  function say(msg, ok) { status.textContent = msg; status.className = 'form-status ' + (ok ? 'ok' : 'err'); }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (!form.reportValidity()) return;
    var data = { kind: form.dataset.kind || 'study' };
    new FormData(form).forEach(function (v, k) { data[k] = String(v).trim(); });
    if (data.website) { say('Thank you. We will reply within two working days.', true); form.reset(); return; } // honeypot
    delete data.website;
    try {
      var src = JSON.parse(sessionStorage.getItem(KEY) || '{}');
      data.src_utm = src.utm || ''; data.src_ref = src.ref || ''; data.src_landing = src.landing || '';
    } catch (e) { /* no source */ }
    button.disabled = true; say('Sending…', true);
    fetch('/api/lead', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) {
        if (!r.ok) throw new Error(String(r.status));
        say('Thank you. We will reply within two working days.', true);
        form.reset();
        try { if (window.posthog && window.posthog.capture) window.posthog.capture('lead_submitted', { kind: data.kind }); } catch (e) { /* analytics optional */ }
      })
      .catch(function () {
        say('Sorry, that did not go through. Please email sales@lumen8.ai instead.', false);
      })
      .then(function () { button.disabled = false; });
  });
})();
