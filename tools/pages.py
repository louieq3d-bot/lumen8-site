#!/usr/bin/env python3
"""Build lumen8.ai's legal pages and the feasibility-study offer page from one renderer (CORE-11, ESS-LEG-01..06,
L8-L-05, L8-KW-02).

Why a generator: the site is plain static HTML on GitHub Pages, and seven pages must share the same header, footer,
seller block and update date. The site chrome (header, mobile menu, footer) is copied from rural-electrification.html
at build time, so a nav change there flows into these pages on the next run.

Seller details are NOT invented. The Hong Kong company that will sell every EMPIRE brand is not registered yet
(owner decision D12, 2026-11-20), so every field that depends on it renders as a visible
"[pending registration: ...]" marker, the same convention HelioField uses. Fill OPERATOR below once the company
exists and re-run: `python tools/pages.py`. tools/check.py fails while any marker is left only if
`--require-seller` is passed (used at launch, not before).

Run from the repo root: python tools/pages.py
"""
from __future__ import annotations

import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UPDATED = "27 November 2026"
UPDATED_ISO = "2026-11-27"


def pending(what: str) -> str:
    return f'<span class="pending">[pending registration: {what}]</span>'


# Fill these once the Hong Kong company is registered (D12). None renders a pending marker.
OPERATOR = {
    "name": None,              # registered company name
    "register": None,          # e.g. Hong Kong Companies Registry
    "number": None,            # company number
    "br": None,                # business registration number
    "address": None,           # registered office = postal address
    "director": None,          # director who represents the company
    "law": None,               # governing law (counsel to confirm, D8)
    "courts": None,            # competent courts / arbitration seat
}


def op(key: str, what: str) -> str:
    v = OPERATOR.get(key)
    return html.escape(v) if v else pending(what)


SELLER = (f"{op('name', 'registered company name')}, registered with {op('register', 'company register')} under number "
          f"{op('number', 'company number')}, registered office {op('address', 'registered office and postal address')}, "
          "trading as Lumen8")

# --------------------------------------------------------------------------------------------------------- chrome
SRC = (ROOT / "rural-electrification.html").read_text(encoding="utf-8")


def _between(text: str, start: str, end: str) -> str:
    i = text.index(start)
    j = text.index(end, i)
    return text[i:j]


HEAD_FONTS = _between(SRC, '<link rel="icon" href="/favicon.ico"', '<script type="application/ld+json">')
CHROME_TOP = _between(SRC, '<div class="progress"></div>', '<main>')
CHROME_TOP = CHROME_TOP.replace(' class="active"', '').replace('href="#contact"', 'href="/studies.html#request"')
CHROME_TOP = CHROME_TOP.replace('<span>Request access</span>', '<span>Request a study</span>')
CHROME_TOP = CHROME_TOP.replace('>Request access</a>', '>Request a study</a>')
FOOTER = _between(SRC, '<footer>', '</footer>') + '</footer>'
PH = re.search(r'<script src="/assets/posthog-consent.js"[^>]*></script>', SRC).group(0)
PH = re.sub(r'data-ph-privacy="[^"]*"', 'data-ph-privacy="/privacy.html"', PH)

LEGAL_NAV = [("legal.html", "Overview"), ("terms.html", "Terms"), ("privacy.html", "Privacy"), ("dpa.html", "DPA"),
             ("subprocessors.html", "Subprocessors"), ("refunds.html", "Cancellation and refunds"),
             ("imprint.html", "Legal notice")]


