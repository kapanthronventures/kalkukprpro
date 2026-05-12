# Finding Mainera — Virtual Gallery

A virtual gallery representing a curated roster of emerging contemporary
painters. Works are uploaded directly by the artists; auctions are run from
the studio.

This repository holds:

1. **A deployable static prototype** — every page, fully responsive, with
   schema.org markup, sitemap, robots, manifest and `llms.txt` ready for
   AI-search indexing. Open `index.html` to view.
2. **`ARCHITECTURE.md`** — the production engineering spec
   (Next.js 15 + Prisma + Postgres + NextAuth + Cloudinary + Stripe/Xendit)
   that the prototype maps cleanly onto.

```
.
├── index.html                       # Homepage — hero, spotlight, archive, roster
├── gallery.html                     # Archive · 12 works, filterable
├── artist.html                      # Roster · 5 painters
├── exhibitions.html                 # Solo / group / fair history
├── artwork/finding-mainera-i.html   # Detail page · zoom + bidding + comments
├── auth.html                        # Sign-in (collector / artist)
├── collector.html                   # Collector dashboard
├── admin.html                       # Super admin + artist upload portal
├── css/gallery.css                  # Design system (Cormorant Garamond + Inter)
├── js/gallery.js                    # Sticky nav, reveal, zoom, countdown, tabs
├── sitemap.xml                      # SEO
├── robots.txt                       # incl. GPTBot / ClaudeBot / PerplexityBot
├── manifest.json                    # PWA
├── llms.txt                         # AI-search curated index
├── ARCHITECTURE.md                  # Production stack & schema
└── kpr.html                         # (preserved from main branch — KPR calculator)
```

## Visual direction

- White-canvas, museum-grade layout. Generous white space.
- Editorial typography (Cormorant Garamond + Inter + JetBrains Mono).
- Painted gradient "canvases" stand in for artwork photography until the
  artist uploads real images via the admin portal. Each placeholder carries
  a censorship-style banner echoing the gallery's founding work,
  *Finding Mainera, No. I* by Asti Rahardjo (2022, oil on canvas, 50 × 60 cm).

## Features in the prototype

- Cinematic hero, spotlight, archive grid, roster, curatorial letter, exhibitions timeline, collector banner.
- Artwork detail page with image zoom, four-view thumbnails, lightbox, live-auction countdown, written-rationale bid form, comments, related works.
- Admin mockup with KPI dashboard, upload form (drag-drop), work table, bid review queue, comment moderation, roster, SEO panel, homepage module ordering.
- Auth (collector / artist tabs, OAuth UI, email + WebAuthn step-up flow shown).
- Collector dashboard with active bids, saved works, acquisition history with provenance PDFs.
- Schema.org JSON-LD: `WebSite`, `ArtGallery`, `Person`, `VisualArtwork`, `Offer`, `BreadcrumbList`, `ItemList`.
- `hreflang` EN/ID; OpenGraph + Twitter cards; PWA manifest.

## Running

It's vanilla HTML/CSS/JS. Open the file directly, or serve:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000/
```

Deploy as-is to Vercel, Netlify, Cloudflare Pages or GitHub Pages — no build step.

## Roster (placeholder data)

| # | Artist | Based in | Medium |
|---|---|---|---|
| 01 | Asti Rahardjo | Yogyakarta | Oil on canvas |
| 02 | Lien Hara | Jakarta / Kyoto | Oil on linen |
| 03 | Jovan Aritonang | Medan / Berlin | Oil on canvas |
| 04 | Nadira Khoury | Beirut / Jakarta | Oil &amp; text on canvas |
| 05 | Kei Sato | Tokyo | Oil on canvas (*Nocturne* series) |

These artists, works and prices are illustrative. Replace via the admin
portal — or follow `ARCHITECTURE.md` §4 to seed the production database.

## Production upgrade

Read [`ARCHITECTURE.md`](./ARCHITECTURE.md) for:

- Full Next.js 15 (App Router) folder structure
- Prisma schema (Users, Artists, Works, Auctions, Bids with rationale, Comments, Exhibitions, AuditLog…)
- Auction state machine with anti-snipe
- NextAuth + WebAuthn step-up for bidding
- Cloudinary image pipeline with deep-zoom
- SEO + AI-search strategy
- Vercel + Neon + Cloudflare deployment topology
- Security, performance budget, accessibility, roadmap
