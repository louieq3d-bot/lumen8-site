#!/usr/bin/env python3
"""Static checks for lumen8.ai, run by tools/deploy.sh before anything ships (CORE-27 local test gate).

Checks: every top-level page has a title, a description and a canonical that matches its own URL; every internal link
and asset resolves to a file in the repo; every sitemap URL exists; every public page links the legal set in its footer;
the legal pages never name Dutch law (owner rule, 2026-11-20); no retired or foreign brand name appears on a page
(ESS-QA-07); the generated pages are up to date with tools/pages.py. With --require-seller, any
"[pending registration: ...]" marker left on a page fails (use at launch, once the company is registered).

Run from the repo root: python tools/check.py [--require-seller]
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
PAGES = sorted(p for p in ROOT.glob("*.html"))
REDIRECT_STUBS = {"agrivoltaics.html"}  # noindex redirect stubs to heliofield.io
PRIVATE = {"investors.html"}  # gated investor room, disallowed in robots.txt: no canonical required
LEGAL = ["legal.html", "terms.html", "privacy.html", "dpa.html", "subprocessors.html", "refunds.html", "imprint.html"]
BANNED_BRANDS = re.compile(r"SonoAtlas|Deep Time|Ampowr|Helioflux", re.I)
DUTCH_LAW = re.compile(r"Dutch law|laws? of the Netherlands|Netherlands law|courts? (of|in) Amsterdam", re.I)

errors: list[str] = []


def err(msg: str) -> None:
    errors.append(msg)


def visible(text: str) -> str:
    text = re.sub(r"(?s)<(script|style)\b.*?</\1>", " ", text)
    text = re.sub(r"(?s)<!--.*?-->", " ", text)
    return re.sub(r"<[^>]+>", " ", text)


def resolves(href: str) -> bool:
    path = urlparse(href).path
    if not path or path == "/":
        return True
    target = ROOT / path.lstrip("/")
    return target.is_file() or (target / "index.html").is_file()


for page in PAGES:
    name = page.name
    s = page.read_text(encoding="utf-8")
    if name in REDIRECT_STUBS:
        continue
    if not re.search(r"<title>[^<]{10,}</title>", s):
        err(f"{name}: missing or short <title>")
    if not re.search(r'<meta name="description" content="[^"]{40,}"', s):
        err(f"{name}: missing meta description")
    want = "https://lumen8.ai/" + ("" if name == "index.html" else name)
    m = re.search(r'<link rel="canonical" href="([^"]+)"', s)
    if name not in PRIVATE and (not m or m.group(1) != want):
        err(f"{name}: canonical {m.group(1) if m else None!r} != {want!r}")
    for href in re.findall(r'(?:href|src)="(/[^"#]*)', s):
        if href.startswith("//"):
            continue
        if not resolves(href):
            err(f"{name}: broken internal link {href}")
    if name != "investors.html" and 'class="foot-legal"' not in s:
        err(f"{name}: footer lacks the legal links")
    v = visible(s)
    if BANNED_BRANDS.search(v):
        err(f"{name}: retired/foreign brand name on the page: {BANNED_BRANDS.search(v).group(0)}")
    if "--require-seller" in sys.argv and "[pending registration:" in v:
        err(f"{name}: seller details still pending")

for name in LEGAL + ["studies.html"]:
    p = ROOT / name
    if not p.is_file():
        err(f"{name}: missing")
        continue
    if DUTCH_LAW.search(visible(p.read_text(encoding="utf-8"))):
        err(f"{name}: names Dutch law")

sm = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
for loc in re.findall(r"<loc>([^<]+)</loc>", sm):
    if not resolves(urlparse(loc).path or "/"):
        err(f"sitemap: {loc} does not exist")
for name in LEGAL + ["studies.html"]:
    if f"https://lumen8.ai/{name}" not in sm:
        err(f"sitemap: {name} missing")
if not (ROOT / "llms.txt").is_file():
    err("llms.txt missing")

# generated pages must match their generator (someone edited the HTML instead of tools/pages.py)
before = {n: (ROOT / n).read_bytes() for n in LEGAL + ["studies.html"] if (ROOT / n).is_file()}
subprocess.run([sys.executable, str(ROOT / "tools" / "pages.py")], check=True, capture_output=True)
for n, b in before.items():
    if (ROOT / n).read_bytes() != b:
        err(f"{n}: out of date with tools/pages.py (re-run it and commit)")

if errors:
    print("check: FAIL")
    for e in errors:
        print("  -", e)
    sys.exit(1)
print(f"check: OK ({len(PAGES)} pages, {len(re.findall('<loc>', sm))} sitemap URLs)")
