// node --test _edge/worker.test.mjs  (forked from heliofield site/tests/worker.test.mjs)
// The lead endpoint in _edge/worker.js with a mocked env: D1 (LEADS_DB), Email Routing (LEAD_MAIL), rate limiter and
// Analytics Engine. `cloudflare:email` is stubbed through a module resolve hook.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

const STUB = 'export class EmailMessage { constructor(from, to, raw) { this.from = from; this.to = to; this.raw = raw; } }';
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  if (spec === 'cloudflare:email') return { url: 'data:text/javascript,' + encodeURIComponent(${JSON.stringify(STUB)}), shortCircuit: true };
  return next(spec, ctx);
}`));
const { default: worker, CSP, page, HONEYPOT, LEADS_SCHEMA, _resetSchemaCache } = await import('./worker.js');

/** In-memory stand-in for the D1 statements the Worker issues. */
function fakeD1({ failInsert = false, failSchema = false } = {}) {
  const rows = [];
  const calls = [];
  const stmt = (sql) => {
    let args = [];
    const s = {
      bind(...a) { args = a; return s; },
      async run() {
        calls.push(sql.trim().split(/\s+/).slice(0, 2).join(' '));
        if (/^CREATE/.test(sql.trim())) { if (failSchema) throw new Error('schema down'); return { success: true }; }
        if (/^INSERT INTO leads/.test(sql.trim())) {
          if (failInsert) throw new Error('D1 down');
          const cols = sql.match(/\(([^)]*)\)\s*VALUES/)[1].split(',').map((c) => c.trim());
          rows.push(Object.fromEntries(cols.map((c, i) => [c, args[i]])));
          return { success: true };
        }
        if (/^UPDATE leads SET notified_at/.test(sql.trim())) {
          const r = rows.find((x) => x.id === args[3]);
          if (r) Object.assign(r, { notified_at: args[0], notified_to: args[1], notify_error: args[2] });
          return { success: true };
        }
        throw new Error(`unexpected run: ${sql}`);
      },
      async first() {
        if (/^SELECT COUNT\(\*\) AS n FROM leads WHERE ip_hash/.test(sql.trim())) {
          return { n: rows.filter((r) => r.ip_hash === args[0] && r.created_at > args[1]).length };
        }
        throw new Error(`unexpected first: ${sql}`);
      },
    };
    return s;
  };
  return { rows, calls, prepare: stmt, async batch(list) { return Promise.all(list.map((x) => x.run())); } };
}

function fakeMail({ fail = [] } = {}) {
  const sent = [];
  const tried = [];
  return { sent, tried, async send(msg) { tried.push(msg.to); if (fail.includes(msg.to)) throw new Error(`refused ${msg.to}`); sent.push(msg); } };
}

function envOf(o = {}) {
  return {
    LEAD_TO: 'sales@lumen8.ai', LEAD_TO_FALLBACK: 'owner@example.com', CONSENT_VERSION: 'demo-notice-test',
    LEAD_MAIL: fakeMail(), LEADS_DB: fakeD1(), LEADS: { points: [], writeDataPoint(p) { this.points.push(p); } }, ...o,
  };
}

const BODY = { kind: 'study', name: 'Ada Example', email: 'ada@example.org', company: 'Example Farms', country: 'Germany',
  role: 'Research', grow: 'Potatoes, 4 ha', heard: 'search', src_landing: '/tools/compliance-checker', src_ref: 'example.net', src_utm: '' };

function post(body, { origin = 'https://lumen8.ai', ip = '203.0.113.7', referer = 'https://lumen8.ai/studies.html', method = 'POST', raw } = {}) {
  return new Request('https://lumen8.ai/api/lead', {
    method, headers: { origin, 'content-type': 'application/json', 'cf-connecting-ip': ip, referer },
    body: method === 'POST' ? (raw ?? JSON.stringify(body)) : undefined,
  });
}

function ctxOf() {
  const pending = [];
  return { pending, waitUntil(p) { pending.push(p); }, settle: () => Promise.all(pending) };
}

beforeEach(() => _resetSchemaCache());

test('stores the lead first, then mails the company address; 200', async () => {
  const env = envOf();
  const ctx = ctxOf();
  const res = await worker.fetch(post(BODY), env, ctx);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  await ctx.settle();
  assert.equal(env.LEADS_DB.rows.length, 1);
  const row = env.LEADS_DB.rows[0];
  assert.equal(row.email, 'ada@example.org');
  assert.equal(row.kind, 'study');
  assert.equal(row.source_page, '/studies.html');
  assert.equal(row.landing_page, '/tools/compliance-checker');
  assert.equal(row.consent_version, 'demo-notice-test');
  assert.equal(row.heard, 'search');
  assert.equal(JSON.parse(row.fields_json).grow, 'Potatoes, 4 ha');
  assert.equal(row.notified_to, 'sales@lumen8.ai');
  assert.ok(row.notified_at);
  assert.equal(env.LEAD_MAIL.sent.length, 1);
  const msg = env.LEAD_MAIL.sent[0];
  assert.equal(msg.to, 'sales@lumen8.ai');
  assert.match(msg.raw, /^To: <sales@lumen8\.ai>$/m);
  assert.match(msg.raw, /^Reply-To: <ada@example\.org>$/m);
  assert.match(msg.raw, /Consent text version: demo-notice-test/);
  assert.match(msg.raw, new RegExp(`Lead id: ${row.id}`));
  assert.doesNotMatch(msg.raw, /only copy/);
  assert.equal(env.LEADS.points.length, 1, 'funnel row written');
  // the order: table, rate check, insert, then the mail
  assert.deepEqual(env.LEADS_DB.calls.filter((c) => /INSERT|UPDATE/.test(c)), ['INSERT INTO', 'UPDATE leads']);
});

test('the IP is never stored, only a salted hash', async () => {
  const env = envOf({ LEAD_IP_SALT: 's3cret' });
  await worker.fetch(post(BODY, { ip: '198.51.100.23' }), env, ctxOf());
  const row = env.LEADS_DB.rows[0];
  assert.match(row.ip_hash, /^[0-9a-f]{32}$/);
  assert.ok(!JSON.stringify(row).includes('198.51.100.23'));
});

test('falls back to LEAD_TO_FALLBACK when the company address refuses; still 200', async () => {
  const env = envOf({ LEAD_MAIL: fakeMail({ fail: ['sales@lumen8.ai'] }) });
  const ctx = ctxOf();
  const res = await worker.fetch(post(BODY), env, ctx);
  assert.equal(res.status, 200);
  await ctx.settle();
  assert.deepEqual(env.LEAD_MAIL.tried, ['sales@lumen8.ai', 'owner@example.com']);
  const row = env.LEADS_DB.rows[0];
  assert.equal(row.notified_to, 'owner@example.com');
  assert.match(row.notify_error, /sales@lumen8\.ai: refused/);
});

test('never 502 once stored: every mail fails, the row records it, the visitor gets 200', async () => {
  const env = envOf({ LEAD_MAIL: fakeMail({ fail: ['sales@lumen8.ai', 'owner@example.com'] }) });
  const ctx = ctxOf();
  const res = await worker.fetch(post(BODY), env, ctx);
  assert.equal(res.status, 200);
  await ctx.settle();
  const row = env.LEADS_DB.rows[0];
  assert.equal(row.notified_at, null);
  assert.equal(row.notified_to, null);
  assert.match(row.notify_error, /owner@example\.com/);
});

test('works without ctx.waitUntil (awaits the notification)', async () => {
  const env = envOf();
  const res = await worker.fetch(post(BODY), env, undefined);
  assert.equal(res.status, 200);
  assert.equal(env.LEADS_DB.rows[0].notified_to, 'sales@lumen8.ai');
});

test('storage down but mail sent: 200, and the mail says it is the only copy', async () => {
  const env = envOf({ LEADS_DB: fakeD1({ failInsert: true }) });
  const res = await worker.fetch(post(BODY), env, ctxOf());
  assert.equal(res.status, 200);
  assert.equal(env.LEAD_MAIL.sent.length, 1);
  assert.match(env.LEAD_MAIL.sent[0].raw, /only copy/);
});

test('storage down and every mail fails: 502 (the lead is lost, the form tells the visitor)', async () => {
  const env = envOf({ LEADS_DB: fakeD1({ failSchema: true }), LEAD_MAIL: fakeMail({ fail: ['sales@lumen8.ai', 'owner@example.com'] }) });
  const res = await worker.fetch(post(BODY), env, ctxOf());
  assert.equal(res.status, 502);
  assert.deepEqual(await res.json(), { ok: false, error: 'mail' });
});

test('no D1 binding: behaves like the old mail-only Worker', async () => {
  const ok = envOf({ LEADS_DB: undefined });
  assert.equal((await worker.fetch(post(BODY), ok, ctxOf())).status, 200);
  assert.equal(ok.LEAD_MAIL.sent.length, 1);
  const bad = envOf({ LEADS_DB: undefined, LEAD_MAIL: fakeMail({ fail: ['sales@lumen8.ai', 'owner@example.com'] }) });
  assert.equal((await worker.fetch(post(BODY), bad, ctxOf())).status, 502);
});

test('honeypot filled: 200, nothing stored, nothing mailed, not counted', async () => {
  const env = envOf();
  const res = await worker.fetch(post({ ...BODY, [HONEYPOT]: 'http://spam.example' }), env, ctxOf());
  assert.equal(res.status, 200);
  assert.equal(env.LEADS_DB.rows.length, 0);
  assert.equal(env.LEAD_MAIL.tried.length, 0);
  assert.equal(env.LEADS.points.length, 0);
});

test('honeypot value is never stored or mailed when empty', async () => {
  const env = envOf();
  const ctx = ctxOf();
  await worker.fetch(post({ ...BODY, [HONEYPOT]: '' }), env, ctx);
  await ctx.settle();
  assert.ok(!(HONEYPOT in JSON.parse(env.LEADS_DB.rows[0].fields_json)));
});

test('hourly cap per client: the 11th stored lead in an hour gets 429', async () => {
  const env = envOf({ LEAD_HOURLY_MAX: '10' });
  for (let i = 0; i < 10; i++) assert.equal((await worker.fetch(post(BODY), env, ctxOf())).status, 200);
  const res = await worker.fetch(post(BODY), env, ctxOf());
  assert.equal(res.status, 429);
  assert.equal(env.LEADS_DB.rows.length, 10);
  assert.equal((await worker.fetch(post(BODY, { ip: '192.0.2.99' }), env, ctxOf())).status, 200, 'another client is not limited');
});

test('per-minute limiter (LEAD_RL) still applies', async () => {
  const env = envOf({ LEAD_RL: { limit: async () => ({ success: false }) } });
  assert.equal((await worker.fetch(post(BODY), env, ctxOf())).status, 429);
  assert.equal(env.LEADS_DB.rows.length, 0);
});

test('consent version sent by the form wins over the configured one; consent flag stored', async () => {
  const env = envOf();
  await worker.fetch(post({ ...BODY, consent_version: 'privacy-2026-12-01', consent: 'on' }), env, ctxOf());
  const row = env.LEADS_DB.rows[0];
  assert.equal(row.consent_version, 'privacy-2026-12-01');
  assert.equal(row.consent_given, 1);
});

test('source page: only same-site referers count; otherwise the form\'s page field', async () => {
  const env = envOf();
  await worker.fetch(post({ ...BODY, page: '/de/demo' }, { referer: 'https://evil.example/x' }), env, ctxOf());
  assert.equal(env.LEADS_DB.rows[0].source_page, '/de/demo');
});

test('guards: origin, method, preflight, kind, size, empty, json', async () => {
  const env = envOf();
  assert.equal((await worker.fetch(post(BODY, { origin: 'https://evil.example' }), env)).status, 403);
  assert.equal((await worker.fetch(post(BODY, { method: 'GET' }), env)).status, 405);
  assert.equal((await worker.fetch(post(BODY, { method: 'OPTIONS' }), env)).status, 204);
  assert.equal((await worker.fetch(post({ ...BODY, kind: 'other' }), env)).status, 400);
  assert.equal((await worker.fetch(post(null, { raw: '{"kind":"study","x":"' + 'a'.repeat(9000) + '"}' }), env)).status, 413);
  assert.equal((await worker.fetch(post({ kind: 'study' }), env)).status, 400);
  assert.equal((await worker.fetch(post(null, { raw: '[1,2]' }), env)).status, 400);
  assert.equal((await worker.fetch(post(null, { raw: 'not json' }), env)).status, 400);
  assert.equal(env.LEADS_DB.rows.length, 0);
});

test('header injection: control characters never reach a mail header', async () => {
  const env = envOf();
  const ctx = ctxOf();
  await worker.fetch(post({ ...BODY, email: 'ada@example.org\r\nBcc: x@evil.example' }), env, ctx);
  await ctx.settle();
  const raw = env.LEAD_MAIL.sent[0].raw;
  const headers = raw.split('\r\n\r\n')[0];
  assert.doesNotMatch(headers, /^Bcc:/m);
});

test('other /api paths 404', async () => {
  const env = envOf({});
  assert.equal((await worker.fetch(new Request('https://lumen8.ai/api/nope'), env)).status, 404);
});

test('the organisation field lands in the company column', async () => {
  const env = envOf({});
  const res = await worker.fetch(post({ kind: 'study', name: 'Ada', email: 'ada@example.org', organisation: 'Rural Agency', message: 'two districts' }), env);
  assert.equal(res.status, 200);
  assert.equal(env.LEADS_DB.rows.at(-1).company, 'Rural Agency');
});

test('the schema is valid SQL-shaped text with the columns the insert uses', () => {
  const create = LEADS_SCHEMA[0];
  for (const c of ['id', 'created_at', 'source_page', 'consent_version', 'consent_given', 'ip_hash', 'notified_at', 'notified_to', 'notify_error']) {
    assert.match(create, new RegExp(`\\b${c}\\b`));
  }
  assert.doesNotMatch(create, /\bip\s+TEXT/);
});

test('pages pass through to the origin with security headers; CSP only on HTML', async () => {
  const html = await worker.fetch(new Request('https://lumen8.ai/studies.html'),
    { UPSTREAM: async () => new Response('<html></html>', { headers: { 'content-type': 'text/html; charset=utf-8' } }) });
  assert.equal(await html.text(), '<html></html>');
  assert.equal(html.headers.get('content-security-policy'), CSP);
  assert.equal(html.headers.get('x-content-type-options'), 'nosniff');
  assert.match(CSP, /frame-ancestors 'none'/);
  assert.match(CSP, /https:\/\/fonts\.googleapis\.com/);
  const css = await page(new Request('https://lumen8.ai/site.css'), async () => new Response('a{}', { headers: { 'content-type': 'text/css' } }));
  assert.equal(css.headers.get('content-security-policy'), null);
  assert.equal(css.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
});
