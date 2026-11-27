/**
 * lumen8.ai edge Worker (lumen8-site-edge): POST /api/lead for the "Request a study" form on /studies.html (L8-L-17).
 *
 * lumen8.ai itself is static on GitHub Pages behind Cloudflare. This Worker runs ONLY on the zone route
 * lumen8.ai/api/* (wrangler.jsonc), so every page still comes from GitHub Pages untouched.
 * Forked from heliofield.io's site Worker (businesses/heliofield/site/worker.js), same guards and behaviour:
 *   1. store: one row in the D1 table `leads` (binding LEADS_DB, database lumen8-leads; created on first use);
 *   2. notify: mailed through Cloudflare Email Routing from leads@lumen8.ai to LEAD_TO (sales@lumen8.ai, which lands
 *      in Mothership Mail and so in the cockpit's Comms), falling back to LEAD_TO_FALLBACK, Reply-To the visitor.
 * Once stored the visitor gets 200 whatever the mail does; only an unstored AND unmailed lead answers 502, and the form
 * (lead-form.js) then points the visitor at sales@lumen8.ai.
 * Guards: same origin (lumen8.ai, www), 8 KB JSON object, 30 fields x 2,000 chars, known kind, honeypot `website`,
 * 5 a minute per IP (LEAD_RL), LEAD_HOURLY_MAX stored per hour per salted IP hash (IPv6 /64), 24-month retention.
 */
import { EmailMessage } from 'cloudflare:email';