def render(slug: str, title: str, description: str, h1: str, lead: str, body: str, *, legal: bool = True,
           extra_ld: list | None = None, scripts: str = "") -> str:
    url = f"https://lumen8.ai/{slug}"
    nav = ""
    if legal:
        nav = '<nav class="doc-nav" aria-label="Legal">' + "".join(
            f'<a href="/{s}"{" aria-current=\"page\"" if s == slug else ""}>{n}</a>' for s, n in LEGAL_NAV) + "</nav>"
    graph = [{"@type": "WebPage", "@id": f"{url}#webpage", "url": url, "name": title, "description": description,
              "isPartOf": {"@id": "https://lumen8.ai/#website"}, "inLanguage": "en", "dateModified": UPDATED_ISO},
             {"@type": "BreadcrumbList", "@id": f"{url}#breadcrumb", "itemListElement": [
                 {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://lumen8.ai/"},
                 {"@type": "ListItem", "position": 2, "name": h1, "item": url}]}] + (extra_ld or [])
    t = html.escape(title)
    d = html.escape(description)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{t}</title>
<meta name="description" content="{d}">
<link rel="canonical" href="{url}">
<meta name="robots" content="index,follow">
<meta property="og:title" content="{t}">
<meta property="og:description" content="{d}">
<meta property="og:type" content="website">
<meta property="og:url" content="{url}">
<meta property="og:site_name" content="Lumen8">
<meta property="og:image" content="https://lumen8.ai/assets/og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#04060c">
<script>(function(){{try{{if(localStorage.getItem('l8-theme')==='light'){{document.documentElement.setAttribute('data-theme','light');document.querySelector('meta[name="theme-color"]').setAttribute('content','#fbfcfe')}}}}catch(e){{}}}})()</script>
{HEAD_FONTS}<script type="application/ld+json">{json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False)}</script>
</head>
<body class="doc-page">
<!-- generated by tools/pages.py; edit there, not here -->
{CHROME_TOP}<main>
<section class="section tight doc">
  <div class="wrap">
    <span class="eyebrow">{'Legal' if legal else 'Feasibility studies'}</span>
    <h1 class="h-l">{html.escape(h1)}</h1>
    <p class="lead">{lead}</p>
    <p class="doc-updated">Updated {UPDATED}</p>
    {nav}
    <div class="doc-body">
{body}
    </div>
  </div>
</section>
</main>

{FOOTER}

{PH}
<script src="/site.js"></script>
{scripts}</body>
</html>
"""


def sec(n: int, title: str, inner: str) -> str:
    anchor = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return f'<h2 id="{anchor}">{n}. {html.escape(title)}</h2>\n{inner}\n'


CONTACT = '<a href="mailto:hello@lumen8.ai">hello@lumen8.ai</a>'
PRIV = CONTACT  # no separate privacy@ mailbox exists; hello@ lands in Mothership Mail

# ---------------------------------------------------------------------------------------------------------- pages
PAGES: dict[str, str] = {}

PAGES["legal.html"] = render(
    "legal.html", "Legal — Lumen8", "Terms, privacy notice, data processing addendum, subprocessors, cancellation "
    "and refunds, and the legal notice for Lumen8 studies, the platform and lumen8.ai.",
    "Legal", "The documents that govern Lumen8 feasibility studies, access to the Lumen8 platform and API, and this "
    "website.", f"""
<p>Lumen8 sells geospatial feasibility studies for clean power and energy access (rural electrification, mini-grids,
utility-scale solar and storage) and gives study customers and selected partners access to the Lumen8 platform at
app.lumen8.ai and the agent API at api.lumen8.ai. These pages apply to all of it.</p>
<ul class="doc-list">
<li><a href="/terms.html">Terms of service</a>: the agreement for studies, platform and API access, and the website.</li>
<li><a href="/privacy.html">Privacy notice</a>: what personal data we hold, why, for how long, and your rights.</li>
<li><a href="/dpa.html">Data processing addendum</a>: our commitments when we process personal data for you.</li>
<li><a href="/subprocessors.html">Subprocessors</a>: every outside service that touches your data, and where.</li>
<li><a href="/refunds.html">Cancellation and refunds</a>: how a study or a subscription is cancelled and what is refunded.</li>
<li><a href="/imprint.html">Legal notice</a>: who we are and how to reach us.</li>
</ul>
<p>The seller is {SELLER}. The company registration is in progress; its details appear here as soon as it is
registered. Questions: {CONTACT}.</p>
""")

PAGES["terms.html"] = render(
    "terms.html", "Terms of Service — Lumen8", "The agreement between your organisation and Lumen8 for "
    "feasibility studies, access to the Lumen8 platform and API, and the lumen8.ai website.",
    "Terms of service", "The agreement between your organisation and Lumen8 for studies, the platform at "
    "app.lumen8.ai, the API at api.lumen8.ai and this website.", f"""
