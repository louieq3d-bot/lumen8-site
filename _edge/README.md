# lumen8.ai edge Worker

`worker.js` answers `POST /api/lead` (the Request a study form on `/studies.html`). It runs only on the zone route
`lumen8.ai/api/*`; every page stays on GitHub Pages. Tests: `node --test _edge/worker.test.mjs`.

One-time setup (done 2026-11-27): `npx wrangler d1 create lumen8-leads` and put its id in `wrangler.jsonc`.
`sales@lumen8.ai` must be a verified destination address in Email Routing for the mail leg; until it is, leads are
stored in D1 and mailed to the fallback address. Optional: `npx wrangler secret put LEAD_IP_SALT`.

Deploy: `bash tools/deploy.sh edge` (runs the gate first). Read leads:
`npx wrangler d1 execute lumen8-leads --remote --command "SELECT created_at,kind,email,company,notified_to,notify_error FROM leads ORDER BY created_at DESC LIMIT 20"`.