const ORIGINS = new Set(['https://lumen8.ai', 'https://www.lumen8.ai']);
const SUBJECT = { study: 'Lumen8 website: study request', contact: 'Lumen8 website: enquiry' };
const FROM = 'leads@lumen8.ai';
const EMAIL = /^[^@\s<>"',;()\\[\]]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,63}$/;
/** Hidden form field humans leave empty (add `<input name="website" tabindex="-1" autocomplete="off" hidden>`). */
export const HONEYPOT = 'website';
/** Fields never stored or mailed as answers. */
const META_FIELDS = new Set([HONEYPOT]);
const HOURLY_MAX_DEFAULT = 10;

/** The leads table. Run once by the Worker (CREATE ... IF NOT EXISTS); also valid for `wrangler d1 execute`. */
export const LEADS_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  kind TEXT NOT NULL,
  email TEXT,
  name TEXT,
  company TEXT,
  country TEXT,
  role TEXT,
  fields_json TEXT NOT NULL,
  source_page TEXT,
  landing_page TEXT,
  referrer TEXT,
  utm TEXT,
  heard TEXT,
  consent_version TEXT,
  consent_given INTEGER,
  cf_country TEXT,
  ip_hash TEXT,
  notified_at TEXT,
  notified_to TEXT,
  notify_error TEXT
)`,
  'CREATE INDEX IF NOT EXISTS leads_ip_created ON leads (ip_hash, created_at)',
  'CREATE INDEX IF NOT EXISTS leads_created ON leads (created_at)',
];

const MAX_BYTES = 8192;
const RETAIN_MS = 730 * 86400e3;              // leads are kept up to 24 months (privacy page), then purged (F-10)

/** The rate-limit identity of a client address: IPv4 as is, IPv6 as its /64 (one subscriber holds a whole /64; F-10). */
export function rateSource(ip) {
  const s = String(ip || '').trim().toLowerCase();
  if (!s.includes(':')) return s;
  const m = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (m) return m[1];
  const [head, tail = null] = s.split('::');
  const h = head ? head.split(':') : [];
  const t = tail === null ? [] : (tail ? tail.split(':') : []);
  const fill = tail === null ? [] : Array(Math.max(0, 8 - h.length - t.length)).fill('0');
  const all = [...h, ...fill, ...t].map((x) => (x || '0').replace(/^0+(?=.)/, ''));
  return all.length >= 4 ? `${all.slice(0, 4).join(':')}::/64` : s;
}

/** Analytics-safe campaign tags: only utm_<name>=<token> pairs, nothing free-text (an address never passes; F-10). */
export function cleanUtm(s) {
  return String(s || '').replace(/^\?/, '').split('&')
    .map((p) => p.split('='))
    .filter(([k, v]) => /^utm_[a-z_]{1,20}$/.test(k || '') && /^[A-Za-z0-9._-]{0,60}$/.test(decodeSafe(v || '')))
    .map(([k, v]) => `${k}=${decodeSafe(v || '')}`).join('&').slice(0, 190);
}
function decodeSafe(v) { try { return decodeURIComponent(v); } catch { return '!'; } }
/** A referring site as a bare host name; a landing page as a bare path (no query, no fragment). */
const hostOnly = (s) => { const x = oneLine(s).toLowerCase().replace(/^https?:\/\//, '').split(/[/?#]/)[0]; return /^[a-z0-9.-]{1,120}$/.test(x) ? x : ''; };
const pathOnly = (s) => { const x = oneLine(s).split(/[?#]/)[0]; return /^\/[A-Za-z0-9/._~-]{0,119}$/.test(x) ? x : ''; };

let isolateSalt = null;
/** LEAD_IP_SALT, or a random per-isolate salt when it is missing (never the old public constant; F-10). */
function ipSalt(env) {
  const s = oneLine(env.LEAD_IP_SALT);
  if (s) return s;
  if (!isolateSalt) {
    console.error('LEAD_IP_SALT is not set: using a random per-isolate salt (the hourly cap then holds per isolate only)');
    isolateSalt = crypto.randomUUID();
  }
  return isolateSalt;
}

let lastPurge = 0;
/** Drop leads older than 24 months, at most once a day per isolate (F-10: the privacy page promises it). */
async function purgeOld(db) {
  if (Date.now() - lastPurge < 86400e3) return;
  lastPurge = Date.now();
  try {
    await db.prepare('DELETE FROM leads WHERE created_at < ?1').bind(new Date(Date.now() - RETAIN_MS).toISOString()).run();
  } catch (e) { console.error('lead purge failed', e && e.message); lastPurge = 0; }
}

const json = (status, obj, origin) => new Response(JSON.stringify(obj), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store',
    ...(origin ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {}) } });
const oneLine = (s) => String(s ?? '').replace(/[\x00-\x1f\x7f]+/g, ' ').trim();

/* One row per sent lead in Workers Analytics Engine (dataset "leads", binding LEADS), read by EMPIRE's funnel
   (docs/launch/MEASUREMENT.md in the mothership repo). No personal data: the host, the form kind, the answer to "How did
   you hear about us?", the visit's utm tags, referring site and landing page, and the country. */
const HEARD = new Set(['search', 'ai', 'linkedin', 'youtube', 'referral', 'event', 'press', 'other']);
function record(env, req, kind, body) {
  if (!env.LEADS) return;
  try {
    env.LEADS.writeDataPoint({ indexes: [new URL(req.url).hostname.replace(/^www\./, '')],
      blobs: [kind, HEARD.has(body.heard) ? body.heard : '', cleanUtm(body.src_utm), hostOnly(body.src_ref),
        pathOnly(body.src_landing), req.cf?.country || ''],
      doubles: [1] });
  } catch (e) { console.error('lead count failed', e && e.message); }
}

let schemaReady = null;
/** Create the table once per isolate; a failure is retried on the next request. */
function ensureSchema(db) {
  if (!schemaReady) {
    schemaReady = db.batch(LEADS_SCHEMA.map((s) => db.prepare(s))).catch((e) => { schemaReady = null; throw e; });
  }
  return schemaReady;
}
/** For tests: forget that the table exists. */
export function _resetSchemaCache() { schemaReady = null; lastPurge = 0; }

async function ipHash(ip, salt) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}|${ip}`));
  return [...new Uint8Array(buf)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Path of a same-site URL ('' when absent or from another site). */
function sitePath(u) {
  try { const x = new URL(u); return ORIGINS.has(x.origin) ? (x.pathname + x.search).slice(0, 300) : ''; } catch { return ''; }
}

function mailFor(to, lead, lines) {
  return [
    `From: Lumen8 website <${FROM}>`,
    `To: <${oneLine(to)}>`,
    lead.replyTo ? `Reply-To: <${lead.replyTo}>` : null,
    `Subject: ${SUBJECT[lead.kind]}`,
    `Message-ID: <${crypto.randomUUID()}@lumen8.ai>`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    lines.join('\r\n'),
  ].filter((x) => x !== null).join('\r\n');
}

/** Mail the lead to LEAD_TO, then LEAD_TO_FALLBACK. @returns {Promise<{ok:boolean, to?:string, error?:string}>} */
async function notify(env, lead, lines) {
  const targets = [...new Set([env.LEAD_TO, env.LEAD_TO_FALLBACK].map((x) => oneLine(x)).filter((x) => EMAIL.test(x)))];
  if (!env.LEAD_MAIL || !targets.length) return { ok: false, error: 'no mail binding or address' };
  const errors = [];
  for (const to of targets) {
    try {
      await env.LEAD_MAIL.send(new EmailMessage(FROM, to, mailFor(to, lead, lines)));
      return { ok: true, to, error: errors.join('; ') || null };
    } catch (e) {
      console.error('lead mail failed', to, e && e.message);
      errors.push(`${to}: ${oneLine(e && e.message).slice(0, 200)}`);
    }
  }
  return { ok: false, error: errors.join('; ') };
}

async function lead(req, env, ctx) {
  const origin = req.headers.get('origin') || '';
  if (!ORIGINS.has(origin)) return json(403, { ok: false, error: 'origin' });
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { 'access-control-allow-origin': origin,
      'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '600' } });
  }
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method' }, origin);
  const ip = req.headers.get('cf-connecting-ip') || 'unknown';
  if (env.LEAD_RL) {
    const { success } = await env.LEAD_RL.limit({ key: ip });
    if (!success) return json(429, { ok: false, error: 'rate' }, origin);
  }
  // F-14: the cap counts bytes, and a declared length over it is refused before the body is read
  if (Number(req.headers.get('content-length') || 0) > MAX_BYTES) return json(413, { ok: false, error: 'size' }, origin);
  const buf = await req.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) return json(413, { ok: false, error: 'size' }, origin);
  const text = new TextDecoder().decode(buf);
  let body;
  try { body = JSON.parse(text); } catch { return json(400, { ok: false, error: 'json' }, origin); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json(400, { ok: false, error: 'json' }, origin);
  const kind = String(body.kind || '');
  if (!Object.hasOwn(SUBJECT, kind)) return json(400, { ok: false, error: 'kind' }, origin);   // F-14: not "constructor"
  // honeypot: a bot filled the hidden field. Answer like a success so it does not retry; keep nothing.
  if (oneLine(body[HONEYPOT])) return json(200, { ok: true }, origin);
  const fields = Object.entries(body).filter(([k]) => k !== 'kind' && !META_FIELDS.has(k)).slice(0, 30)
    .map(([k, v]) => [oneLine(k).slice(0, 80), String(v ?? '').slice(0, 2000)]).filter(([, v]) => v.trim());
  if (!fields.length) return json(400, { ok: false, error: 'empty' }, origin);

  const get = (k, n = 200) => oneLine(body[k]).slice(0, n) || null;
  const now = new Date().toISOString();
  const replyTo = fields.map(([, v]) => oneLine(v)).find((v) => EMAIL.test(v)) || null;
  const referer = oneLine(req.headers.get('referer') || '');
  const consentGiven = body.consent === undefined ? null : (['1', 'true', 'on', 'yes'].includes(String(body.consent).toLowerCase()) ? 1 : 0);
  const L = {
    id: crypto.randomUUID(), created_at: now, kind, replyTo,
    // F-14: the email column only ever holds an address
    email: (EMAIL.test(get('email', 254) || '') ? get('email', 254) : null) || replyTo,
    name: get('name'), company: get('company') || get('organisation'), country: get('country', 80), role: get('role', 120),
    fields_json: JSON.stringify(Object.fromEntries(fields)),
    source_page: sitePath(referer) || get('page', 300) || null, landing_page: pathOnly(body.src_landing) || null,
    referrer: hostOnly(body.src_ref) || null, utm: cleanUtm(body.src_utm) || null, heard: HEARD.has(body.heard) ? body.heard : null,
    consent_version: get('consent_version', 80) || oneLine(env.CONSENT_VERSION) || null, consent_given: consentGiven,
    cf_country: oneLine(req.cf?.country || '') || null,
  };

  const lines = fields.map(([k, v]) => `${k}: ${v.replace(/\r?\n/g, '\r\n')}`);   // CRLF only, as RFC 5322 wants
  lines.push('', `Page: ${L.source_page || referer || '-'}`, `Country: ${L.cf_country || '-'}`,
    `Consent text version: ${L.consent_version || '-'}`, `Received: ${now}`, `Lead id: ${L.id}`);

  // 1. store
  let stored = false;
  const db = env.LEADS_DB;
  if (db) {
    try {
      await ensureSchema(db);
      const hash = await ipHash(rateSource(ip), ipSalt(env));          // F-10: the /64, never a public salt
      const max = Number(env.LEAD_HOURLY_MAX) > 0 ? Number(env.LEAD_HOURLY_MAX) : HOURLY_MAX_DEFAULT;
      const since = new Date(Date.now() - 3600e3).toISOString();
      const row = await db.prepare('SELECT COUNT(*) AS n FROM leads WHERE ip_hash = ?1 AND created_at > ?2').bind(hash, since).first();
      if (row && Number(row.n) >= max) return json(429, { ok: false, error: 'rate' }, origin);
      await db.prepare(`INSERT INTO leads (id, created_at, kind, email, name, company, country, role, fields_json, source_page, landing_page,
        referrer, utm, heard, consent_version, consent_given, cf_country, ip_hash) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)`)
        .bind(L.id, L.created_at, L.kind, L.email, L.name, L.company, L.country, L.role, L.fields_json, L.source_page, L.landing_page,
          L.referrer, L.utm, L.heard, L.consent_version, L.consent_given, L.cf_country, hash).run();
      stored = true;
      await purgeOld(db);
    } catch (e) {
      console.error('lead store failed', e && e.message);
    }
  } else {
    console.error('lead store skipped: no LEADS_DB binding');
  }
  if (!stored) lines.push('', 'NOTE: this lead could not be stored in the leads table; this mail is the only copy.');

  // 2. notify
  if (stored) {
    const done = notify(env, L, lines).then(async (r) => {
      try {
        await db.prepare('UPDATE leads SET notified_at = ?1, notified_to = ?2, notify_error = ?3 WHERE id = ?4')
          .bind(r.ok ? new Date().toISOString() : null, r.to || null, r.error || null, L.id).run();
      } catch (e) { console.error('lead notify status not saved', e && e.message); }
      return r;
    });
    if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(done); else await done;
    record(env, req, kind, body);
    return json(200, { ok: true }, origin);
  }
  const r = await notify(env, L, lines);
  if (!r.ok) return json(502, { ok: false, error: 'mail' }, origin);
  record(env, req, kind, body);
  return json(200, { ok: true }, origin);
}

/* Security headers for every lumen8.ai page (ESS-QA-02, L8-L-09 for the site): GitHub Pages cannot set response
   headers, so this Worker (route lumen8.ai/*) adds them on the way out. The CSP allows exactly what the pages load:
   Google Fonts, three.js from cdnjs, PostHog EU (loader + capture), Cloudflare's own beacon, and blob: for the
   investor room's decrypted documents. Inline scripts stay allowed (theme switch before first paint, JSON-LD). */
export const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://eu-assets.i.posthog.com https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://eu.i.posthog.com https://eu-assets.i.posthog.com https://cloudflareinsights.com",
  "media-src 'self' data: blob:",
  "frame-src 'self' blob:",
  "object-src 'self' blob:",
  "worker-src 'self' blob:",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ');
export const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'x-frame-options': 'DENY',
  'cross-origin-opener-policy': 'same-origin',
};

/** Pass a page request through to the origin (GitHub Pages) and add the security headers. */
export async function page(req, upstream = fetch) {
  const res = await upstream(req);
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) out.headers.set(k, v);
  if ((out.headers.get('content-type') || '').includes('text/html')) out.headers.set('content-security-policy', CSP);
  return out;
}

export default {
  async fetch(req, env, ctx) {
    const path = new URL(req.url).pathname;
    if (path === '/api/lead') return lead(req, env, ctx);
    if (path.startsWith('/api/')) return json(404, { ok: false, error: 'not found' });
    return page(req, env && env.UPSTREAM ? env.UPSTREAM : fetch);   // everything else: GitHub Pages + headers
  },
};