<div class="doc-summary"><p><b>In short.</b></p><ul>
<li>Lumen8 is for professionals: governments, utilities, development-finance programmes, developers and their advisers.</li>
<li>Each study is defined by a statement of work (SOW) or order form, which wins over these terms where they differ.</li>
<li>Study results are planning and feasibility estimates. They are not a detailed engineering design, a bankable
independent engineer's report, a permit or a guarantee.</li>
<li>Your data stays yours. Our total liability is capped (section 11).</li></ul></div>
{sec(1, "Who these terms are between", f'''<p>These terms govern feasibility studies and related services (Studies), access to
the Lumen8 platform at app.lumen8.ai and the Lumen8 API at api.lumen8.ai (together the Platform), and the website at
lumen8.ai (all together, the Service). The Service is provided by {SELLER} (Lumen8, we, us). Formal notices go to that
address or to {CONTACT}.</p>
<p>By signing an order form or SOW, or by using the Service, you accept these terms on behalf of the organisation you
represent (you, the Customer). If you cannot bind that organisation, do not use the Service. The Service is built for
organisations, not consumers; where a law nevertheless treats you as a consumer, the protection it gives you applies and
nothing here limits it.</p>''')}
{sec(2, "Studies", '''<p>The scope, deliverables, inputs you provide, timeline, milestones, price and acceptance of each
Study are set out in its SOW or order form. We perform Studies with reasonable skill and care, using the methods and
data sources named in the deliverables.</p>
<p>Unless the SOW says otherwise, a deliverable is accepted when you approve it in writing or 10 working days after
delivery if you have not reported a material non-conformity with the SOW. We correct a non-conformity you report in
that window at no extra charge. Changes to scope are agreed in writing and may change price and timeline.</p>
<p>Timelines depend on you providing the inputs and access the SOW lists. Where an input arrives late or is
incomplete, the timeline moves accordingly.</p>''')}
{sec(3, "What results are, and what they are not", '''<p>Studies and Platform outputs are planning and feasibility
estimates built from models, public and licensed data, and the inputs and assumptions supplied. Every output names its
data sources and key assumptions.</p>
<p>They are not a detailed engineering design, an energy-yield guarantee, an independent engineer's or lender's
technical-adviser report, a permit, a grid-connection approval, an investment recommendation, or legal, tax or
financial advice. Before you build, finance, tender, connect to a grid or apply for a permit, have the design and the
figures checked by qualified people under local law and grid rules.</p>''')}
{sec(4, "Platform and API access", f'''<p>Access to the Platform is by arrangement: as part of a Study, as a pilot, or under
an order form. Credentials and API keys are personal to the organisation they are issued to; keep them secret and tell
us at once at {CONTACT} if one may have leaked, so we can revoke it. You are responsible for use made with your
credentials. API usage is logged per key; the log is the basis for any usage-based fees in your order form.</p>''')}
{sec(5, "Fees, invoices and payment", '''<p>Fees are set in the SOW or order form, in the currency it states, and exclude
VAT, sales tax and similar taxes, which are added where they apply. Studies are invoiced by milestone as the SOW sets
out. Invoices are payable within 30 days unless the order form says otherwise. Payment may be taken through our
reseller and merchant of record (for card and online payments, Paddle), in which case its buyer terms also apply to
the payment.</p>
<p>If an invoice is unpaid 14 days after a written reminder, we may pause work and Platform access until it is
settled. Cancellation and refunds are covered on the <a href="/refunds.html">cancellation and refunds</a> page.</p>''')}
{sec(6, "Acceptable use", '''<p>You may not resell or sublicense the Platform, scrape it or extract its data in bulk outside
the export and API features you were given, probe or bypass its security, rate limits or quotas, reverse engineer it,
use it to build a competing product, overload it, or use it to break any law or sanction.</p>''')}
{sec(7, "Your data", f'''<p>You own the site boundaries, files, measurements, demand data and other material you give us
(Customer Data). You give us the rights we need to host, process and back up Customer Data to deliver the Service to
you, and nothing more. Where Customer Data contains personal data, we process it as your processor under our
<a href="/dpa.html">data processing addendum</a>, which forms part of these terms. Our own use of personal data is
described in the <a href="/privacy.html">privacy notice</a>.</p>
<p>We keep Customer Data confidential. After a Study or your access ends, we keep Customer Data for 90 days so you can
ask for a copy, then delete it, except where the law requires us to keep it longer. We may use aggregated statistics
that identify no person, customer or site to run and improve the Service.</p>''')}
{sec(8, "Intellectual property", '''<p>The Platform, its software, models, data compilations and documentation, and the
Lumen8 name and marks, belong to us or our licensors. On full payment, you may use the Study deliverables for any
purpose of your organisation, including sharing them with lenders, partners, contractors and public authorities, keeping
the source credits and the assumptions they carry. Third-party data in a deliverable stays under its own licence. We
keep the right to reuse our general methods, tools and know-how.</p>''')}
{sec(9, "Confidentiality", '''<p>Each side keeps the other's non-public information confidential, uses it only for the
Service, and shares it only with people who need it and are bound by the same duty. This does not cover information
that is public, already known, independently developed, or that must be disclosed by law. A separate signed NDA, if
any, prevails.</p>''')}
{sec(10, "Warranties", '''<p>We perform the Service with reasonable skill and care. Apart from that, and to the extent the
law allows, the Service is provided without other warranties, express or implied, including fitness for a particular
purpose and the accuracy of results built on third-party data.</p>''')}
{sec(11, "Limitation of liability", '''<p>To the extent the law allows: neither side is liable for indirect or consequential
loss, or for lost profits, revenue, savings, financing, tariffs, subsidies, data or goodwill; and each side's total
liability arising from the Service in any 12 months is capped at the fees paid and payable for the Study or order form
the claim relates to in those 12 months. Nothing limits liability for fraud, wilful misconduct, death or personal
injury caused by negligence, your payment obligations, or anything else that cannot be limited by law.</p>''')}
{sec(12, "Suspension and termination", '''<p>Either side may end an order form or SOW by written notice if the other
materially breaches it and does not cure the breach within 30 days. We may suspend access at once where needed to stop
a security risk, unlawful use or a breach of section 6. Sections 7 to 11, 13 and accrued payment obligations survive
termination.</p>''')}
{sec(13, "Governing law and disputes", f'''<p>Governing law: {op('law', 'governing law')}. Competent courts:
{op('courts', 'competent courts')}. Before going to court, both sides first try in good faith for 30 days to settle a
dispute by talking. The United Nations Convention on Contracts for the International Sale of Goods does not apply.</p>''')}
{sec(14, "Changes to these terms", f'''<p>We may update these terms. We tell existing customers at least 30 days before a
material change applies to them; a change never applies to a Study already under a signed SOW. The date at the top
shows the current version. Questions: {CONTACT}.</p>''')}
""")

SUBPROCESSORS = [
    ("Cloudflare, Inc.", "Content delivery, DNS, TLS, bot protection, email routing for @lumen8.ai, the website form "
     "endpoint and its lead store (Workers, D1)", "Global edge; United States", "Website visitors, form submissions, "
     "email to @lumen8.ai"),
    ("GitHub, Inc. (Microsoft)", "Hosting of the static lumen8.ai website (GitHub Pages)", "United States",
     "Website visitors (IP address in server logs)"),
    ("Google LLC", "Web fonts loaded by the website", "United States", "Website visitors (IP address)"),
    ("Sendinblue SAS (Brevo)", "Sending transactional and service email from @lumen8.ai", "France (EU)",
     "Recipients' names and email addresses, message content"),
    ("PostHog Inc. (EU Cloud)", "Website and product analytics: anonymous page views, and linked visits only after you "
     "consent", "Germany (EU)", "Usage events (no IP address kept)"),
    ("MapTiler AG", "Base maps in the platform", "Switzerland", "Platform users (IP address, map tile requests)"),
    ("Anthropic, PBC", "AI assistant inside the platform, when a user chooses to use it", "United States",
     "Prompts and context the user sends to the assistant"),
    ("OpenAI, L.L.C.", "AI assistant and speech features inside the platform, when a user chooses to use them",
     "United States", "Prompts, context and audio the user sends to the assistant"),
]

sub_rows = "\n".join(
    f"<tr><td>{html.escape(a)}</td><td>{html.escape(b)}</td><td>{html.escape(c)}</td><td>{html.escape(d)}</td></tr>"
    for a, b, c, d in SUBPROCESSORS)

PAGES["subprocessors.html"] = render(
    "subprocessors.html", "Subprocessors — Lumen8", "Every outside service that processes personal data for "
    "Lumen8, what it does, and where.", "Subprocessors", "Every outside service that processes personal data for "
    "Lumen8, what it does, and where.", f"""
