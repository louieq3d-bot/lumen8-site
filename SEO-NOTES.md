# SEO notes (on-page pass, 2026-11-08)

## What changed
- Titles (54-63 chars, brand + intent) and meta descriptions (135-158 chars) rewritten and unique on index, modules, utility-scale, rural-electrification. OG/Twitter titles follow.
- Added on all four public pages: absolute `rel=canonical`, `robots` (index,follow,max-image-preview:large), `og:site_name`, `og:locale`, `og:image:width/height/alt`, `twitter:title/description/image`.
- JSON-LD (`@graph`) per page: WebPage + BreadcrumbList; Organization (logo, hello@lumen8.ai contactPoint) + WebSite on the home page; Service on utility-scale and rural-electrification (no prices, ratings or addresses). `sameAs` omitted: no real social accounts exist in the repo.
- Brand logo images (loader, header, footer) got width/height attributes (CSS already sets `width:auto`, so no visual change).
- sitemap.xml: lastmod refreshed to 2026-11-08, absolute URLs, 4 indexable pages.
- No visible copy, headings or claims were changed.

## Verified, left as is
- lang="en", one h1 per page, all `<img>` have alt (decorative ones `alt=""`), below-fold images already lazy, favicon/apple-touch-icon present, og.png exists (1200x630), preconnect for Google Fonts already present, no 404 in local links, every page linked from all pages.
- investors.html is intentionally `noindex` and Disallowed in robots.txt (not in sitemap). Note: a Disallow stops Google from seeing the noindex; the URL could still appear bare if linked externally. Remove the Disallow for /investors.html if you want a strict noindex.
- Scripts already sit at the end of `<body>`, so `defer` would add little and risks load-order breakage; not changed.

## Open items (not fixed)
- Copy inconsistency: home ticker says "16 modules", copy elsewhere says "Fourteen" (also in og/meta). Needs an owner decision.
- Heading levels skip (h2 to h4/h5 in footer and cards; rural-electrification has h3s directly after the h1). Cosmetic-class styled, left to avoid design change.
- Nothing is crawlable behind the single-page JS "module" views: modules are anchors (#wind, #hydro...) on modules.html, not separate URLs.
- Google Fonts CSS is render-blocking; self-hosting fonts would help LCP.

## Keyword map
| Intent | Target page | Status |
|---|---|---|
| AI platform for clean energy / sustainable development | / | covered |
| solar and storage plant design software, utility-scale solar feasibility | /utility-scale.html | covered |
| rural electrification planning, village electrification software | /rural-electrification.html | covered |
| mini-grid design software / village mini-grid | /rural-electrification.html, /modules.html | partial (no dedicated page) |
| wind farm siting software, turbine selection | /modules.html#wind | gap: needs own page |
| run-of-river hydropower / geothermal screening tool | /modules.html#hydro, #geothermal | gap: needs own pages |
| agrivoltaics / precision agriculture, aquaculture, hydroponics design | /modules.html | gap |
| carbon accounting / impact verification for energy projects (SDG ledger) | /modules.html | gap |
| solar for telecom towers / port shore power / supply-chain costing | /modules.html | gap |
| bankable project finance for solar in emerging markets | none | gap |

## Content gaps to write later
Dedicated pages for: mini-grids, wind, hydro, geothermal, agriculture/aquaculture/hydroponics, telecom towers, ports/shore power, carbon & impact verification, project finance; plus an About/contact page, a blog or case studies, and FAQ content (the FAQ on the pages could also get FAQPage markup if kept visible).