<p>The platform (app.lumen8.ai), the API (api.lumen8.ai), study files and their backups run on servers we operate
ourselves in the Netherlands (EU); no hosting provider has access to them. The services below process personal data on
our behalf. Transfers outside the EU and the United Kingdom rely on the European Commission's adequacy decisions
(including the EU-US Data Privacy Framework where the provider is certified) or on the Standard Contractual Clauses.</p>
<div class="doc-table"><table>
<thead><tr><th>Provider</th><th>Purpose</th><th>Location</th><th>Data</th></tr></thead>
<tbody>
{sub_rows}
</tbody></table></div>
<p>Customers under our <a href="/dpa.html">data processing addendum</a> are told at least 30 days before we add or replace a
subprocessor, and may object on reasonable data-protection grounds. To be told, write to {PRIV}.</p>
""")

PAGES["privacy.html"] = render(
    "privacy.html", "Privacy Notice — Lumen8", "What personal data Lumen8 holds about website visitors, "
    "enquirers, study customers and platform users, why, for how long, who processes it, and your rights.",
    "Privacy notice", "What personal data we hold, why, for how long, who helps us process it, and your rights.", f"""
{sec(1, "Who is responsible", f'''<p>The controller of the personal data described here is {SELLER}. Contact for anything
about your data: {PRIV} (or {CONTACT}). Where we process personal data inside Customer Data on a customer's
instructions, that customer is the controller and we are its processor under the <a href="/dpa.html">DPA</a>.</p>''')}
{sec(2, "What we collect, why, and on what basis", '''<div class="doc-table"><table>
<thead><tr><th>When</th><th>What</th><th>Why</th><th>Legal basis</th><th>How long</th></tr></thead><tbody>
<tr><td>You visit lumen8.ai</td><td>IP address, browser and page requested, in the logs of our hosting and delivery
providers</td><td>Deliver and protect the site</td><td>Legitimate interest</td><td>Provider log periods, at most 30 days</td></tr>
<tr><td>You browse lumen8.ai</td><td>Anonymous page views (PostHog EU) with no cookie, no browser storage and no IP
address kept. Nothing is counted when your browser sends Do Not Track or Global Privacy Control.</td><td>Know which pages
help visitors</td><td>Legitimate interest</td><td>12 months</td></tr>
<tr><td>You accept analytics</td><td>The same events, linked across your visits through a PostHog cookie and browser
storage. You can change your choice at any time under "Cookie settings" in the footer.</td><td>Understand how visitors
use the site over time</td><td>Consent</td><td>12 months</td></tr>
<tr><td>You request a study or write to us</td><td>Name, work email, organisation, country, your message, how you heard
about us, the campaign tags of your visit</td><td>Answer you and prepare a proposal</td><td>Steps before a contract;
legitimate interest</td><td>24 months after our last exchange, unless it becomes a customer record</td></tr>
<tr><td>You are a customer or user</td><td>Contact details of your team, platform credentials, API keys (stored hashed
where possible), usage logs, support messages, invoices</td><td>Deliver the Study and the Platform, bill, support,
secure the service</td><td>Contract; legal obligation (invoices)</td><td>The contract plus 90 days; invoices as long as
tax law requires</td></tr>
</tbody></table></div>
<p>We do not sell personal data, use it for advertising profiles, or make decisions about you by automated means that
have legal or similarly significant effects.</p>''')}
{sec(3, "Who receives it", '''<p>Only the providers listed on the <a href="/subprocessors.html">subprocessors</a> page,
under contracts that bind them to our instructions; professional advisers and authorities where the law requires it;
and a buyer of our business, under the same protections, if that ever happens.</p>''')}
{sec(4, "Transfers outside the EU", '''<p>Some providers are in the United States or Switzerland. We rely on the European
Commission's adequacy decisions (including the EU-US Data Privacy Framework where the provider is certified) or on the
Standard Contractual Clauses, as listed per provider on the subprocessors page.</p>''')}
{sec(5, "Security", '''<p>Encryption in transit everywhere (HTTPS with HSTS), access limited to the people who need it,
encrypted backups held on separate machines, and per-organisation API keys that we can revoke at once.</p>''')}
{sec(6, "Your rights", f'''<p>You may ask for access to, correction of, deletion of, or a copy of your personal data, ask us
to restrict or stop processing it, and withdraw consent at any time (without affecting what was done before). Write to
{PRIV}; we answer within one month. You may also complain to a data protection authority, for example the one where you
live or work.</p>''')}
{sec(7, "Cookies", '''<p>lumen8.ai sets no cookie and stores nothing in your browser until you accept analytics in the consent banner;
before that, only anonymous page views are counted, as described above.
The platform at app.lumen8.ai uses only the cookies and browser storage it needs to keep you signed in and remember your
settings, and analytics only after consent.</p>''')}
{sec(8, "Changes", f'''<p>We update this notice when our processing changes; the date at the top shows the current
version. Material changes are announced to customers by email.</p>''')}
""")

PAGES["dpa.html"] = render(
    "dpa.html", "Data Processing Addendum — Lumen8", "Lumen8's commitments when it processes personal data on a "
    "customer's behalf during a study or on the platform (GDPR Article 28).", "Data processing addendum",
    "Our commitments when we process personal data for you during a Study or on the Platform. It forms part of the "
    "terms of service; a countersigned copy is available on request.", f"""
{sec(1, "Roles and scope", '''<p>You are the controller and we are the processor of personal data contained in Customer
Data (for example names of village contacts, household survey answers, staff contact lists, meter data linked to a
person). This addendum applies to that data only, for as long as we process it, and meets Article 28 of the GDPR and the
UK GDPR.</p>''')}
{sec(2, "Instructions", '''<p>We process the personal data only to deliver the Service under your SOW, order form and these
terms, which are your documented instructions, unless the law requires otherwise (in which case we tell you first where
the law allows). We tell you if we think an instruction breaks data-protection law.</p>''')}
{sec(3, "Confidentiality and security", '''<p>Everyone who can access the data is bound to confidentiality. We keep
technical and organisational measures appropriate to the risk: encryption in transit, encrypted backups on separate
machines, least-privilege access, logged administrative access, revocable per-organisation credentials, and tested
restores.</p>''')}
{sec(4, "Subprocessors", f'''<p>You authorise the subprocessors listed on the <a href="/subprocessors.html">subprocessors</a>
page. We bind each one by contract to terms that protect the data at least as well as this addendum, stay responsible
for them, and tell you at least 30 days before adding or replacing one; you may object on reasonable grounds, and if we
cannot resolve the objection either side may end the affected service.</p>''')}
{sec(5, "Assistance", '''<p>We help you, taking into account the nature of the processing, to answer data-subject requests,
to secure the data, and with impact assessments and consultations with authorities.</p>''')}
{sec(6, "Personal data breaches", '''<p>We tell you without undue delay, and in any case within 48 hours of becoming aware,
of a breach affecting your personal data, with what we know, and keep you updated.</p>''')}
{sec(7, "Transfers", '''<p>We transfer personal data outside the EU/EEA only under an adequacy decision or the Standard
Contractual Clauses, as listed per subprocessor.</p>''')}
{sec(8, "Deletion and return", '''<p>When the service ends we return the personal data on request and delete it within 90
days, including from backups as they rotate, unless the law requires us to keep it.</p>''')}
{sec(9, "Audits", f'''<p>We make available the information needed to show compliance with this addendum and allow for and
contribute to audits by you or an auditor you appoint, on reasonable notice, at most once a year unless a breach or an
authority requires it. Requests: {PRIV}.</p>''')}
""")

PAGES["refunds.html"] = render(
    "refunds.html", "Cancellation and Refunds — Lumen8", "How a Lumen8 feasibility study, platform access or "
    "API plan is cancelled, and what is refunded.", "Cancellation and refunds",
    "How a Study, Platform access or an API plan is cancelled, and what is refunded.", f"""
{sec(1, "Studies", '''<p>You may cancel a Study at any time by written notice. You pay for the milestones delivered and
for work done on the current milestone up to the notice, as the SOW sets out; any amount you prepaid for work not yet
done is refunded within 30 days. If we cancel a Study for reasons that are not yours, we refund everything you paid for
work not delivered.</p>''')}
{sec(2, "Platform access and API plans", '''<p>A plan under an order form runs for the term it states and can be cancelled
for the end of that term. Where a plan is billed monthly, you may cancel at any time and access runs to the end of the
month already paid. We do not refund part-used periods unless the law requires it or we end the service early, in which
case we refund the unused part.</p>''')}
{sec(3, "Payments through our merchant of record", '''<p>When you pay online, our reseller and merchant of record (Paddle)
processes the payment and any refund, and its buyer terms apply to the payment. Refunds go back to the original payment
method.</p>''')}
{sec(4, "How to ask", f'''<p>Write to {CONTACT} with the invoice or order number. We confirm within 2 working days.</p>''')}
""")

PAGES["imprint.html"] = render(
    "imprint.html", "Legal Notice (Impressum) — Lumen8", "Who provides lumen8.ai, Lumen8 studies and the Lumen8 "
    "platform, and how to reach us.", "Legal notice", "Who provides this website, Lumen8 studies and the Lumen8 "
    "platform, and how to reach us. This page is the Impressum and mentions légales for lumen8.ai.", f"""
{sec(1, "Provider", f'''<div class="doc-table"><table><tbody>
<tr><th>Service</th><td>Lumen8 feasibility studies, the Lumen8 platform (app.lumen8.ai), the Lumen8 API (api.lumen8.ai) and
lumen8.ai</td></tr>
<tr><th>Trading name</th><td>Lumen8</td></tr>
<tr><th>Company</th><td>{op('name', 'registered company name')}</td></tr>
<tr><th>Registered office and postal address</th><td>{op('address', 'registered office and postal address')}</td></tr>
<tr><th>Register</th><td>{op('register', 'company register')}, number {op('number', 'company number')}</td></tr>
<tr><th>Business registration / tax number</th><td>{op('br', 'business registration number')}</td></tr>
<tr><th>Represented by</th><td>{op('director', 'director who represents the company')}</td></tr>
<tr><th>Email</th><td>{CONTACT}</td></tr>
<tr><th>Responsible for content</th><td>{op('director', 'director who represents the company')}, at the address above</td></tr>
</tbody></table></div>''')}
{sec(2, "Liability for content and links", '''<p>We take care with the content of these pages but cannot guarantee that it
is complete, correct or current. Figures on this site are illustrations, not study results. We are not responsible for
the content of external websites we link to; when we learn that a linked page breaks the law, we remove the link.</p>''')}
{sec(3, "Copyright", '''<p>The texts, images, software and design of this website are protected by copyright. Map and data
credits appear where the data is shown.</p>''')}
{sec(4, "Dispute resolution", '''<p>Lumen8 is offered to organisations. We are not obliged and not willing to take part in
dispute settlement proceedings before a consumer arbitration board.</p>''')}
""")

# ------------------------------------------------------------------------------------------------- study offer page
FAQ = [
    ("What does a Lumen8 feasibility study cost?",
     "Each study is priced per site or per programme after a short scoping call, because a single 50 MW solar site "
     "and a 300-village electrification plan are different jobs. You get a fixed price and a milestone schedule in "
     "the statement of work before anything starts."),
    ("How long does a study take?",
     "A pre-feasibility screen of one site or one district takes about two to three weeks from receiving the inputs. "
     "A full feasibility study with design, yield, cost and finance takes about four to eight weeks. The statement of "
     "work fixes the dates."),
    ("What do you need from us?",
     "The site boundary or the area of interest (KMZ, shapefile or coordinates), what you already know about demand "
     "and the grid, any tariff and financing assumptions you must use, and a contact who can answer questions. We "
     "fill the rest from satellite, weather, grid and census data and say where each input came from."),
    ("Is the study bankable?",
     "A Lumen8 study is a planning and feasibility study that names its data sources, assumptions and uncertainty. "
     "Lenders usually still appoint their own independent engineer for financial close; our deliverables are built so "
     "that engineer can check every number."),
    ("Who owns the results?",
     "You do. Once paid, you may use the deliverables for any purpose of your organisation and share them with "
     "lenders, partners, contractors and authorities."),
    ("Can we use the platform ourselves?",
     "Yes. Study customers get access to the Lumen8 platform for their study area during the study, and the agent API "
     "is available to teams that want to run the engine from their own tools."),
]
faq_html = "\n".join(f"<details><summary>{html.escape(q)}<i></i></summary><p>{html.escape(a)}</p></details>"
                     for q, a in FAQ)
faq_ld = {"@type": "FAQPage", "@id": "https://lumen8.ai/studies.html#faq", "mainEntity": [
    {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in FAQ]}
svc_ld = {"@type": "Service", "@id": "https://lumen8.ai/studies.html#service",
          "name": "Solar, mini-grid and rural electrification feasibility studies",
          "serviceType": "Feasibility study", "provider": {"@id": "https://lumen8.ai/#organization"},
          "areaServed": "Worldwide", "url": "https://lumen8.ai/studies.html"}

HEARD = [("", "Choose one (optional)"), ("search", "Search engine"), ("ai", "AI assistant"), ("linkedin", "LinkedIn"),
         ("referral", "A colleague or partner"), ("event", "Event or conference"), ("press", "Article or press"),
         ("other", "Other")]
heard_opts = "".join(f'<option value="{v}">{html.escape(n)}</option>' for v, n in HEARD)

PAGES["studies.html"] = render(
    "studies.html", "Solar and Mini-Grid Feasibility Studies — Lumen8",
    "Geospatial feasibility studies for utility-scale solar and storage, mini-grids and rural electrification: "
    "scope, deliverables, timeline and how to request one.", "Feasibility studies",
    "Pre-feasibility and feasibility studies for utility-scale solar and storage, mini-grids and rural "
    "electrification programmes, built on the Lumen8 engine and delivered by people who answer your questions.", f"""
<h2 id="offer">What you get</h2>
<div class="doc-table"><table>
<thead><tr><th></th><th>Pre-feasibility screen</th><th>Feasibility study</th><th>Programme plan</th></tr></thead>
<tbody>
<tr><th>For</th><td>One site or one district, to decide whether to go further</td><td>One site or a cluster you intend to
build</td><td>A country, province or funding programme: which villages, in what order, with what</td></tr>
<tr><th>Deliverables</th><td>Resource and constraint screen, indicative layout and size, yield range, cost and tariff
range, red flags, a short report</td><td>Layout and electrical concept, 8,760-hour energy model with losses, storage
sizing, grid-connection or mini-grid concept, CAPEX and OPEX build-up, LCOE, financial model with funding stack,
risk register, report and data files</td><td>Every unelectrified settlement screened and ranked, least-cost option per
settlement (grid, mini-grid, standalone), phased build order, investment plan, map files and dashboard access</td></tr>
<tr><th>Typical time</th><td>2 to 3 weeks</td><td>4 to 8 weeks</td><td>6 to 12 weeks</td></tr>
<tr><th>Price</th><td colspan="3">Fixed price per study, set in the statement of work after a scoping call. Billed by
milestone.</td></tr>
</tbody></table></div>
<h2 id="how">How it works</h2>
<ol class="doc-list">
<li><b>Scoping call</b> (30 minutes): your sites, your decision, the inputs you have.</li>
<li><b>Statement of work</b>: scope, deliverables, dates, milestones and a fixed price, for you to sign.</li>
<li><b>Study</b>: the engine runs, an analyst checks and explains every result; you see interim results on the
platform.</li>
<li><b>Delivery and review</b>: report, data files and a walk-through; corrections within the acceptance window.</li>
</ol>
<p>Every study names its data sources and assumptions and is governed by the <a href="/terms.html">terms of
service</a> and the statement of work.</p>
<h2 id="request">Request a study</h2>
<form class="lead-form" id="lead-form" data-kind="study" novalidate>
  <label>Your name<input name="name" autocomplete="name" required maxlength="120"></label>
  <label>Work email<input name="email" type="email" autocomplete="email" required maxlength="200"></label>
  <label>Organisation<input name="organisation" autocomplete="organization" required maxlength="160"></label>
  <label>Sites or area, and what you need to decide<textarea name="message" rows="4" required maxlength="2000"></textarea></label>
  <label>How did you hear about us?<select name="heard">{heard_opts}</select></label>
  <input type="text" name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
  <p class="form-note">We use these details only to answer you and prepare a proposal; see the
  <a href="/privacy.html">privacy notice</a>.</p>
  <button class="btn primary" type="submit"><span>Request a study</span></button>
  <p class="form-status" role="status" aria-live="polite"></p>
</form>
<p>Prefer email? Write to <a href="mailto:sales@lumen8.ai?subject=Feasibility%20study">sales@lumen8.ai</a>.</p>
<h2 id="faq">Questions</h2>
<div class="faq">
{faq_html}
</div>
""", legal=False, extra_ld=[faq_ld, svc_ld], scripts='<script src="/lead-form.js" defer></script>\n')


def main() -> None:
    for name, text in PAGES.items():
        (ROOT / name).write_text(text, encoding="utf-8", newline="\n")
        print("wrote", name)


if __name__ == "__main__":
    main()
